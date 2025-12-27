import { getClientFirestore } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp, query, collection, where, getDocs, orderBy } from "firebase/firestore";
import { evaluateCv, JobProfile } from "@/lib/scoreEngine";

export type BatchProgressCallback = (
  processed: number,
  total: number,
  currentId: string,
  status: "processing" | "success" | "error",
  message?: string
) => void;

export interface BulkScanOptions {
  mode: "selection" | "date_range";
  candidateIds?: string[];
  dateRange?: { start: Date; end: Date };
  targetJobId: string;
  onProgress?: BatchProgressCallback;
}

export async function processBulkScan({
  mode,
  candidateIds,
  dateRange,
  targetJobId,
  onProgress,
}: BulkScanOptions) {
  const db = getClientFirestore();
  let candidatesToProcess: { id: string; data: any }[] = [];

  // 1. Fetch Target Job Profile
  const jobRef = doc(db, "jobProfiles", targetJobId);
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) {
    throw new Error(`Target Job Profile ${targetJobId} not found`);
  }
  const jobData = jobSnap.data();
  
  // Construct JobProfile for Scoring Engine
  const engineJob: JobProfile = {
    title: jobData.title,
    requiredSkills: Array.isArray(jobData.requiredSkills) ? jobData.requiredSkills : [],
    optionalSkills: Array.isArray(jobData.optionalSkills) ? jobData.optionalSkills : [],
    minYearsExp: Number(jobData.minYearsExp) || 0,
    educationLevel: (jobData.educationLevel as any) || "none",
    description: jobData.description,
  };

  // 2. Resolve Candidates
  if (mode === "selection" && candidateIds?.length) {
    candidatesToProcess = candidateIds.map(id => ({ id, data: null })); 
  } else if (mode === "date_range" && dateRange) {
    const q = query(
      collection(db, "cvs"),
      where("createdAt", ">=", Timestamp.fromDate(dateRange.start)),
      where("createdAt", "<=", Timestamp.fromDate(dateRange.end)),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    snap.forEach(doc => {
      candidatesToProcess.push({ id: doc.id, data: doc.data() });
    });
  }

  const total = candidatesToProcess.length;
  let processed = 0;

  for (const candidate of candidatesToProcess) {
    const { id } = candidate;
    let { data } = candidate;

    try {
      if (onProgress) onProgress(processed, total, id, "processing", "Fetching candidate data...");

      if (!data) {
        const cSnap = await getDoc(doc(db, "cvs", id));
        if (!cSnap.exists()) {
          throw new Error("Candidate document not found");
        }
        data = cSnap.data();
      }

      // GUARD: If status is finalized (rejected/accepted), skip re-scoring to prevent overwriting manual decisions
      const currentStatus = String((data as any)?.status || "").toLowerCase();
      if (["rejected", "strong_fit", "accepted", "not_a_fit", "not a fit", "strong fit", "hired", "interviewed", "offer_sent"].includes(currentStatus)) {
        if (onProgress) onProgress(processed, total, id, "processing", `Skipping finalized status: ${currentStatus}`);
        processed++;
        continue;
      }

      // Check if we have parsed data or text
      const parsed = data.parsed;
      const rawText = data.text || data.content || (parsed ? JSON.stringify(parsed) : "");

      if (!rawText) {
        throw new Error("No text content or parsed data found for candidate");
      }

      if (onProgress) onProgress(processed, total, id, "processing", "Running AI evaluation...");

      // Call Scoring Engine
      const scoreResult = await evaluateCv(rawText, engineJob);

      if (!scoreResult) {
        throw new Error("Scoring engine returned no result");
      }

      // Update Firestore
      if (onProgress) onProgress(processed, total, id, "processing", "Updating database...");

      // Ensure score is a valid number
      let safeScore = scoreResult.score;
      
      // Handle string scores (e.g. "88%")
      if (typeof safeScore === 'string') {
        const match = (safeScore as string).match(/(\d+(\.\d+)?)/);
        if (match) {
            safeScore = parseFloat(match[0]);
        } else {
            safeScore = 0;
        }
      }
      
      // Final safety check
      safeScore = Number(safeScore);
      if (isNaN(safeScore) || !isFinite(safeScore)) {
          console.warn(`Invalid score received for ${id}:`, scoreResult.score);
          safeScore = 0;
      }

      // Improvements & Risks (Match Single Scan Logic)
      let improvementsText = "";
      if (scoreResult.riskFlags && scoreResult.riskFlags.length > 0) {
        improvementsText += "Risk Flags:\n" + scoreResult.riskFlags.map(f => `• ${f.message}`).join("\n");
      }

      const updatePayload = {
        // 1. Force the Score at the ROOT level
        score: safeScore,
        matchScore: safeScore, // Alias requested by user
        
        // 2. Persist the Job Profile ID & Role
        jobProfileId: targetJobId,
        jobId: targetJobId, // Alias for compatibility
        jobTitle: jobData?.title || "Unknown Job", // Added per user request
        targetRole: jobData?.title || "Unknown Role",

        // 3. Status Flags
        status: safeScore >= 70 ? "strong_fit" : safeScore >= 50 ? "needs_review" : "not_a_fit",
        isQualified: safeScore >= 70,
        
        // 4. Analysis Data - Match Single Scan fields exactly
        scoreBreakdown: scoreResult.breakdown,
        scoreDetailedBreakdown: scoreResult.detailedBreakdown,
        scoreRiskFlags: scoreResult.riskFlags,
        scoreExperienceYears: scoreResult.relevantExperienceYears || 0,
        scoreEducationDetected: (engineJob.educationLevel as string) || "none",
        scoreInferredSkills: scoreResult.inferredSkills || [],
        scoreSkillsAnalysis: scoreResult.skillsAnalysis || { directMatches: [], inferredMatches: [], missing: [] },
        
        aiAnalysis: scoreResult.explanation?.join("\n\n") || "", // Human Verdict (String) - Join all parts
        improvements: improvementsText,
        extractedContact: scoreResult.extractedContact,
        
        // 5. Timestamps
        updatedAt: serverTimestamp(),
        lastScoredAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "cvs", id), updatePayload);

      processed++;
      if (onProgress) onProgress(processed, total, id, "success", `Scored: ${Math.round(safeScore)}%`);

    } catch (err: any) {
      console.error(`Error processing candidate ${id}:`, err);
      processed++; 
      if (onProgress) onProgress(processed, total, id, "error", err.message || "Unknown error");
    }
  }
}
