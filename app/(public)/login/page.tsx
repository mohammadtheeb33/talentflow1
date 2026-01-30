import { Suspense } from "react";
import { LoginClient } from "./client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Loading login…</div>}>
      <LoginClient />
    </Suspense>
  );
}

// Client logic moved to ./client to satisfy useSearchParams requirements