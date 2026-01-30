"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getClientAuth, getClientFirestore } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function mapAuthError(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "Email already exists";
    case "auth/invalid-email":
      return "Invalid email address";
    case "auth/weak-password":
      return "Password is too weak";
    case "auth/operation-not-allowed":
      return "Email/password accounts are not enabled";
    case "auth/network-request-failed":
      return "Network connection failed";
    default:
      return "Failed to create account";
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!fullName.trim()) {
      setMessage("Full name is required");
      return;
    }
    if (!email.trim()) {
      setMessage("Email is required");
      return;
    }
    if (!password) {
      setMessage("Password is required");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const auth = getClientAuth();
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (fullName.trim()) {
        await updateProfile(credential.user, { displayName: fullName.trim() });
      }
      const db = getClientFirestore();
      await setDoc(doc(db, "users", credential.user.uid), {
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: fullName.trim(),
        role: "user",
        plan: "free",
        credits_limit: 5,
        credits_used: 0,
        createdAt: serverTimestamp()
      });
      toast.success("Account created");
      router.push("/dashboard");
    } catch (error: any) {
      const code = String(error?.code || "");
      setMessage(mapAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan-400/20 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-indigo-500/20 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-purple-500/20 blur-[160px]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-[0_0_40px_rgba(15,23,42,0.1)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_0_40px_rgba(15,23,42,0.6)]">
          <div className="mb-6 space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Create your Account</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Get started with TalentFlow in minutes.</p>
          </div>

          {message && (
            <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-200">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:border-cyan-500/60 focus:ring-cyan-500/30 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-400"
                placeholder="Jane Recruiter"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:border-cyan-500/60 focus:ring-cyan-500/30 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-400"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:border-cyan-500/60 focus:ring-cyan-500/30 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-400"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:border-cyan-500/60 focus:ring-cyan-500/30 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-400"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_25px_rgba(99,102,241,0.35)] transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
