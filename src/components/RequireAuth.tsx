"use client";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  // Authentication protection is now handled by:
  // 1. middleware.ts (Server-side redirect)
  // 2. app/dashboard/layout.tsx (Client-side loading state)
  return <>{children}</>;
}

