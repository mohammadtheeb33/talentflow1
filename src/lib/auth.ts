import { getClientFirestore } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";

export const ROLES = {
  ADMIN: 'admin',
  HR: 'hr',
  INTERVIEWER: 'interviewer'
};

export async function getUserRole(uid: string) {
  const db = getClientFirestore();
  const userDoc = await getDoc(doc(db, "users", uid));
  if (userDoc.exists()) {
    return userDoc.data().role;
  }
  return null;
}

export async function createUserInFirestore(user: any, role = 'member') {
    const db = getClientFirestore();
    const userRef = doc(db, "users", user.uid);
    // Only set if not exists to avoid overwriting roles
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || "",
            role: role,
            status: 'active',
            createdAt: serverTimestamp()
        });
    }
}

export async function inviteUser(email: string, role: string) {
    const db = getClientFirestore();
    // In a real app, this would call a backend function to send an email and create a placeholder.
    // Here we will create a placeholder user document or an invite document.
    // We'll create a user document with a generated ID to show up in the list.
    // The status will be 'invited'.
    
    // We use email as a temporary reference or just add to users collection
    // Since we don't have UID, we'll let Firestore generate one for the placeholder
    const usersRef = collection(db, "users");
    await addDoc(usersRef, {
        email,
        role,
        status: 'invited',
        displayName: 'Pending Invitation',
        createdAt: serverTimestamp(),
        invitedAt: serverTimestamp()
    });
}
