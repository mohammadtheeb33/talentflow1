import { Suspense } from "react";
import { AdminLoginClient } from "./client";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Loading admin login…</div>}>
      <AdminLoginClient />
    </Suspense>
  );
}
