function isLocal() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function candidateBases(): string[] {
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
  const emulatorPort = process.env.FIREBASE_EMULATORS_FUNCTIONS_PORT || "5001";
  const remote = `https://us-central1-${project}.cloudfunctions.net`;
  const local = `http://localhost:${emulatorPort}/${project}/us-central1`;
  const forceRemote = (process.env.NEXT_PUBLIC_FORCE_REMOTE_FUNCTIONS || "") === "1";
  if (forceRemote) return [remote];
  return isLocal() ? [local, remote] : [remote];
}

async function fetchWithFallback(path: string, init: RequestInit): Promise<Response> {
  const bases = candidateBases();
  let lastErr: any = null;
  for (const base of bases) {
    const url = `${base}${path}`;
    try {
      const resp = await fetch(url, init);
      if (resp.ok) return resp;
      // If 404/500, try next base; capture error message if available
      lastErr = new Error(`HTTP ${resp.status} on ${url}`);
    } catch (e: any) {
      // Network error like Failed to fetch
      lastErr = new Error(`${e?.message || e} on ${url}`);
    }
  }
  throw lastErr || new Error("Failed to fetch from any functions base");
}

export async function startOutlookOAuth(uid: string, scopesOverride?: string, forceConsent?: boolean, tenantOverride?: string): Promise<{ authUrl: string; stateId?: string }> {
  const qs = new URLSearchParams({ uid: encodeURIComponent(uid) } as any);
  qs.set("action", "start");
  if (scopesOverride) qs.set("scopes", scopesOverride);
  if (forceConsent) qs.set("force_consent", "1");
  if (tenantOverride) qs.set("tenant", tenantOverride);
  const resp = await fetchWithFallback(
    `/outlookOAuth?${qs.toString()}`,
    { method: "GET" }
  );
  if (!resp.ok) {
    let msg = `Failed to start OAuth (${resp.status})`;
    try { const j = await resp.json(); msg = j?.error || msg; } catch {}
    throw new Error(msg);
  }
  return await resp.json();
}

// Build a URL to open the start endpoint in a popup that auto redirects to Microsoft.
export function buildOutlookStartUrl(uid: string, scopesOverride?: string, forceConsent?: boolean, tenantOverride?: string): string {
  const base = candidateBases()[0];
  const params = new URLSearchParams({ action: "start", uid: encodeURIComponent(uid), auto: "1" } as any);
  if (scopesOverride) params.set("scopes", scopesOverride);
  if (forceConsent) params.set("force_consent", "1");
  if (tenantOverride) params.set("tenant", tenantOverride);
  return `${base}/outlookOAuth?${params.toString()}`;
}

export async function checkOutlookStatus(uid: string): Promise<{ connected: boolean; email?: string; displayName?: string }>{
  // Try both bases; prefer any response that reports connected=true.
  const bases = candidateBases();
  const path = `/outlookOAuth?action=status&uid=${encodeURIComponent(uid)}&details=1`;
  let lastResult: any = null;
  let lastErr: any = null;
  for (const base of bases) {
    try {
      const resp = await fetch(`${base}${path}`, { method: "GET" });
      const json = await resp.json();
      // Prefer a connected response immediately.
      if (json && json.connected) return json as any;
      // Keep the last non-connected result to return if none are connected.
      lastResult = json;
    } catch (e: any) {
      lastErr = e;
    }
  }
  if (lastResult) return lastResult as any;
  if (lastErr) throw lastErr;
  return { connected: false } as any;
}

export async function fetchOutlookAttachments(
  uid: string,
  from: string,
  to: string,
  options?: { fileType?: string; folder?: string; jobProfileId?: string }
): Promise<{ createdCount: number; items: any[] }>{
  const payload: any = { uid, from, to };
  if (options?.fileType) payload.fileType = options.fileType;
  if (options?.folder) payload.folder = options.folder;
  if (options?.jobProfileId) payload.jobProfileId = options.jobProfileId;
  const resp = await fetchWithFallback(
    `/fetchAttachments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!resp.ok) {
    let msg = `Failed to fetch attachments (${resp.status})`;
    try { const j = await resp.json(); msg = j?.error || msg; } catch {}
    throw new Error(msg);
  }
  return await resp.json();
}