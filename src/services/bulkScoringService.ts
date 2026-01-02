import { getClientFirestore, getClientAuth } from "@/lib/firebase";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { evaluateCv, type JobProfile } from "@/lib/scoreEngine";
import { CV } from "@/types/cv";

export async function processBatchScoring(
  cvIds: string[],
  targetJobId: string,
  targetJobTitle: string,
  onProgress: (current: number, total: number, message: string) => void
) {
  const db = getClientFirestore();
  let successCount = 0;
  let failCount = 0;

  const jobRef = doc(db, "jobProfiles", targetJobId);
  const jobSnap = await getDoc(jobRef);
  const jobData = jobSnap.exists() ? jobSnap.data() : null;

  const engineJob: JobProfile = {
    title: (targetJobTitle || (jobData as any)?.title || "Unknown Role"),
    requiredSkills: Array.isArray((jobData as any)?.requiredSkills) ? (jobData as any).requiredSkills : [],
    optionalSkills: Array.isArray((jobData as any)?.optionalSkills) ? (jobData as any).optionalSkills : [],
    minYearsExp: Number((jobData as any)?.minYearsExp) || 0,
    educationLevel: (jobData as any)?.educationLevel || "none",
    description: (jobData as any)?.description,
  } as any;

  const MAX_CONCURRENT = 3;

  for (let i = 0; i < cvIds.length; i += MAX_CONCURRENT) {
    const chunk = cvIds.slice(i, i + MAX_CONCURRENT);
    
    // Process chunk in parallel
    await Promise.all(chunk.map(async (cvId, idx) => {
      // Jitter to prevent exact simultaneous hits
      await new Promise(r => setTimeout(r, idx * 300 + Math.random() * 500));

      const progressIdx = i + idx + 1;
      onProgress(progressIdx, cvIds.length, `Analyzing CV ID: ${cvId.slice(0, 6)}...`);

      try {
        const cvRef = doc(db, "cvs", cvId);
        const cvSnap = await getDoc(cvRef);
        if (!cvSnap.exists()) {
          failCount++;
          return;
        }
        const cvData = cvSnap.data();

        // GUARD: If status is finalized (rejected/accepted), skip re-scoring to prevent overwriting manual decisions
        const currentStatus = String((cvData as any)?.status || "").toLowerCase();
        if (["rejected", "strong_fit", "accepted", "not_a_fit", "not a fit", "strong fit"].includes(currentStatus)) {
          return;
        }

        const parsed = cvData.parsed;
        const rawText = cvData.text || cvData.content || (parsed ? JSON.stringify(parsed) : "");
        if (!rawText) {
          failCount++;
          return;
        }

        const auth = getClientAuth();
        const uid = auth.currentUser?.uid;

        const scoreResult = await evaluateCv(rawText, engineJob, { userId: uid, cvId: cvId });

        let safeScore: any = scoreResult.score;
        if (typeof safeScore === "string") {
          const m = safeScore.match(/(\d+(\.\d+)?)/);
          safeScore = m ? parseFloat(m[0]) : 0;
        }
        safeScore = Number(safeScore);
        if (isNaN(safeScore) || !isFinite(safeScore)) safeScore = 0;

        let improvementsText = "";
        if (scoreResult.riskFlags && scoreResult.riskFlags.length > 0) {
          improvementsText += "Risk Flags:\n" + scoreResult.riskFlags.map(f => `• ${f.message}`).join("\n");
        }

        // Re-fetch to check if status changed during scoring (Double-Check Locking)
        const latestSnap = await getDoc(cvRef);
        if (latestSnap.exists()) {
          const latestStatus = String((latestSnap.data() as any)?.status || "").toLowerCase();
          if (["rejected", "strong_fit", "accepted", "not_a_fit", "not a fit", "strong fit"].includes(latestStatus)) {
            return;
          }
        }

        const updatePayload: any = {
          score: safeScore,
          matchScore: safeScore,
          jobProfileId: targetJobId,
          jobId: targetJobId,
          targetRole: engineJob.title,
          status: "scored",
          scoreBreakdown: scoreResult.breakdown,
          scoreDetailedBreakdown: scoreResult.detailedBreakdown,
          scoreRiskFlags: scoreResult.riskFlags,
          scoreExperienceYears: scoreResult.relevantExperienceYears || 0,
          scoreEducationDetected: String(engineJob.educationLevel || "none"),
          scoreInferredSkills: scoreResult.inferredSkills || [],
          scoreSkillsAnalysis: scoreResult.skillsAnalysis || { directMatches: [], inferredMatches: [], missing: [] },
          aiAnalysis: (scoreResult.explanation || []).join("\n\n"),
          improvements: improvementsText,
          extractedContact: scoreResult.extractedContact,
          updatedAt: serverTimestamp(),
          lastScoredAt: serverTimestamp(),
        };

        await updateDoc(cvRef, updatePayload);
        successCount++;
      } catch (error: any) {
        failCount++;
        console.error(`Error processing ${cvId}:`, error);
        // We log to console but don't stop the batch.
        // If it's rate limit, it will be thrown by evaluateCv now.
      }
    }));
    
    // Delay between chunks to respect rate limits
    if (i + MAX_CONCURRENT < cvIds.length) {
       onProgress(Math.min(i + MAX_CONCURRENT, cvIds.length), cvIds.length, "Cooling down (Rate Limit Protection)...");
       await new Promise(r => setTimeout(r, 2000));
    }
  }

  return { successCount, failCount };
}

