
import { getClientAuth } from "@/lib/firebase";

async function getIdToken(): Promise<string> {
  const auth = getClientAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  return await user.getIdToken();
}

function getFunctionsBaseUrl(): string {
  const override = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL;
  if (override) return override.replace(/\/$/, "");
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return "";
  return `https://us-central1-${projectId}.cloudfunctions.net`;
}

export async function sendInviteEmail(to: string, subject: string, html: string): Promise<void> {
  const idToken = await getIdToken();
  const baseUrl = getFunctionsBaseUrl();
  if (!baseUrl) throw new Error("Missing Functions base URL");
  const resp = await fetch(`${baseUrl}/sendInviteEmail`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ to, subject, html })
  });
  if (!resp.ok) {
    let msg = `Failed to send email (${resp.status})`;
    try {
      const j = await resp.json();
      msg = j?.error || msg;
    } catch {}
    throw new Error(msg);
  }
}

export async function startOutlookOAuth(uid: string, scopesOverride?: string, forceConsent?: boolean, tenantOverride?: string): Promise<{ authUrl: string; stateId?: string }> {
  const params = new URLSearchParams();
  if (tenantOverride) {
    params.set("tenant", tenantOverride);
  }
  const url = params.toString()
    ? `/api/integrations/outlook/auth-url?${params.toString()}`
    : "/api/integrations/outlook/auth-url";
  const idToken = await getIdToken();
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  
  if (!resp.ok) {
    let msg = `Failed to start OAuth (${resp.status})`;
    try { const j = await resp.json(); msg = j?.error || msg; } catch {}
    throw new Error(msg);
  }
  
  const data = await resp.json();
  return { authUrl: data.url };
}

// Build a URL to open the start endpoint in a popup that auto redirects to Microsoft.
export function buildOutlookStartUrl(uid: string, scopesOverride?: string, forceConsent?: boolean, tenantOverride?: string): string {
  console.warn("buildOutlookStartUrl is deprecated in favor of startOutlookOAuth async call");
  return "#"; 
}

export async function checkOutlookStatus(uid: string): Promise<{ connected: boolean; email?: string; displayName?: string }>{
  try {
    const idToken = await getIdToken();
    const resp = await fetch('/api/integrations/outlook/status', {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!resp.ok) return { connected: false };
    const json = await resp.json();
    return json;
  } catch (e) {
    console.error("Failed to check outlook status", e);
    return { connected: false };
  }
}

export async function fetchOutlookAttachments(
  uid: string,
  from: string,
  to: string,
  options?: { fileType?: string; folder?: string; jobProfileId?: string }
): Promise<{ createdCount: number; items: any[] }>{
  const payload: any = { from, to };
  if (options?.fileType) payload.fileType = options.fileType;
  if (options?.folder) payload.folder = options.folder;
  if (options?.jobProfileId) payload.jobProfileId = options.jobProfileId;
  const idToken = await getIdToken();
  const resp = await fetch('/api/integrations/outlook/sync', {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    let msg = `Failed to fetch attachments (${resp.status})`;
    try { 
      const j = await resp.json(); 
      msg = j?.error || msg; 
      if (j?.details) {
        const detailStr = typeof j.details === 'string' ? j.details : JSON.stringify(j.details);
        msg += ` | Details: ${detailStr}`;
      }
    } catch {}
    throw new Error(msg);
  }
  return await resp.json();
}

export async function disconnectOutlookIntegration(uid: string): Promise<void> {
  const idToken = await getIdToken();
  const resp = await fetch('/api/integrations/outlook/disconnect', { method: 'POST', headers: { Authorization: `Bearer ${idToken}` } });
  if (!resp.ok) {
    throw new Error(`Failed to disconnect (${resp.status})`);
  }
}
