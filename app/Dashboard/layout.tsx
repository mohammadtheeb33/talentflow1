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
        router.push("/auth/login"); 
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    // Should have redirected, but don't render children
    return null; 
  }

  return <>{children}</>;
}
