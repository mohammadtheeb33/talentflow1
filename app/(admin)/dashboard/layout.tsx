"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientAuth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const router = useRouter();

  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setStatus("authenticated");
      } else {
        setStatus("unauthenticated");
        // Fallback: if middleware missed it (e.g. cookie expired but page open), redirect.
        // But mainly relying on middleware.
        router.push("/login"); 
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (status === "loading") {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/3 h-72 w-72 rounded-full bg-indigo-500/20 blur-[120px] dark:bg-indigo-500/25" />
          <div className="absolute top-1/2 -left-10 h-72 w-72 rounded-full bg-cyan-400/15 blur-[140px] dark:bg-cyan-400/20" />
          <div className="absolute -bottom-40 right-10 h-72 w-72 rounded-full bg-purple-500/20 blur-[140px] dark:bg-purple-500/25" />
        </div>
        <div className="relative flex flex-col items-center gap-4 rounded-3xl border border-slate-200/60 bg-white/70 px-8 py-7 backdrop-blur-xl shadow-xl shadow-slate-200/40 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-500 dark:text-cyan-300" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    // Should have redirected, but don't render children
    return null; 
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 h-72 w-72 rounded-full bg-indigo-500/25 blur-[120px] dark:bg-indigo-500/30" />
        <div className="absolute top-1/2 -left-20 h-72 w-72 rounded-full bg-cyan-400/15 blur-[140px] dark:bg-cyan-400/20" />
        <div className="absolute -bottom-40 right-10 h-72 w-72 rounded-full bg-purple-500/20 blur-[140px] dark:bg-purple-500/25" />
      </div>
      <main className="relative w-full h-full">
        {children}
      </main>
    </div>
  );
}
