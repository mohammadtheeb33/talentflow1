import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminStorage } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

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

export async function POST(request) {
  try {
    const uid = await getUserId(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = getAdminDb();
    const storage = getAdminStorage();

    let body = null;
    try {
      body = await request.json();
    } catch (e) {
      body = null;
    }
    const from = body?.from;
    const to = body?.to;
    const fileType = body?.fileType || 'pdf';
    const folder = body?.folder || 'inbox';
    const jobProfileId = body?.jobProfileId || null;
    if (!from || !to) {
      return NextResponse.json({ error: 'Missing date range' }, { status: 400 });
    }

    const docRef = db.collection('integrations').doc('outlook').collection('users').doc(uid);
    const docSnap = await docRef.get();
    const data = docSnap.exists ? docSnap.data() : null;
    const refreshToken = data?.refreshToken;

    if (!refreshToken) {
      return NextResponse.json({ error: 'Missing refresh token' }, { status: 400 });
    }

    // 2. Refresh Access Token
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        console.error("❌ Missing Outlook Credentials in Environment Variables");
        return NextResponse.json({ error: "Configuration Error: Missing Outlook Credentials" }, { status: 500 });
    }

    // HARDCODED to ensure no localhost fallback
    // const baseUrl = 'https://cvchek-6b250.web.app';
    const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const baseUrl = (envUrl && !envUrl.includes('localhost')) ? envUrl : 'https://cvchek-6b250.web.app';
    const redirectUri = `${baseUrl}/api/integrations/outlook/callback`;

    // ✅ Always use 'common' to support both Personal and Work/School accounts
    // const tenantId = data?.tenantId || process.env.OUTLOOK_TENANT_ID || 'common';
    // const authBase = data?.authBase || `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;
    const authBase = `https://login.microsoftonline.com/common/oauth2/v2.0`;
    const tokenEndpoint = `${authBase}/token`;

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        // Match scopes exactly with auth-url to ensure correct audience (Fully Qualified for Graph)
        scope: "openid profile email offline_access User.Read Mail.Read Mail.Send Files.Read.All",
        refresh_token: refreshToken,
        redirect_uri: redirectUri,
        grant_type: "refresh_token",
        client_secret: clientSecret
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
        if (tokenData.error === 'invalid_grant') {
             await docRef.update({ status: 'error', lastSyncError: 'Token expired', updatedAt: new Date().toISOString() });
        }
        return NextResponse.json({ error: "Failed to refresh token", details: tokenData }, { status: 401 });
    }

    const accessToken = tokenData.access_token;
    const tokenMeta = decodeJwtPayload(accessToken);
    const tokenScope = (tokenData.scope || tokenMeta?.scp || '').toLowerCase();
    
    // تحديث البيانات في الداتا بيس
    const newRefreshToken = tokenData.refresh_token || refreshToken;
    const newExpiresAt = Date.now() + (tokenData.expires_in * 1000);

    await docRef.update({
        accessToken: accessToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
        status: 'connected',
        connected: true,
        // نقوم بتحديث الـ authBase للمستقبل
        authBase: authBase,
        tenantId: 'consumers',
        lastSyncError: null,
        updatedAt: new Date().toISOString()
    });

    if (tokenScope && !tokenScope.includes('mail.read')) {
        await docRef.update({
            status: 'error',
            lastSyncError: 'Missing Mail.Read permission',
            updatedAt: new Date().toISOString()
        });
        return NextResponse.json(
          { error: 'Missing Mail.Read permission. Please disconnect and reconnect Outlook.', details: { scope: tokenData.scope } },
          { status: 401 }
        );
    }

    const clientRequestId = crypto.randomUUID();
    const graphHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'CvChek/1.0',
      'client-request-id': clientRequestId,
      'return-client-request-id': 'true'
    };

    // --- Profile Check ---
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', { headers: graphHeaders });
    if (!profileResponse.ok) {
        const profileText = await profileResponse.text();
        await docRef.update({ status: 'error', lastSyncError: 'Unauthorized on profile check', updatedAt: new Date().toISOString() });
        return NextResponse.json({ error: 'Failed to validate token against profile', details: profileText }, { status: profileResponse.status });
    }

    // --- Fetch Messages ---
    const fromIso = `${from}T00:00:00Z`;
    const toIso = `${to}T23:59:59Z`;
    const filter = `receivedDateTime ge ${fromIso} and receivedDateTime le ${toIso} and hasAttachments eq true`;

    // استخدام Inbox مباشرة للحسابات الشخصية لتجنب تعقيد المجلدات
    const messagesUrl = new URL("https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages");
    messagesUrl.searchParams.set("$filter", filter);
    messagesUrl.searchParams.set("$top", "20");
    messagesUrl.searchParams.set("$select", "id,subject,from,receivedDateTime,hasAttachments");

    const msgsResponse = await fetch(messagesUrl.toString(), { headers: graphHeaders });

    if (!msgsResponse.ok) {
         const errText = await msgsResponse.text();
         // ... (كود معالجة الأخطاء الأصلي سليم) ...
         return NextResponse.json({ error: 'Failed to fetch messages', details: errText }, { status: msgsResponse.status });
    }

    const { value: messages } = await msgsResponse.json();
    let importedCount = 0;
    const results = [];

    for (const msg of messages) {
        const existingQuery = await db.collection('candidates')
                                      .where('uid', '==', uid)
                                      .where('outlookMessageId', '==', msg.id)
                                      .get();
        
        if (!existingQuery.empty) {
            console.log(`Skipping already processed message: ${msg.id}`);
            continue; 
        }

        const attachmentsUrl = `https://graph.microsoft.com/v1.0/me/messages/${msg.id}/attachments`;
        const attResponse = await fetch(attachmentsUrl, { headers: graphHeaders });
        const { value: attachments } = await attResponse.json();

        const desiredType = String(fileType || 'pdf').toLowerCase();
        
        for (const att of attachments) {
            const name = String(att.name || '').toLowerCase();
            const contentType = String(att.contentType || '').toLowerCase();
            
            // تحقق بسيط وفعال من النوع
            let matchesType = false;
            if (desiredType === 'pdf' && (name.endsWith('.pdf') || contentType.includes('pdf'))) matchesType = true;
            else if (desiredType === 'doc' && (name.endsWith('.doc') || contentType.includes('word'))) matchesType = true;
            else if (desiredType === 'docx' && (name.endsWith('.docx') || contentType.includes('office'))) matchesType = true;
            else if (desiredType === 'pdf' && name.endsWith('.pdf')) matchesType = true; // Fallback default

            if (att['@odata.type'] === '#microsoft.graph.fileAttachment' && matchesType) {
                
                const buffer = Buffer.from(att.contentBytes, 'base64');
                const defaultExt = desiredType === 'doc' ? 'doc' : desiredType === 'docx' ? 'docx' : 'pdf';
                const filename = att.name || `outlook_cv_${Date.now()}.${defaultExt}`;
                
                const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                const storagePath = `cvs/outlook/${uid}/${safeName}`;
                
                const bucket = storage.bucket();
                const file = bucket.file(storagePath);

                await file.save(buffer, {
                    contentType: att.contentType || 'application/octet-stream',
                    metadata: {
                        metadata: {
                            originalName: filename,
                            source: 'outlook',
                            messageId: msg.id,
                            sender: msg.from?.emailAddress?.address
                        }
                    }
                });

                // إضافة المعلومات إلى النتيجة
                results.push({
                    messageId: msg.id,
                    attachmentId: att.id,
                    fileName: safeName,
                    fileType: desiredType,
                    storagePath,
                    sender: msg.from?.emailAddress?.address
                });
                importedCount++;
                break; // إنهاء البحث بعد العثور على الملف المطلوب
            }
        }
    }
    // Return success response
    return NextResponse.json({
      success: true,
      importedCount,
      results
    });
  } catch (error) {
    console.error('Error processing Outlook import:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
