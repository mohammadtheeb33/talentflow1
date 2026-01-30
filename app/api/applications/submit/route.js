import { NextResponse } from 'next/server';
import { getAdminDb, getAdminStorage } from '@/lib/firebaseAdmin';
import { scoreCv } from '@/lib/scoreEngineServer';
import { FieldValue } from 'firebase-admin/firestore';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

// Helper to extract text from buffer
async function extractText(buffer, mimeType) {
  try {
    if (mimeType === 'application/pdf') {
      const data = await pdf(buffer);
      return data.text || "";
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.template'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    }
    // Fallback for plain text or unknown types (try string conversion)
    if (mimeType.startsWith('text/')) {
       return buffer.toString('utf-8');
    }
    return "";
  } catch (e) {
    console.error("Text Extraction Failed:", e);
    return "";
  }
}

export async function POST(request) {
  console.log("Submit Application API Hit");
  try {
    const formData = await request.formData();
    const file = formData.get('resume');
    const jobId = formData.get('jobId');
    
    // Support both direct fields and 'data' JSON object
    let candidateData = {};
    if (formData.has('data')) {
      try {
        candidateData = JSON.parse(formData.get('data'));
      } catch (e) {
        console.error("Failed to parse data field", e);
      }
    } else {
      candidateData = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        linkedin: formData.get('linkedin')
      };
    }

    if (!file || !jobId || !candidateData.email) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const db = getAdminDb();
    const storage = getAdminStorage();

    // 1. Fetch Job to get Owner UID
    const jobRef = db.collection('jobProfiles').doc(jobId);
    const jobDoc = await jobRef.get();
    
    let ownerUid = null;
    let jobTitle = 'Unknown Job';
    let jobEducationLevel = "none";
    if (jobDoc.exists) {
      const data = jobDoc.data();
      ownerUid = data?.uid;
      jobTitle = data?.jobTitle || data?.title || 'Unknown Job';
      jobEducationLevel = data?.educationLevel || "none";
    }

    // 2. Create Candidate Document Reference
    const candidatesRef = db.collection('cvs');
    const newDocRef = candidatesRef.doc();
    const newCandidateId = newDocRef.id;

    // 3. Upload File
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Extract Text IMMEDIATELY (Mocked for now to prevent crash)
    const extractedText = await extractText(buffer, file.type);
    
    const filename = file.name;
    const storagePath = `candidates/${newCandidateId}/${filename}`;
    const bucket = storage.bucket();
    const fileRef = bucket.file(storagePath);
    
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
      }
    });

    // 4. Save Initial Data
    await newDocRef.set({
      ...candidateData,
      id: newCandidateId,
      jobId,
      jobProfileId: jobId,
      jobTitle,
      uid: ownerUid,
      storagePath,
      filename,
      text: extractedText,
      resumeText: extractedText,
      status: 'Applied',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      source: 'Career Page'
    });

    // 5. Auto-Scoring Trigger
    try {
      console.log("Starting Auto-Score for:", newCandidateId);
      const aiResult = await scoreCv(newCandidateId, jobId, extractedText);
      let safeScore = aiResult.score || 0;
      if (typeof safeScore === "string") {
        const match = safeScore.match(/(\d+(\.\d+)?)/);
        safeScore = match ? parseFloat(match[0]) : 0;
      }
      safeScore = Number(safeScore);
      if (isNaN(safeScore) || !isFinite(safeScore)) safeScore = 0;

      let improvementsText = "";
      if (aiResult.riskFlags && aiResult.riskFlags.length > 0) {
        improvementsText += "Risk Flags:\n" + aiResult.riskFlags.map(f => `• ${f.message}`).join("\n");
      }

      await newDocRef.update({
        overallScore: safeScore,
        score: safeScore,
        matchScore: safeScore,
        analysis: (aiResult.explanation || []).join('\n') || "",
        matchDetails: aiResult,
        status: 'Scored',
        scoreBreakdown: aiResult.breakdown,
        scoreDetailedBreakdown: aiResult.detailedBreakdown,
        scoreRiskFlags: aiResult.riskFlags,
        scoreExperienceYears: aiResult.relevantExperienceYears || 0,
        scoreEducationDetected: String(jobEducationLevel || "none"),
        scoreInferredSkills: aiResult.inferredSkills || [],
        scoreSkillsAnalysis: aiResult.skillsAnalysis || { directMatches: [], inferredMatches: [], missing: [] },
        aiAnalysis: (aiResult.explanation || []).join('\n') || "",
        improvements: improvementsText,
        extractedContact: aiResult.extractedContact,
        updatedAt: FieldValue.serverTimestamp()
      });
      console.log("Auto-scoring completed for:", newCandidateId);
    } catch (error) {
      console.error("Auto-scoring failed (User can retry manually):", error);
    }

    // 6. Create Notification (Robust & Fail-Safe)
    try {
      const candidateName = `${candidateData.name || 'Candidate'}`.trim();
      const safeJobTitle = jobTitle || "Unknown Position";

      await db.collection('notifications').add({
        type: 'new_application',
        title: 'New Application Received',
        message: `${candidateName} applied for ${safeJobTitle}`,
        candidateId: newCandidateId,
        targetUrl: `/cvs/${newCandidateId}`,
        isRead: false,
        uid: ownerUid, // Essential for frontend filtering
        createdAt: new Date().toISOString(),
        timestamp: FieldValue.serverTimestamp() // Keep for sorting, optional
      });
      console.log("✅ Notification created successfully for:", candidateName);
    } catch (notifError) {
      console.error("❌ Failed to create notification:", notifError);
    }

    return NextResponse.json({ success: true, message: "Application received successfully" });

  } catch (error) {
    console.error("Application submission error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
