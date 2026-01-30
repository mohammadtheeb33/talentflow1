
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminStorage } from '@/lib/firebaseAdmin';
import { evaluateCv, type JobProfile as EngineJobProfile } from "@/lib/scoreEngine";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FieldValue } from "firebase-admin/firestore";
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "");

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Helper: Smart Retry for AI with Model Fallback
async function generateWithRetry(prompt: string, retries = 3) {
  const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash"];
  
  for (const modelName of modelsToTry) {
    const model = genAI.getGenerativeModel({ model: modelName });
    
    for (let i = 0; i < retries; i++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error: any) {
        const isRetryable = 
            error.message?.includes('429') || 
            error.message?.includes('Too many requests') ||
            error.message?.includes('503') ||
            error.message?.includes('overloaded') ||
            error.message?.includes('internal error');

        if (isRetryable) {
          console.warn(`⚠️ AI Rate Limit/Error (${modelName}). Retrying in ${(i + 1) * 2}s...`);
          await delay(2000 * (i + 1));
          continue;
        }
        
        // If we reach here, it might be a model-specific issue that isn't strictly "retryable" 
        // but might work on another model.
        console.warn(`⚠️ AI Error (${modelName}) failed:`, error.message);
        break; // Break inner loop to try next model
      }
    }
  }
  throw new Error("AI Service is busy (All models failed). Please try again later.");
}

