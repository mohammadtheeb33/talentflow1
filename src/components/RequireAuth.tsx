"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getClientAuth, ensureUid } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      const onLocalhost = (typeof window !== "undefined") && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      // Skip protection for auth routes
      if ((pathname || "").startsWith("/auth")) {
        setReady(true);
        return;
      }
      const auth = getClientAuth();
      const u = auth.currentUser;
      if (!u || u.isAnonymous) {
        // Attempt local/dev guest fallback using ensureUid
        (async () => {
          try {
            const uid = await ensureUid();
            const isDevGuest = typeof uid === "string" && uid.startsWith("dev-");
            if (isDevGuest || onLocalhost) {
              // Allow rendering for local dev guest sessions
              setReady(true);
              return;
            }
          } catch (_) {
            // ignore and proceed to redirect
          }
          // Strong redirect to login
          const dest = `/auth/login?next=${encodeURIComponent(pathname || "/")}`;
          try { router.replace(dest); } catch (_) {}
          // Fallback to hard navigation in case router fails
          setTimeout(() => {
            try {
              if (typeof window !== "undefined") window.location.href = dest;
            } catch (_) {}
          }, 200);
        })();
      } else {
        setReady(true);
      }
      unsub = onAuthStateChanged(auth, (user) => {
        if (!user) {
          const dest = `/auth/login?next=${encodeURIComponent(pathname || "/")}`;
          try { router.replace(dest); } catch (_) {}
          setTimeout(() => {
            try { if (typeof window !== "undefined") window.location.href = dest; } catch (_) {}
          }, 200);
        } else if (user.isAnonymous && onLocalhost) {
          setReady(true);
        } else {
          setReady(true);
        }
      });
    } catch (_) {
      const dest = `/auth/login?next=${encodeURIComponent(pathname || "/")}`;
      try { router.replace(dest); } catch (_) {}
      setTimeout(() => {
        try { if (typeof window !== "undefined") window.location.href = dest; } catch (_) {}
      }, 200);
    }
    return () => {
      try { unsub && unsub(); } catch (_) {}
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-pulse rounded bg-gray-200 px-4 py-2 text-sm text-gray-600">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}