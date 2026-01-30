"use client";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { getClientAuth } from "@/lib/firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { isAdminUser } from "@/config/admins";
import { createUserInFirestore } from "@/lib/auth";

const ConnectOutlookModal = dynamic(
  () => import("@/components/ConnectOutlookModal").then((mod) => mod.ConnectOutlookModal),
  { ssr: false }
);

export function LoginClient() {
  const params = useSearchParams();
  const router = useRouter();
  const showModalParam = params.get("outlook") === "1";
  const [showOutlook, setShowOutlook] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (showModalParam) setShowOutlook(true); }, [showModalParam]);

  // After successful login, set cookie and redirect
  useEffect(() => {
    try {
      const auth = getClientAuth();
      const unsub = onAuthStateChanged(auth, async (user) => {
        if (user && !user.isAnonymous) {
          const maxAge = 60 * 60 * 24 * 30;
          const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `auth_token=true; Max-Age=${maxAge}; path=/; SameSite=Lax${secure}`;
          router.refresh();
          const nextParam = params.get("next");
          if (nextParam) {
            router.replace(nextParam);
            return;
          }
          await createUserInFirestore(user);
          const adminOk = await isAdminUser({ uid: user.uid, email: user.email });
          router.replace(adminOk ? "/admin" : "/dashboard");
        }
      });
      return () => { try { unsub(); } catch (_) {} };
    } catch (_) {}
  }, [params, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = getClientAuth();
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (_) {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-cyan-400/20 blur-[140px]"
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-indigo-500/20 blur-[160px]"
          animate={{ x: [0, -30, 20, 0], y: [0, 20, -20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-purple-500/20 blur-[170px]"
          animate={{ x: [0, 20, -30, 0], y: [0, 30, -10, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-[0_0_40px_rgba(15,23,42,0.1)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_0_40px_rgba(15,23,42,0.6)]"
        >
          <div className="mb-6 space-y-2">
            <h1 className="text-3xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 dark:from-cyan-300 dark:via-indigo-300 dark:to-purple-300">
              Welcome Back
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Sign in to continue to TalentFlow.</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-200">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-cyan-400/60 dark:focus:ring-cyan-500/50"
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-cyan-400/60 dark:focus:ring-cyan-500/50"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border border-slate-300 bg-white text-cyan-600 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-700 dark:bg-slate-900/50 dark:text-cyan-400 dark:focus:ring-cyan-500/50"
                />
                Remember me
              </label>
              <Link href="/login?forgot=1" className="text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200">
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_25px_rgba(99,102,241,0.45)] transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Don't have an account?{" "}
            <Link href="/register" className="font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200">
              Create one
            </Link>
          </div>
        </motion.div>
      </div>

      {showOutlook && <ConnectOutlookModal isOpen={showOutlook} onClose={() => setShowOutlook(false)} />}
    </div>
  );
}
