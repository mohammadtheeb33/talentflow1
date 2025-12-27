import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);
// Updated to use a valid available model
const MODEL_NAME = "gemini-2.0-flash";
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

export interface EmailDraft {
  subject: string;
  body: string; // HTML content
}

export async function generateEmail(
  candidateName: string,
  jobTitle: string,
  status: "accepted" | "rejected",
  companyName: string = "TalentFlow",
  certifications: string[] = [],
  courses: string = ""
): Promise<EmailDraft> {
  // Fixed subjects per requirements
  const subject = status === "accepted" 
    ? "Next Step – Interview Invitation"
    : "Update on Your Application";

  const certsText = certifications.length > 0 ? certifications.join(", ") : "None";
  const coursesText = courses ? courses.slice(0, 200) : "None"; // Limit length to avoid token overuse

  const prompt = `
    You are a professional HR assistant. Write a polite and professional email for a candidate.
    
    **Details:**
    - Candidate Name: ${candidateName}
    - Job Position: ${jobTitle}
    - Company Name: ${companyName}
    - Decision: ${status === "accepted" ? "Proceed to Interview" : "Application Rejected"}
    - Certifications: ${certsText}
    - Courses: ${coursesText}

    **Instructions:**
    - Format the output as clean HTML (no <html> or <body> tags, just paragraphs <p>, bold <strong>, etc.).
    - Use a professional, empathetic tone.
    - For "accepted": Invite them to an interview. Suggest providing availability. Mention their qualifications (like certifications) if relevant to show we reviewed their profile.
    - For "rejected": Thank them for their interest, mention high volume of applicants, encourage future applications. Keep it positive but firm.
    - Do NOT include placeholders like [Your Name] if possible, or use generic sign-offs like "The Hiring Team".
    - Do NOT include the subject line in the HTML.
    
    Output ONLY the HTML body string.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();
    
    // Cleanup markdown code blocks if present
    text = text.replace(/```html/g, "").replace(/```/g, "").trim();
    
    return { subject, body: text };
  } catch (error) {
    console.error("AI Email Generation Failed:", error);
    // Fallback content
    return {
      subject,
      body: `<p>Dear ${candidateName},</p><p>We have an update regarding your application for ${jobTitle}.</p><p>${status === "accepted" ? "We would like to invite you for an interview." : "Unfortunately, we will not be moving forward at this time."}</p><p>Best regards,<br>${companyName}</p>`
    };
  }
}
