import { doc, getDoc } from "firebase/firestore";
import { getClientFirestore } from "@/lib/firebase";

export const ADMINS: string[] = [
  "admin@example.com"
];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const x = email.toLowerCase();
  return ADMINS.some(e => e.toLowerCase() === x);
}

export async function isAdminUser(user: { uid?: string; email?: string | null } | null): Promise<boolean> {
  if (!user) return false;
  if (isAdminEmail(user.email || null)) return true;
  const uid = user.uid;
  if (!uid) return false;
  try {
    const db = getClientFirestore();
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return false;
    const role = snap.data()?.role;
    return role === "admin";
  } catch {
    return false;
  }
}
