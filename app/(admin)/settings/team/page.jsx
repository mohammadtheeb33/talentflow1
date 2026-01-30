"use client";

import React, { useState, useEffect } from 'react';
import dynamic from "next/dynamic";
import { getClientAuth, getClientFirestore } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, where } from "firebase/firestore";
import { createUserInFirestore, getUserRole, ROLES } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Trash2, Shield, Mail, Calendar, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
const InviteMemberModal = dynamic(() => import("@/components/InviteMemberModal"), { ssr: false });
import Link from 'next/link';

export default function TeamPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Only access client-side auth inside useEffect
    const auth = getClientAuth();
    
    const checkAuth = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const role = await getUserRole(user.uid);
        if (role === ROLES.ADMIN) {
          setIsAdmin(true);
        } else if (!role) {
          await createUserInFirestore(user, ROLES.ADMIN);
          setIsAdmin(true);
        } else {
          toast.error("You do not have permission to view this page.");
          router.push('/dashboard');
        }
      } catch (error) {
        console.error("Error checking role:", error);
        toast.error("Failed to verify permissions.");
      }
    };

    // Listen to auth state to ensure we have a user before checking role
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
        if (user) {
            checkAuth();
        } else {
            router.push('/login');
        }
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!isAdmin) return;

    const db = getClientFirestore();
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      toast.error("Failed to load team members.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const handleRemoveMember = async (userId, userRole) => {
    if (userRole === ROLES.ADMIN) {
        toast.error("Cannot remove an admin user.");
        return;
    }
    
    if (confirm("Are you sure you want to remove this team member?")) {
      try {
        const db = getClientFirestore();
        await deleteDoc(doc(db, "users", userId));
        toast.success("Team member removed successfully.");
      } catch (error) {
        console.error("Error removing member:", error);
        toast.error("Failed to remove member.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <div className="flex items-center gap-2 mb-2">
                <Link href="/settings" className="text-gray-500 hover:text-gray-700 transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
            </div>
            <p className="text-sm text-gray-500">Manage your team's access and roles.</p>
        </div>
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <UserPlus className="h-4 w-4" />
          Invite Member
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                        <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p>No team members found.</p>
                    </td>
                </tr>
              ) : (
                users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-semibold">
                              {(user.displayName?.[0] || user.email?.[0] || "U").toUpperCase()}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.displayName || "No Name"}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            user.role === ROLES.ADMIN 
                                ? "bg-purple-100 text-purple-800"
                                : user.role === ROLES.HR
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                        }`}>
                          <Shield className="h-3 w-3" />
                          {user.role === ROLES.ADMIN ? "Admin" : user.role === ROLES.HR ? "HR" : "Interviewer"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          user.status === 'active' 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {user.status === 'active' ? "Active" : "Invited"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {user.createdAt?.seconds 
                                ? format(new Date(user.createdAt.seconds * 1000), 'MMM d, yyyy')
                                : "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {user.role !== ROLES.ADMIN && (
                            <button 
                                onClick={() => handleRemoveMember(user.id, user.role)}
                                className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove Member"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <InviteMemberModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
      />
    </main>
  );
}
