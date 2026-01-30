import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
// import { generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce'; // Removed for Standard Flow

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
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const { searchParams } = new URL(request.url);
    const tenantOverride = searchParams.get('tenant');
    const tenantId = tenantOverride || process.env.OUTLOOK_TENANT_ID || 'common';
    
    // Log the Tenant ID being used for debugging
    // console.log(`Outlook Auth - Using Tenant ID: ${tenantId}`);

    const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const baseUrl = (envUrl && !envUrl.includes('localhost')) ? envUrl : 'https://cvchek-6b250.web.app';
    const REDIRECT_URI = `${baseUrl}/api/integrations/outlook/callback`;
    
    console.log(`[Outlook Auth] Using Redirect URI: ${REDIRECT_URI}`);
    
    if (!clientId) {
      return NextResponse.json({ error: 'Missing OUTLOOK_CLIENT_ID' }, { status: 500 });
    }

    // PKCE REMOVED - Using standard Authorization Code Flow (Confidential Client)
    // We rely on client_secret in the callback instead of code_verifier
    const stateId = crypto.randomUUID();
    
    // ✅ Always use 'common' to support both Personal and Work/School accounts
    const authBase = `https://login.microsoftonline.com/common/oauth2/v2.0`;
    
    console.log(`[Outlook Auth] Generated State: ${stateId}`);
    console.log(`[Outlook Auth] Flow: Standard (No PKCE)`);

    const db = getAdminDb();
    const stateRef = db.collection('outlook_oauth_states').doc(stateId);
    
    // Clean up old states for this user to prevent confusion
    // (Optional but good practice to avoid state pollution)
    try {
      const statesRef = db.collection('outlook_oauth_states');
      const oldStatesSnapshot = await statesRef.where('userId', '==', uid).get();
      
      if (!oldStatesSnapshot.empty) {
        const batch = db.batch();
        oldStatesSnapshot.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted ${oldStatesSnapshot.size} old OAuth states for user ${uid}`);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup old states:', cleanupError);
      // Continue anyway, this is non-critical
    }
    
    await stateRef.set({
      userId: uid,
      // codeVerifier: null, // No PKCE
      tenant: 'common',
      authBase,
      redirectUri: REDIRECT_URI, // Store exact Redirect URI to ensure match in callback
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000))
    });

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      response_mode: 'query',
      // Updated scopes as per legacy requirement (Fully Qualified for Graph)
      scope: 'openid profile email offline_access User.Read Mail.Read Mail.Send Files.Read.All',
      state: stateId,
      prompt: 'select_account', // Allow user to select account if multiple are logged in
    });

    const url = `${authBase}/authorize?${params.toString()}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error generating Auth URL:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
