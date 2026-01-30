import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

async function getUserId(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const uid = await getUserId(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = getAdminDb();
    const docRef = db.collection('integrations').doc('outlook').collection('users').doc(uid);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ connected: false });
    }

    const data = docSnap.data();
    
    const isConnected = data.connected === true || data.status === 'connected' || data.status === 'error';
    const hasToken = !!data.refreshToken;

    if (isConnected && hasToken) {
        return NextResponse.json({ 
            connected: true,
            email: data.email,
            displayName: data.displayName,
            status: data.status,
            lastSyncError: data.lastSyncError || null,
            updatedAt: data.updatedAt 
        });
    }

    return NextResponse.json({ connected: false });

  } catch (error) {
    console.error("Outlook Status Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
