import { getClientFirestore } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export interface PipelineStats {
  accepted: number;
  rejected: number;
  total: number;
}

export async function getPipelineStats(uid: string): Promise<PipelineStats> {
  const db = getClientFirestore();
  const cvsRef = collection(db, "cvs");

  try {
    // OPTION A: Fetch documents and aggregate in memory
    // This avoids "Missing Index" errors associated with complex 'OR' queries in Firestore
    // and ensures we handle the legacy 'userId' vs new 'uid' overlap correctly.
    
    // 1. Run queries in parallel
    const [uidSnap, userIdSnap] = await Promise.all([
      getDocs(query(cvsRef, where("uid", "==", uid))),
      getDocs(query(cvsRef, where("userId", "==", uid)))
    ]);

    // 2. Merge results to handle potential duplicates (deduplication by ID)
    const uniqueDocs = new Map();

    uidSnap.forEach((doc) => {
      uniqueDocs.set(doc.id, doc.data());
    });

    userIdSnap.forEach((doc) => {
      if (!uniqueDocs.has(doc.id)) {
        uniqueDocs.set(doc.id, doc.data());
      }
    });

    // 3. Compute stats
    let accepted = 0;
    let rejected = 0;
    const total = uniqueDocs.size;

    uniqueDocs.forEach((data) => {
      const status = (data.hiringStatus || "").toLowerCase();
      if (status === "accepted") accepted++;
      if (status === "rejected") rejected++;
    });

    return { accepted, rejected, total };

  } catch (error) {
    console.error("Failed to fetch pipeline stats:", error);
    return { accepted: 0, rejected: 0, total: 0 };
  }
}
