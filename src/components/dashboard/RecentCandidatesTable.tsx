"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getClientAuth, getClientFirestore } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

interface Candidate {
  id: string;
  name: string;
  role: string;
  source: string;
  score: number;
  status: string;
}

export default function RecentCandidatesTable() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const auth = getClientAuth();
        const user = auth.currentUser;
        
        if (!user) {
            setLoading(false);
            return;
        }

        const db = getClientFirestore();
        const cvsRef = collection(db, "cvs");
        
        const q = query(
          cvsRef, 
          where("uid", "==", user.uid), 
          orderBy("createdAt", "desc"), 
          limit(5)
        );
        
        const snapshot = await getDocs(q);
        const fetchedCandidates = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.parsed?.name || data.name || "Unnamed Candidate",
            role: data.parsed?.jobTitle || data.jobTitle || "Unknown Role",
            source: data.source || "Upload",
            score: typeof data.score === 'number' ? Math.round(data.score) : (typeof data.matchScore === 'number' ? Math.round(data.matchScore) : 0),
            status: data.hiringStatus 
              ? (data.hiringStatus.charAt(0).toUpperCase() + data.hiringStatus.slice(1)) 
              : (data.status || "New")
          };
        });
        
        setCandidates(fetchedCandidates);
      } catch (error) {
        console.error("Error fetching recent candidates:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden min-h-[400px]">
      <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-gray-50/50">
        <h3 className="text-lg font-semibold text-gray-900">Recent Candidates</h3>
        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
          Live Updates
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-6 py-3 font-medium">Candidate</th>
              <th className="px-6 py-3 font-medium">Role</th>
              <th className="px-6 py-3 font-medium">Source</th>
              <th className="px-6 py-3 font-medium">Match Score</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-20 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-20 bg-gray-100 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : candidates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No candidates found. Start by importing or uploading a CV.
                </td>
              </tr>
            ) : (
              candidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-gray-50/50 transition-colors h-[73px]">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <Link href={`/cvs/${candidate.id}`} className="hover:text-indigo-600">
                      {candidate.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">{candidate.role}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      {candidate.source}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-24 rounded-full bg-gray-100">
                        <div
                          className={`h-2 rounded-full ${
                            candidate.score >= 80 ? "bg-green-500" : candidate.score >= 60 ? "bg-yellow-500" : "bg-red-500"
                          }`}
                          style={{ width: `${candidate.score}%` }}
                        />
                      </div>
                      <span className="font-semibold text-gray-900">{candidate.score}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        candidate.status === "Interview" || candidate.status === "Accepted"
                          ? "bg-green-100 text-green-800"
                          : candidate.status === "Rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {candidate.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 text-center">
        <Link href="/cvs">
          <button className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            View All Candidates &rarr;
          </button>
        </Link>
      </div>
    </section>
  );
}
