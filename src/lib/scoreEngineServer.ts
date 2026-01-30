import { getAdminDb, getAdminStorage } from "./firebaseAdmin";
import { evaluateCv, JobProfile } from "./scoreEngine";
import { extractTextFromPdf } from "./pdf";

export async function scoreCv(cvId: string, jobId: string, directResumeText?: string) {
  const db = getAdminDb();
  const storage = getAdminStorage();

  // 1. Get Job Data
  const jobDoc = await db.collection("jobProfiles").doc(jobId).get();
  if (!jobDoc.exists) {
    throw new Error(`Job ${jobId} not found`);
  }
  const jobData = jobDoc.data();

  const engineJob: JobProfile = {
    title: (jobData as any)?.title || "Unknown Role",
    requiredSkills: Array.isArray((jobData as any)?.requiredSkills) ? (jobData as any).requiredSkills : [],
    optionalSkills: Array.isArray((jobData as any)?.optionalSkills) ? (jobData as any).optionalSkills : [],
    minYearsExp: Number((jobData as any)?.minYearsExp) || 0,
    educationLevel: (jobData as any)?.educationLevel || "none",
    description: (jobData as any)?.description,
  } as any;

  // 2. Get CV Data (Only needed if direct text not provided OR to get storage path)
  let candidateData: any = {};
  let collectionName = "candidates";

  if (!directResumeText) {
      let candidateDoc = await db.collection("candidates").doc(cvId).get();
      if (!candidateDoc.exists) {
        candidateDoc = await db.collection("cvs").doc(cvId).get();
        collectionName = "cvs";
        if (!candidateDoc.exists) {
          throw new Error(`Candidate/CV ${cvId} not found`);
        }
      }
      candidateData = candidateDoc.data();
  }

  // 3. Get Text
  let rawText = directResumeText || (candidateData as any)?.text || (candidateData as any)?.content || "";
  
  if (!rawText || rawText.length < 50) {
    // Attempt to download and parse file (Only if direct text is missing)
    const storagePath = (candidateData as any)?.storagePath;
    if (storagePath) {
      try {
        const bucket = storage.bucket();
        const file = bucket.file(storagePath);
        const [buffer] = await file.download();
        
        if (storagePath.toLowerCase().endsWith(".pdf")) {
          rawText = await extractTextFromPdf(buffer);
        } else {
           // Assume text or unsupported
           rawText = buffer.toString('utf-8');
        }
        
        // Save extracted text back to DB to save future processing
        if (rawText && rawText.length > 50) {
          await db.collection(collectionName).doc(cvId).update({ text: rawText });
        }
      } catch (e) {
        console.error("Failed to download/parse file:", e);
      }
    }
  }
  
  if (!rawText) {
    throw new Error("No text content available for scoring");
  }

  // 4. Evaluate
  // Note: We do not pass metadata to avoid triggering client-side usage logging which uses getClientFirestore
  const scoreResult = await evaluateCv(rawText, engineJob); 
  
  return scoreResult;
}
