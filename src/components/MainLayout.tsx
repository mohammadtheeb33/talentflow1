"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import TopNavigation from "@/components/TopNavigation";
import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = (pathname || "").startsWith("/auth");
  const isAdminConsole = (pathname || "").startsWith("/admin");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  useEffect(() => {
    try {
      const auth = getClientAuth();
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user && !user.isAnonymous) {
          const maxAge = 60 * 60 * 24 * 30;
          const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `auth_token=true; Max-Age=${maxAge}; path=/; SameSite=Lax${secure}`;
        } else {
          document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        }
      });
      return () => { try { unsub(); } catch (_) {} };
    } catch (_) {}
  }, []);

  if (isAdminConsole) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_10%_12%,rgba(99,102,241,0.18),transparent_55%)] dark:bg-[radial-gradient(600px_circle_at_10%_12%,rgba(99,102,241,0.22),transparent_55%)]" />
      </div>
      <div className="relative z-10">
        <TopNavigation />
        <main className="flex-1 w-full max-w-[100vw]">
          {children}
        </main>
      </div>
    </div>
  );
}
