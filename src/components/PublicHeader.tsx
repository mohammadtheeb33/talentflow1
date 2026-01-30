"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

export default function PublicHeader() {
  const pathname = usePathname();
  const hideHeader = pathname.startsWith("/login") || pathname.startsWith("/admin/login");

  if (hideHeader) return null;

  return (
    <header className="flex items-center justify-between border-b border-slate-200/60 bg-white/70 px-6 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/40">
      <Link href="/" className="font-bold text-xl text-indigo-600 tracking-tight">
        TalentFlow
      </Link>
      <ThemeToggle />
    </header>
  );
}
