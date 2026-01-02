import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { JobProfile } from "@/lib/scoreEngine";
import { ParsedCvResult, ExperienceItem } from "@/lib/parsedCv";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(API_KEY);

// Models to try in order of preference (Speed -> Stability)
// Updated based on available models for the current API key
const MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-flash-latest"];

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export interface AIMatchResult {
  overallScore: number;
  roleFitScore: number;
  techSkillsScore: number;
  keyStrengths: string[];
  gaps: string[];
  summary: string;
  skillsAnalysis: {
    directMatches: string[];
    inferredMatches: { jobRequirement: string; candidateSkill: string; reason: string }[];
    missing: string[];
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    model: string;
  };
}

function extractJson<T>(text: string, fallback: T): T {
  try {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    let jsonStr = jsonMatch ? jsonMatch[1] : text;
    jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    try {
        const first = text.indexOf('{');
        const last = text.lastIndexOf('}');
        if (first !== -1 && last !== -1) {
            return JSON.parse(text.substring(first, last + 1)) as T;
        }
    } catch (e2) {}
    console.error("JSON Parse Error:", e);
    return fallback;
  }
}

export interface CombinedAiResult {
  parsed: ParsedCvResult;
  evaluation: AIMatchResult;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    model: string;
  };
}

/**
 * Helper to try multiple models until one works
 */
async function generateWithFallback(prompt: string, maxOutputTokens?: number): Promise<{ text: string; model: string; usage: any }> {
  let lastError: any = null;

  for (const modelName of MODELS) {
    try {
      // Set timeout based on model (Flash needs to be fast, Pro can take longer)
      const timeout = modelName.includes("flash") ? 10000 : 20000;
      
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        safetySettings: SAFETY_SETTINGS
      }, { timeout });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return {
        text: response.text(),
        model: modelName,
        usage: response.usageMetadata
      };
    } catch (e: any) {
      console.warn(`Model ${modelName} failed:`, e.message);
      
      // CRITICAL: Identify Rate Limits immediately
      if (e.message.includes("429") || e.message.toLowerCase().includes("quota") || e.message.toLowerCase().includes("resource exhausted")) {
        throw new Error("Rate Limited (429): Too many requests. Please slow down.");
      }

      lastError = e;
      // If it's a safety block or strict content policy, retrying might not help, but switching models might.
      // If it's quota, switching models might not help if they share quota, but worth a try.
      continue;
    }
  }
  throw lastError || new Error("All AI models failed");
}

// 1. Parallel Execution Wrapper with Robust Error Handling
export async function parseAndEvaluateCvWithAI(
  text: string, 
  job: JobProfile
): Promise<CombinedAiResult> {
  // Use Promise.allSettled so if one fails, the other can still succeed
  const [parsedResult, evalResult] = await Promise.allSettled([
    parseCvWithAI(text),
    evaluateCvTextWithAI(text, job)
  ]);

  // Default empty results
  let parsed: ParsedCvResult = { fullText: text, skills: [], experience: [], education: [], languages: [], certifications: [], rawKeywords: [], name: null, email: null, phone: null, linkedin: null, summary: "" } as ParsedCvResult;
  
  let evaluation: AIMatchResult = {
      overallScore: 0, roleFitScore: 0, techSkillsScore: 0, keyStrengths: [], gaps: ["Analysis Pending"],
      summary: "Analysis failed to complete.", skillsAnalysis: { directMatches: [], inferredMatches: [], missing: [] }
  };

  // Process Parse Result
  if (parsedResult.status === "fulfilled") {
    parsed = parsedResult.value;
  } else {
    console.error("Parse Task Failed:", parsedResult.reason);
  }

  // Process Eval Result
  if (evalResult.status === "fulfilled") {
    evaluation = evalResult.value;
  } else {
    const errorMsg = evalResult.reason?.message || "Unknown error";
    
    // CRITICAL: Propagate Rate Limit errors so we don't save bad data
    if (errorMsg.includes("429") || errorMsg.includes("Rate Limited")) {
        throw new Error(errorMsg);
    }

    console.error("Eval Task Failed:", evalResult.reason);
    evaluation.gaps.push(`Eval Error: ${errorMsg}`);
    evaluation.summary = `Could not complete evaluation: ${errorMsg}`;
  }

  return {
    parsed,
    evaluation,
    usage: {
      inputTokens: (parsed.usage?.inputTokens || 0) + (evaluation.usage?.inputTokens || 0),
      outputTokens: (parsed.usage?.outputTokens || 0) + (evaluation.usage?.outputTokens || 0),
      model: parsed.usage?.model || evaluation.usage?.model || "unknown"
    }
  };
}

