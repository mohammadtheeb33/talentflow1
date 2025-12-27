"use client";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = (pathname || "").startsWith("/auth");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 pl-64 min-w-0 overflow-x-hidden w-full">
        {children}
      </main>
    </div>
  );
}
