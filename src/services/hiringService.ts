import { getClientFirestore, getClientAuth } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

export type HiringStatus = "accepted" | "rejected" | "undecided";

export async function updateHiringStatus(candidateId: string, status: HiringStatus) {
  const db = getClientFirestore();
  const auth = getClientAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("User must be logged in to update hiring status");
  }

  const ref = doc(db, "cvs", candidateId);
  
  await updateDoc(ref, {
    hiringStatus: status,
    decidedAt: serverTimestamp(),
    decidedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
}
