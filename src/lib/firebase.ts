import { initializeApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, ref as storageRef, getDownloadURL, connectStorageEmulator, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let appInstance: ReturnType<typeof initializeApp> | null = null;
export function getClientAuth() {
  if (typeof window === "undefined") {
    // Avoid initializing Firebase during SSR import; this is client-only.
    throw new Error("getClientAuth must be called in the browser");
  }
  if (!appInstance) {
    appInstance = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any);
  }
  return getAuth(appInstance);
}

export function getClientFirestore() {
  if (typeof window === "undefined") {
    throw new Error("getClientFirestore must be called in the browser");
  }
  if (!appInstance) {
    appInstance = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any);
  }
  const db = getFirestore(appInstance);
  try {
    const onLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const useEmulator = String(process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR || "") === "1";
    const port = Number(process.env.FIREBASE_EMULATORS_FIRESTORE_PORT || 0) || 8090;
    if (onLocalhost && useEmulator) connectFirestoreEmulator(db, "127.0.0.1", port);
  } catch (_) {
    // ignore emulator connection errors; continue with default
  }
  return db;
}

export function getClientStorage(): FirebaseStorage {
  if (typeof window === "undefined") {
    throw new Error("getClientStorage must be called in the browser");
  }
  if (!appInstance) {
    appInstance = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any);
  }
  const storage = getStorage(appInstance);
  try {
    const onLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const useEmulator = String(process.env.NEXT_PUBLIC_USE_STORAGE_EMULATOR || "") === "1";
    const port = Number(process.env.FIREBASE_EMULATORS_STORAGE_PORT || 0) || 9199;
    // Connect to emulator only when explicitly enabled
    if (onLocalhost && useEmulator) connectStorageEmulator(storage, "127.0.0.1", port);
  } catch (_) {
    // Best-effort; ignore if emulator connection fails
  }
  return storage;
}

export async function getCvDownloadUrl(storagePath: string): Promise<string> {
  const storage = getClientStorage();
  try {
    const r = storageRef(storage, storagePath);
    return await getDownloadURL(r);
  } catch (e) {
    // Fallback for emulator direct URL
    try {
      const bucket = String(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "");
      const useEmulator = String(process.env.NEXT_PUBLIC_USE_STORAGE_EMULATOR || "") === "1";
      const host = useEmulator ? "http://127.0.0.1:" + (process.env.FIREBASE_EMULATORS_STORAGE_PORT || 9199) : "https://firebasestorage.googleapis.com";
      const b = bucket.endsWith(".appspot.com") || bucket.endsWith(".firebasestorage.app") ? bucket : `${bucket}`;
      const encoded = encodeURIComponent(storagePath);
      // New domain supports both; use legacy path format for emulator fallback
      return `${host}/v0/b/${b}/o/${encoded}?alt=media`;
    } catch (_) {
      throw e;
    }
  }
}

export async function ensureUid(): Promise<string> {
  try {
    const auth = getClientAuth();
    const existing = auth.currentUser;
    if (existing?.uid) return existing.uid;
    await new Promise<User | null>((resolve) => onAuthStateChanged(auth, resolve));
    if (auth.currentUser?.uid) return auth.currentUser.uid;
    await signInAnonymously(auth);
    await new Promise<User | null>((resolve) => onAuthStateChanged(auth, resolve));
    if (!auth.currentUser?.uid) throw new Error("Unable to establish user session");
    return auth.currentUser.uid;
  } catch (e: any) {
    const code = String(e?.code || "").toLowerCase();
    const msg = String(e?.message || "").toLowerCase();
    const missingKey = !process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const onLocalhost = (typeof window !== "undefined") && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const forceDev = (process.env.NEXT_PUBLIC_FORCE_DEV_UID || "") === "1";
    const shouldFallback = missingKey
      || msg.includes("invalid-api-key")
      || code.includes("admin-restricted-operation")
      || code.includes("operation-not-allowed")
      || code.includes("network-request-failed")
      || code.includes("config")
      // Do NOT fallback just because we're on localhost; if Firebase config is valid,
      // we should sign in anonymously to access protected resources.
      // || onLocalhost
      || forceDev;

    if (shouldFallback) {
      // Local/dev fallback: generate a stable pseudo UID for functions
      try {
        const key = "dev:uid";
        let devUid = window.localStorage.getItem(key);
        if (!devUid) {
          devUid = `dev-${Math.random().toString(36).slice(2)}`;
          window.localStorage.setItem(key, devUid);
        }
        return devUid!;
      } catch (_) {
        return `dev-${Date.now()}`;
      }
    }
    throw e;
  }
}