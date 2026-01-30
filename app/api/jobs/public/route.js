import { NextResponse } from 'next/server';
import { getAdminDb, getAdminStorage } from '@/lib/firebaseAdmin';
import { scoreCv } from '@/lib/scoreEngineServer';
import { FieldValue } from 'firebase-admin/firestore';
// import pdf from 'pdf-parse';
// import mammoth from 'mammoth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    const db = getAdminDb();
    
    if (jobId) {
      const doc = await db.collection('jobProfiles').doc(jobId).get();
      if (!doc.exists) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json({ id: doc.id, ...doc.data() });
    }

    const snapshot = await db.collection('jobProfiles')
      .where('status', '==', 'Open')
      .get();

    const jobs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Helper to extract text from buffer
async function extractText(buffer, mimeType) {
  try {
    if (mimeType === 'application/pdf') {
      const pdf = (await import('pdf-parse')).default;
      const data = await pdf(buffer);
      return data.text || "";
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.template'
    ) {
      const mammoth = (await import('mammoth')); // mammoth usually exports directly or default? check docs. Usually `import * as mammoth` or default.
      // previous was `import mammoth from 'mammoth'`, so default.
      // But let's check: const mammoth = await import('mammoth'); 
      // If it has default: mammoth.default.extractRawText
      // Or if it is CommonJS: mammoth.extractRawText
      const mammothLib = (await import('mammoth')).default || (await import('mammoth'));
      const result = await mammothLib.extractRawText({ buffer });
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
  console.log("Submit Application API Hit (via jobs/public)");

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
    if (jobDoc.exists) {
      const data = jobDoc.data();
      ownerUid = data?.uid;
      jobTitle = data?.jobTitle || data?.title || 'Unknown Job';
    }

    // 2. Create Candidate Document Reference
    const candidatesRef = db.collection('cvs');
    const newDocRef = candidatesRef.doc();
    const newCandidateId = newDocRef.id;

    // 3. Upload File
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Extract Text IMMEDIATELY
    const extractedText = await extractText(buffer, file.type);
    
    // Sanitize filename to prevent storage issues
    const originalFilename = file.name;
    const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Use 'cvs' path to match storage.rules and client expectations
    const storagePath = `cvs/${newCandidateId}/original/${sanitizedFilename}`;
    const bucket = storage.bucket();
    const fileRef = bucket.file(storagePath);
    
    console.log(`Uploading file to: ${storagePath} in bucket: ${bucket.name}`);
    
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
      uid: ownerUid,
      storagePath,
      filename: sanitizedFilename,
      originalFilename, // Keep original for display if needed
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
      
      await newDocRef.update({
        overallScore: aiResult.score || 0,
        analysis: (aiResult.explanation || []).join('\n') || "",
        matchDetails: aiResult,
        status: 'Scored',
        scoreBreakdown: aiResult.breakdown,
        updatedAt: FieldValue.serverTimestamp()
      });
      console.log("Auto-scoring completed for:", newCandidateId);
    } catch (error) {
      console.error("Auto-scoring failed (User can retry manually):", error);
      // We do NOT fail the request here, just log it. The application is submitted.
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
        uid: ownerUid,
        createdAt: new Date().toISOString(),
        timestamp: FieldValue.serverTimestamp()
      });
      console.log("✅ Notification created successfully for:", candidateName);
    } catch (notifError) {
      console.error("❌ Failed to create notification:", notifError);
    }

    return NextResponse.json({ success: true, message: "Application received successfully" });

  } catch (error) {
    console.error("Application submission error:", error);
    // Return actual error for debugging
    return NextResponse.json({ 
        success: false, 
        message: "Internal Server Error: " + (error instanceof Error ? error.message : String(error)),
        stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
