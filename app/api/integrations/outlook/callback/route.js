import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  if (error) {
    console.error('Outlook Auth Error:', error);
    return NextResponse.json({ error: `Outlook Auth Error: ${error}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }
  if (!state) {
    return NextResponse.json({ error: 'Missing state parameter' }, { status: 400 });
  }

  try {
    // Use dynamic redirect URI to support various environments if needed, but default to prod for reliability
    const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const baseUrl = (envUrl && !envUrl.includes('localhost')) ? envUrl : 'https://cvchek-6b250.web.app';
    const REDIRECT_URI = `${baseUrl}/api/integrations/outlook/callback`;

    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Missing Outlook credentials in env");
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const db = getAdminDb();
    const stateRef = db.collection('outlook_oauth_states').doc(state);
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) {
      return NextResponse.json({ error: 'Invalid or expired OAuth state' }, { status: 400 });
    }
    const stateData = stateSnap.data();
    if (!stateData?.userId) {
      console.error('[Outlook Auth] Invalid state data:', stateData);
      await stateRef.delete();
      return NextResponse.json({ error: 'Invalid OAuth state data' }, { status: 400 });
    }
    const expiresAt = stateData.expiresAt?.toDate ? stateData.expiresAt.toDate() : null;
    if (expiresAt && expiresAt.getTime() < Date.now()) {
      console.error('[Outlook Auth] State expired');
      await stateRef.delete();
      return NextResponse.json({ error: 'OAuth state expired' }, { status: 400 });
    }

    // Use stored redirectUri to ensure exact match with authorize request
    // But update it if we are enforcing the new logic
    let redirectUri = REDIRECT_URI;
    
    console.log(`[Outlook Auth] Exchanging code for token. State ID: ${state}`);
    console.log(`[Outlook Auth] Using Redirect URI: ${redirectUri}`);

    // ✅ Use 'common' for token exchange as well
    const tokenResponse = await fetch(`https://login.microsoftonline.com/common/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid profile email offline_access User.Read Mail.Read Mail.Send Files.Read.All',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      await stateRef.delete();
      return NextResponse.json({ error: 'Failed to exchange token', details: tokenData }, { status: 400 });
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Fetch user profile from Microsoft Graph (Optional but good for email)
    let email = 'connected_user@outlook.com';
    let displayName = null;
    try {
      const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        email = profileData.mail || profileData.userPrincipalName || email;
        displayName = profileData.displayName;
      }
    } catch (e) {
      console.error("Failed to fetch Outlook profile", e);
    }

    const expiresIn = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600;
    const expiresAtMs = Date.now() + (expiresIn * 1000);

    const rawScopes = String(tokenData.scope || '')
      .split(' ')
      .map((s) => s.trim())
      .filter(Boolean);
    const scope = rawScopes.map((s) =>
      s.startsWith('https://graph.microsoft.com/') ? s.replace('https://graph.microsoft.com/', '') : s
    );

    const integrationRef = db.collection('integrations').doc('outlook').collection('users').doc(stateData.userId);
    const existing = await integrationRef.get();
    const createdAtValue = existing.exists && existing.data()?.createdAt ? existing.data().createdAt : FieldValue.serverTimestamp();

    const integrationData = {
      connected: true,
      accessToken: access_token || null,
      refreshToken: refresh_token || null,
      expiresAt: expiresAtMs,
      scope,
      email: email || null,
      displayName: displayName || null,
      tenantId: stateData.tenant || null,
      authBase: stateData.authBase || null,
      status: 'connected',
      lastSyncError: null,
      createdAt: createdAtValue,
      updatedAt: FieldValue.serverTimestamp()
    };

    await integrationRef.set(integrationData, { merge: true });
    await stateRef.delete();

    const successHtml = `
    <html>
      <head>
        <title>تم توصيل Outlook</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 50px; background-color: #f0fdf4; color: #166534; }
          .success-icon { font-size: 48px; margin-bottom: 20px; }
          h1 { margin-bottom: 10px; }
          p { color: #4b5563; margin-bottom: 30px; }
          button { 
            background-color: #16a34a; color: white; border: none; padding: 10px 20px; 
            border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold;
          }
          button:hover { background-color: #15803d; }
          a { color: #16a34a; text-decoration: none; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="success-icon">✅</div>
        <h1>تم توصيل Outlook بنجاح</h1>
        <p>يمكنك إغلاق هذه النافذة والعودة إلى الموقع.</p>
        <button onclick="window.close()">إغلاق النافذة</button>
        <div style="margin-top: 16px;">
          <a href="https://cvchek-6b250.web.app/dashboard">العودة إلى لوحة التحكم</a>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'outlook-connected' }, '*');
          }
        </script>
      </body>
    </html>
    `;

    return new NextResponse(successHtml, {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error('CRITICAL OAUTH ERROR:', error);
    
    // Construct detailed error HTML
    const errorHtml = `
    <html>
      <head>
        <title>Connection Failed</title>
        <style>
          body { font-family: monospace; padding: 20px; background-color: #1a1a1a; color: #ff5555; }
          .container { max-width: 800px; margin: 0 auto; background: #2a2a2a; padding: 30px; border-radius: 8px; }
          h1 { color: #ff5555; border-bottom: 1px solid #444; padding-bottom: 10px; }
          .details { background: #000; padding: 15px; border-radius: 5px; overflow-x: auto; white-space: pre-wrap; color: #ddd; }
          .env-info { margin-top: 20px; font-size: 12px; color: #888; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚠️ Internal Server Error</h1>
          <p>The Outlook connection failed on the server side.</p>
          
          <h3>Error Details:</h3>
          <div class="details">${error.message || String(error)}</div>
          
          <h3>Stack Trace:</h3>
          <div class="details">${error.stack || 'No stack trace available'}</div>
          
          <div class="env-info">
            <h3>Environment Check:</h3>
            <ul>
              <li>Has Client ID: ${!!process.env.OUTLOOK_CLIENT_ID ? 'YES' : 'NO'}</li>
              <li>Has Client Secret: ${!!process.env.OUTLOOK_CLIENT_SECRET ? 'YES' : 'NO'}</li>
              <li>Tenant ID: ${process.env.OUTLOOK_TENANT_ID || 'common (fallback)'}</li>
            </ul>
          </div>
        </div>
      </body>
    </html>
    `;

    return new NextResponse(errorHtml, { 
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}
