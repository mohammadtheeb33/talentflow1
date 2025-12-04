"use client";
import { useSearchParams, useRouter } from "next/navigation";
import LoginForm from "./sign-in-form";
import { useState, useEffect } from "react";
import { ConnectOutlookModal } from "@/components/ConnectOutlookModal";
import { getClientAuth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function LoginClient() {
  const params = useSearchParams();
  const router = useRouter();
  const tenant = params.get("tenant") || "consumers";
  const showModalParam = params.get("outlook") === "1";
  const [showOutlook, setShowOutlook] = useState(false);
  useEffect(() => { if (showModalParam) setShowOutlook(true); }, [showModalParam]);

  // After successful login, redirect to ?next or fallback to Dashboard
  useEffect(() => {
    try {
      const auth = getClientAuth();
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user && !user.isAnonymous) {
          const nextDest = params.get("next") || "/Dashboard";
          router.replace(nextDest);
        }
      });
      return () => { try { unsub(); } catch (_) {} };
    } catch (_) {}
  }, [params, router]);
  return (
    <main className="mx-auto max-w-md rounded-lg border bg-white p-6">
      <h1 className="text-lg font-semibold">Sign in</h1>
      <p className="mt-1 text-xs text-gray-600">Use your email and password or continue with Outlook.</p>

      <div className="mt-4">
        <LoginForm />
      </div>

      <div className="mt-6">
        <div className="mb-2 text-xs text-gray-500">Outlook</div>
        <div className="flex items-center gap-3">
          <a
            href={`/auth/login?provider=outlook&tenant=${tenant}`}
            className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50"
          >
            Continue with Outlook ({tenant})
          </a>
          <a
            href={`/auth/login?provider=outlook&tenant=${tenant === "consumers" ? "organizations" : "consumers"}`}
            className="text-xs text-indigo-600 hover:underline"
          >
            Switch tenant
          </a>
          <button
            onClick={() => setShowOutlook(true)}
            className="rounded-md border bg-white px-3 py-2 text-xs hover:bg-gray-50"
          >
            Connect Outlook…
          </button>
        </div>
      </div>
      {showOutlook && <ConnectOutlookModal isOpen={showOutlook} onClose={() => setShowOutlook(false)} />}
    </main>
  );
}