async function getUserId(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { cvId } = await request.json();

    if (!cvId) {
      return NextResponse.json({ error: 'Missing cvId' }, { status: 400 });
    }

    const uid = await getUserId(request);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`🚀 Processing Candidate: ${cvId}`);
    const db = getAdminDb();
    const storage = getAdminStorage();

    // 1. Get CV Document to find file path and job info
    let docRef = db.collection('cvs').doc(cvId);
    let docSnap = await docRef.get();
    
    // Fallback to candidates collection if not in cvs
    if (!docSnap.exists) {
        docRef = db.collection('candidates').doc(cvId);
        docSnap = await docRef.get();
        if (!docSnap.exists) {
             return NextResponse.json({ error: 'CV not found' }, { status: 404 });
        }
    }
    
    const data = docSnap.data() || {};
    let jobTitle = data.jobTitle || data.title || "General Role";
    let jobContext = "";
    let jobProfileData: any = null;

    // 1b. Fetch Job Profile if linked
    if (data.jobProfileId) {
        try {
            const jobRef = db.collection('jobProfiles').doc(data.jobProfileId);
            const jobSnap = await jobRef.get();
            if (jobSnap.exists) {
                const jobData = jobSnap.data() || {};
                jobProfileData = jobData;
                jobTitle = jobData.title || jobTitle;
                
                const reqSkills = Array.isArray(jobData.requiredSkills) ? jobData.requiredSkills.join(", ") : "";
                const optSkills = Array.isArray(jobData.optionalSkills) ? jobData.optionalSkills.join(", ") : "";
                
                jobContext = `
                Job Description: ${jobData.description || "N/A"}
                Required Skills: ${reqSkills}
                Optional Skills: ${optSkills}
                Min Experience: ${jobData.minYearsExp || 0} years
                Education Level: ${jobData.educationLevel || "Any"}
                `;
                
                console.log(`[Admin Score] Using Job Profile: ${jobTitle}`);
            }
        } catch (err) {
            console.warn("[Admin Score] Failed to fetch Job Profile:", err);
        }
    }

    // 2. Fetch File from Storage (Robust Method)
    let buffer: Buffer | null = null;
    let mimeType = 'application/pdf';
    
    const possiblePaths = [
        data.storagePath,
        `cvs/${cvId}/original/${data.filename}`,
        `candidates/${cvId}/${data.filename}`,
        `cvs/${cvId}/original/${data.filename?.replace(/ /g, '%20')}`,
        `candidates/${cvId}/${data.filename?.replace(/ /g, '%20')}`
    ].filter(Boolean);

    for (const path of possiblePaths) {
        try {
            const file = storage.bucket().file(path);
            const [exists] = await file.exists();
            if (exists) {
                console.log(`[Admin Score] Found file at: ${path}`);
                [buffer] = await file.download();
                if (path.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                break;
            }
        } catch (e) {
            console.warn(`[Admin Score] Check failed for ${path}:`, e);
        }
    }

    let resumeText = "";
    
    // 3. Extract Text
    if (buffer && mimeType === 'application/pdf') {
        try {
            const pdfData = await pdf(buffer);
            resumeText = pdfData.text;
            console.log(`[Admin Score] Extracted ${resumeText.length} chars from PDF`);
            if (resumeText.length > 0) {
                 console.log(`[Admin Score] Text Preview: ${resumeText.substring(0, 100)}...`);
            }
        } catch (e: any) {
            console.error("PDF Extraction failed:", e);
            throw new Error(`Failed to extract text from PDF: ${e.message}`);
        }
    } else if (data.text && data.text.length > 50) {
        console.log("Using existing text from DB");
        resumeText = data.text;
    } else {
        throw new Error("No PDF file found and no text available in DB");
    }

    if (!resumeText || resumeText.length < 50) {
        throw new Error("Resume text is empty or too short.");
    }

    const userRef = db.collection("users").doc(uid);
    try {
      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
          throw new Error("USER_NOT_FOUND");
        }
        const userData = userSnap.data() || {};
        const creditsUsed = Number(userData.credits_used || 0);
        const creditsLimit = Number(userData.credits_limit || 0);
        if (creditsUsed >= creditsLimit) {
          throw new Error("INSUFFICIENT_CREDITS");
        }
        tx.update(userRef, { credits_used: FieldValue.increment(1) });
      });
    } catch (err: any) {
      if (err?.message === "INSUFFICIENT_CREDITS") {
        return NextResponse.json({ error: "Insufficient credits. Please upgrade your plan." }, { status: 403 });
      }
      if (err?.message === "USER_NOT_FOUND") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      throw err;
    }

    // 4. The Comprehensive Prompt
    const prompt = `
      Act as an expert ATS Parser and Recruiter.
      Role: ${jobTitle}
      ${jobContext ? `\nJob Context:\n${jobContext}` : ""}

      Resume Text: """${resumeText.substring(0, 15000)}"""

      Task:
      1. Extract candidate profile, experience, and education structured data.
      2. Evaluate the candidate for the role.

      Return ONLY valid JSON in this structure:
      {
        "profile": {
          "fullName": "Name",
          "email": "Email",
          "phone": "Phone",
          "linkedin": "URL or null",
          "location": "City"
        },
        "parsed_data": {
          "experience": [
             { "title": "Job Title", "company": "Company", "duration": "Date Range", "description": "Summary of duties" }
          ],
          "education": [
             { "degree": "Degree", "institution": "University", "year": "Year" }
          ],
          "skills": ["Skill 1", "Skill 2"],
          "certifications": ["Cert 1", "Cert 2"],
          "courses": "List of courses or string description"
        },
        "evaluation": {
          "overallScore": 85,
          "summary": "Brief summary",
          "pros": ["Strength 1", "Strength 2"],
          "cons": ["Weakness 1", "Weakness 2 (Improvements)"],
          "roleFit": 80,
          "cultureFit": "Good"
        }
      }
    `;

    // 5. Call AI & Parse
    console.log("Sending prompt to AI...");
    const aiResponseText = await generateWithRetry(prompt);
    console.log(`[Admin Score] AI Response Length: ${aiResponseText.length}`);
    const cleanJson = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let aiData;
    try {
        aiData = JSON.parse(cleanJson);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        console.error("Raw Response:", aiResponseText);
        throw new Error("Failed to parse AI JSON response");
    }

    // Normalize AI Data (Handle Flat vs Nested)
    const profile = aiData.profile || {};
    const parsedData = aiData.parsed_data || {
        experience: aiData.experience || [],
        education: aiData.education || [],
        skills: aiData.skills || []
    };
    const evaluation = aiData.evaluation || {
        overallScore: aiData.overallScore || 0,
        summary: aiData.summary || "No summary",
        pros: aiData.pros || [],
        cons: aiData.cons || [],
        roleFit: aiData.roleFit || 0
    };

    let engineJob: EngineJobProfile;
    if (jobProfileData) {
        engineJob = {
            title: jobProfileData.title || jobTitle,
            requiredSkills: Array.isArray(jobProfileData.requiredSkills) ? jobProfileData.requiredSkills : [],
            optionalSkills: Array.isArray(jobProfileData.optionalSkills) ? jobProfileData.optionalSkills : [],
            minYearsExp: Number(jobProfileData.minYearsExp) || 0,
            educationLevel: jobProfileData.educationLevel || "none",
            description: jobProfileData.description || ""
        };
    } else {
        const fallbackSkills = Array.isArray(parsedData.skills) ? parsedData.skills.slice(0, 8) : [];
        engineJob = {
            title: jobTitle || "General Role",
            requiredSkills: fallbackSkills,
            optionalSkills: [],
            minYearsExp: Math.min(5, Math.max(1, parsedData.experience?.length || 0)),
            educationLevel: parsedData.education?.length ? "bachelor" : "none",
            description: ""
        };
    }

    const scoreResult = await evaluateCv(resumeText, engineJob);
    let safeScore = scoreResult.score as any;
    if (typeof safeScore === "string") {
        const match = safeScore.match(/(\d+(\.\d+)?)/);
        safeScore = match ? parseFloat(match[0]) : 0;
    }
    safeScore = Number(safeScore);
    if (isNaN(safeScore) || !isFinite(safeScore)) safeScore = 0;

    let improvementsText = "";
    if (scoreResult.riskFlags && scoreResult.riskFlags.length > 0) {
        improvementsText += "Risk Flags:\n" + scoreResult.riskFlags.map(f => `• ${f.message}`).join("\n");
    }

    // 6. Update Firestore
    const nameParts = (profile.fullName || "Candidate").split(' ');
    
    const updateData = {
       // Identity
       firstName: nameParts[0],
       lastName: nameParts.slice(1).join(' ') || "", 
       name: profile.fullName || "Unnamed Candidate",
       email: profile.email || "",
       phone: profile.phone || "",
       linkedin: profile.linkedin || "",
       
       // Parsed Data (For Raw Tab)
       parsed: {
           experience: parsedData.experience || [],
           structuredExperience: parsedData.experience || [], // Backward compatibility for frontend
           education: parsedData.education || [],
           skills: parsedData.skills || [],
           certifications: parsedData.certifications || [],
           courses: parsedData.courses || "",
           improvements: evaluation.cons || []
       },
       
       overallScore: safeScore,
       score: safeScore,
       matchScore: safeScore,
       status: "Scored",
       scoreBreakdown: scoreResult.breakdown,
       scoreDetailedBreakdown: scoreResult.detailedBreakdown,
       scoreRiskFlags: scoreResult.riskFlags,
       scoreExperienceYears: scoreResult.relevantExperienceYears || 0,
       scoreEducationDetected: String(engineJob.educationLevel || "none"),
       scoreInferredSkills: scoreResult.inferredSkills || [],
       scoreSkillsAnalysis: scoreResult.skillsAnalysis || { directMatches: [], inferredMatches: [], missing: [] },
       aiAnalysis: scoreResult.explanation?.join("\n\n") || evaluation.summary || "",
       improvements: improvementsText,
       extractedContact: scoreResult.extractedContact,
       analysis: evaluation.summary,
       matchDetails: {
           strengths: evaluation.pros,
           weaknesses: evaluation.cons,
           roleFit: evaluation.roleFit
       },
       
       resumeText: resumeText,
       scoredAt: new Date().toISOString()
    };
    
    console.log("[Admin Score] Updating DB with:", JSON.stringify({
        name: updateData.name,
        expCount: updateData.parsed.experience.length,
        eduCount: updateData.parsed.education.length
    }));

    // Update the document
    await docRef.update(updateData);
    
    console.log("Candidate scored and updated successfully.");

    return NextResponse.json({ success: true, data: updateData });

  } catch (error: any) {
    console.error("[Admin Score] Error:", error);
    return NextResponse.json({ 
        error: 'Scoring failed', 
        details: error.message 
    }, { status: 500 });
  }
}