/**
 * Score a single CV (helper for UI-driven batching)
 */
export async function scoreSingleCv(cvId: string, targetJobId: string, targetJobTitle: string) {
  const db = getClientFirestore();
  
  // 1. Get Job Data
  const jobRef = doc(db, "jobProfiles", targetJobId);
  const jobSnap = await getDoc(jobRef);
  const jobData = jobSnap.exists() ? jobSnap.data() : null;

  const engineJob: JobProfile = {
    title: (targetJobTitle || (jobData as any)?.title || "Unknown Role"),
    requiredSkills: Array.isArray((jobData as any)?.requiredSkills) ? (jobData as any).requiredSkills : [],
    optionalSkills: Array.isArray((jobData as any)?.optionalSkills) ? (jobData as any).optionalSkills : [],
    minYearsExp: Number((jobData as any)?.minYearsExp) || 0,
    educationLevel: (jobData as any)?.educationLevel || "none",
    description: (jobData as any)?.description,
  } as any;

  // 2. Get CV Data
  const cvRef = doc(db, "cvs", cvId);
  const cvSnap = await getDoc(cvRef);
  if (!cvSnap.exists()) {
    throw new Error("Document not found");
  }
  const cvData = cvSnap.data();

  // 3. Status Guard
  const currentStatus = String((cvData as any)?.status || "").toLowerCase();
  if (["rejected", "strong_fit", "accepted", "not_a_fit", "not a fit", "strong fit"].includes(currentStatus)) {
     return { status: "skipped", message: `Skipped (Status: ${currentStatus})` };
  }

  // 4. Get Text
  const parsed = cvData.parsed;
  const rawText = cvData.text || cvData.content || (parsed ? JSON.stringify(parsed) : "");
  if (!rawText) {
    throw new Error("No text content available");
  }

  // 5. Evaluate
  const auth = getClientAuth();
  const uid = auth.currentUser?.uid;
  const scoreResult = await evaluateCv(rawText, engineJob, { userId: uid, cvId: cvId });

  let safeScore: any = scoreResult.score;
  if (typeof safeScore === "string") {
    const m = safeScore.match(/(\d+(\.\d+)?)/);
    safeScore = m ? parseFloat(m[0]) : 0;
  }
  safeScore = Number(safeScore);
  if (isNaN(safeScore) || !isFinite(safeScore)) safeScore = 0;

  let improvementsText = "";
  if (scoreResult.riskFlags && scoreResult.riskFlags.length > 0) {
    improvementsText += "Risk Flags:\n" + scoreResult.riskFlags.map(f => `• ${f.message}`).join("\n");
  }

  // 6. Double-check Lock
  const latestSnap = await getDoc(cvRef);
  if (latestSnap.exists()) {
    const latestStatus = String((latestSnap.data() as any)?.status || "").toLowerCase();
    if (["rejected", "strong_fit", "accepted", "not_a_fit", "not a fit", "strong fit"].includes(latestStatus)) {
        return { status: "skipped", message: `Skipped (Status changed)` };
    }
  }

  // 7. Update DB
  const updatePayload: any = {
    score: safeScore,
    matchScore: safeScore,
    jobProfileId: targetJobId,
    jobId: targetJobId,
    targetRole: engineJob.title,
    status: "scored",
    scoreBreakdown: scoreResult.breakdown,
    scoreDetailedBreakdown: scoreResult.detailedBreakdown,
    scoreRiskFlags: scoreResult.riskFlags,
    scoreExperienceYears: scoreResult.relevantExperienceYears || 0,
    scoreEducationDetected: String(engineJob.educationLevel || "none"),
    scoreInferredSkills: scoreResult.inferredSkills || [],
    scoreSkillsAnalysis: scoreResult.skillsAnalysis || { directMatches: [], inferredMatches: [], missing: [] },
    aiAnalysis: (scoreResult.explanation || []).join("\n\n"),
    improvements: improvementsText,
    extractedContact: scoreResult.extractedContact,
    updatedAt: serverTimestamp(),
    lastScoredAt: serverTimestamp(),
  };

  await updateDoc(cvRef, updatePayload);
  return { status: "success", score: safeScore };
}

