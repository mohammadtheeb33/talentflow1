
import { NextResponse } from 'next/server';
import { getAdminDb } from "@/lib/firebaseAdmin";

export async function PATCH(request, { params }) {
  try {
    const { jobId } = params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const db = getAdminDb();
    await db.collection('jobProfiles').doc(jobId).update({
      status: status,
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Error updating job status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
