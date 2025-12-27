import { getClientFirestore, getClientAuth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function validateOutlookScopes(uid: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const db = getClientFirestore();
    const tokenSnap = await getDoc(doc(db, "users", uid, "tokens", "outlook"));
    if (!tokenSnap.exists()) return { valid: false, error: "Not connected" };
    
    const data = tokenSnap.data();
    const scopes = (data?.scope || "").toLowerCase();
    
    // If no scopes recorded, assume valid (legacy) or invalid depending on strictness.
    // We'll assume valid to avoid breaking old tokens, but the send guard catches it.
    if (!scopes) return { valid: true };

    if (!scopes.includes("mail.send")) {
      return { valid: false, error: "Missing sending permissions. Please reconnect Outlook." };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: "Failed to check permissions" };
  }
}

/**
 * Sends an email using the authenticated user's Outlook account via Microsoft Graph API.
 * Requires a valid access token stored in Firestore (or available to the client).
 */
export async function sendOutlookEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const auth = getClientAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("User not authenticated");

  // 1. Retrieve Access Token
  // We attempt to find the token in likely Firestore locations where the backend might have stored it.
  const db = getClientFirestore();
  let token: string | null = null;

  // Strategy 1: Check users/{uid}/tokens/outlook (Common pattern for secure token storage)
  try {
    const tokenSnap = await getDoc(doc(db, "users", uid, "tokens", "outlook"));
    if (tokenSnap.exists()) {
      token = tokenSnap.data()?.access_token;
    }
  } catch (e) {
    console.warn("Could not read users/{uid}/tokens/outlook", e);
  }

  // Strategy 2: Check users/{uid} root document (Less secure but possible)
  if (!token) {
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        // Check various potential field names
        token = data?.outlookAccessToken || data?.outlook?.access_token || data?.tokens?.outlook?.access_token;
      }
    } catch (e) {
      console.warn("Could not read users/{uid}", e);
    }
  }

  if (!token) {
    // If we can't find the token, we cannot call Graph API directly from client.
    // The user might need to reconnect to refresh the token or the backend might need to expose it.
    throw new Error("Outlook access token not found or expired. Please reconnect Outlook in the login screen.");
  }

  // 3. Runtime Guard for Scopes
  // We check if the stored token actually has the required scopes (if scope field was saved)
  // If scope field is missing (old tokens), we proceed but warn if it fails.
  try {
     const tokenSnap = await getDoc(doc(db, "users", uid, "tokens", "outlook"));
     if (tokenSnap.exists()) {
       const d = tokenSnap.data();
       const scopes = (d?.scope || "").toLowerCase();
       // Only enforce if we actually have scopes saved (new flow)
       if (scopes && !scopes.includes("mail.send")) {
         throw new Error("Missing 'Mail.Send' permission. Please disconnect and reconnect Outlook to grant sending permissions.");
       }
     }
  } catch (e: any) {
    if (e.message && e.message.includes("Missing 'Mail.Send'")) throw e;
    // Ignore read errors, let the API call fail if invalid
  }

  // 2. Call Microsoft Graph API
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        subject: subject,
        body: {
          contentType: "HTML",
          content: htmlBody
        },
        toRecipients: [
          {
            emailAddress: {
              address: to
            }
          }
        ]
      },
      saveToSentItems: "true"
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData?.error?.message || response.statusText;
    
    // Handle expired token specifically if possible (401)
    if (response.status === 401) {
       throw new Error("Outlook session expired. Please reconnect Outlook.");
    }
    
    throw new Error(`Outlook API Failed: ${errMsg}`);
  }
}