// 2. Fast Parser
export async function parseCvWithAI(text: string): Promise<ParsedCvResult> {
  if (!API_KEY) {
    console.error("Missing NEXT_PUBLIC_GEMINI_API_KEY");
    return { fullText: text, skills: [], experience: [], education: [], languages: [], certifications: [], rawKeywords: [], name: null, email: null, phone: null, linkedin: null, summary: "" } as ParsedCvResult;
  }

  const prompt = `
    You are an expert CV Parser. Extract structured data from the Resume text.
    
    **Resume Text:**
    ${text.slice(0, 20000)}

    **Instructions:**
    1. **Contact:** Name, Email, Phone, LinkedIn.
    2. **Skills:** Technical & Soft skills.
    3. **Experience:** Total years (number). Structured list of roles (keep descriptions concise).
    4. **Education/Certs:** List all.
    5. **ATS Score:** 0-100.
    
    **Output JSON:**
    {
      "name": "string", "email": "string", "phone": "string", "linkedin": "string",
      "summary": "string", "skills": ["str"],
      "totalExperienceYears": number,
      "structuredExperience": [{"role": "str", "company": "str", "startDate": "str", "endDate": "str", "description": "str", "isCurrent": bool}],
      "education": ["str"], "certifications": ["str"], "courses": ["str"], "languages": ["str"],
      "generalScore": number
    }
  `;

  try {
    const { text: responseText, model: usedModel, usage } = await generateWithFallback(prompt);
    const parsed = extractJson<any>(responseText, {});

    return {
      fullText: text,
      name: parsed.name || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      linkedin: parsed.linkedin || null,
      summary: parsed.summary || "",
      skills: parsed.skills || [],
      experience: [],
      structuredExperience: parsed.structuredExperience || [],
      totalExperienceYears: parsed.totalExperienceYears || 0,
      education: parsed.education || [],
      languages: parsed.languages || [],
      certifications: parsed.certifications || [],
      courses: Array.isArray(parsed.courses) ? parsed.courses.join("\n") : (parsed.courses || ""),
      rawKeywords: [],
      generalScore: parsed.generalScore || 80,
      usage: {
        inputTokens: usage?.promptTokenCount || 0,
        outputTokens: usage?.candidatesTokenCount || 0,
        model: usedModel
      }
    };
  } catch (error) {
    console.error(`AI Parse Final Error:`, error);
    
    // Fallback: Basic Regex Extraction so we don't return completely empty data
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const phoneRegex = /(?:\+?(\d{1,3}))?[-. (]*(\d{1,4})[-. )]*(\d{1,4})[-. ]*(\d{1,9})(?:[-. ]*(\d{1,9}))?/;
    const linkedinRegex = /linkedin\.com\/in\/[a-zA-Z0-9_-]+/;
    
    const emailMatch = text.match(emailRegex);
    const phoneMatch = text.match(phoneRegex);
    const linkedinMatch = text.match(linkedinRegex);

    return {
      fullText: text,
      name: null,
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[0] : null,
      linkedin: linkedinMatch ? linkedinMatch[0] : null,
      summary: "AI Parsing Failed - Raw Text Only",
      skills: [],
      experience: [],
      structuredExperience: [],
      totalExperienceYears: 0,
      education: [],
      languages: [],
      certifications: [],
      rawKeywords: [],
      generalScore: 0,
      usage: { inputTokens: 0, outputTokens: 0, model: "fallback-regex" }
    } as ParsedCvResult;
  }
}

// 3. Fast Evaluator (Text-based)
export async function evaluateCvTextWithAI(
  text: string, 
  job: JobProfile
): Promise<AIMatchResult> {
  if (!API_KEY) {
    return {
      overallScore: 0, roleFitScore: 0, techSkillsScore: 0, keyStrengths: [], gaps: ["Missing API Key"],
      summary: "No API Key", skillsAnalysis: { directMatches: [], inferredMatches: [], missing: [] }
    };
  }

  const prompt = `
    You are a Technical Recruiter. Evaluate this Candidate for the Job.
    
    **Job:** ${job.title}
    **Skills:** ${job.requiredSkills.join(", ")}
    **Min Exp:** ${job.minYearsExp} years
    
    **Candidate CV:**
    ${text.slice(0, 15000)}

    **Output JSON:**
    {
      "overallScore": number (0-100),
      "roleFitScore": number (0-100),
      "techSkillsScore": number (0-100),
      "keyStrengths": ["str"],
      "gaps": ["str"],
      "summary": "Brief verdict + advice on certifications.",
      "skillsAnalysis": {
        "directMatches": ["str"],
        "inferredMatches": [{ "jobRequirement": "str", "candidateSkill": "str", "reason": "str" }],
        "missing": ["str"]
      }
    }
  `;

  try {
    const { text: responseText, model: usedModel, usage } = await generateWithFallback(prompt);
    const aiResult = extractJson<AIMatchResult>(responseText, {
      overallScore: 0, roleFitScore: 0, techSkillsScore: 0, keyStrengths: [], gaps: ["AI Error"],
      summary: "Evaluation failed.", skillsAnalysis: { directMatches: [], inferredMatches: [], missing: [] }
    });

    const clean = (v: any) => typeof v === 'number' ? v : 0;
    aiResult.overallScore = clean(aiResult.overallScore);
    aiResult.roleFitScore = clean(aiResult.roleFitScore);
    aiResult.techSkillsScore = clean(aiResult.techSkillsScore);

    aiResult.usage = {
        inputTokens: usage?.promptTokenCount || 0,
        outputTokens: usage?.candidatesTokenCount || 0,
        model: usedModel
    };
    return aiResult;
  } catch (error: any) {
    console.error(`AI Eval Final Error:`, error);
    // Return a valid error object so the UI shows the message
    return {
      overallScore: 0, roleFitScore: 0, techSkillsScore: 0, keyStrengths: [], 
      gaps: [`System Error: ${error.message}`],
      summary: `AI Evaluation failed: ${error.message}`, 
      skillsAnalysis: { directMatches: [], inferredMatches: [], missing: [] }
    };
  }
}

// 4. Legacy Wrapper
export async function evaluateCandidateWithAI(
  cvData: ParsedCvResult, 
  job: JobProfile
): Promise<AIMatchResult> {
  return evaluateCvTextWithAI(cvData.fullText || JSON.stringify(cvData), job);
}
