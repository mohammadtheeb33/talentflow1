"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getClientAuth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cvs", label: "Candidates" },
  { href: "/job-profiles", label: "Jobs" },
  { href: "/reports", label: "Reports" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>("TF");
  const isAuthRoute = (pathname || "").startsWith("/auth");

  useEffect(() => {
    // Skip auth route; still call the hook to keep hook order stable
    if (isAuthRoute) return;
    try {
      const auth = getClientAuth();
      const u = auth.currentUser;
      const name = u?.displayName || null;
      const em = u?.email || null;
      setDisplayName(name);
      setEmail(em);
      const base = (name || em || "").trim();
      if (base) {
        const parts = base.split(/\s+/).filter(Boolean);
        const first = parts[0] || "";
        const last = parts.length > 1 ? parts[parts.length - 1] : "";
        const init = (first.slice(0, 1) + (last.slice(0, 1) || "")).toUpperCase();
        setInitials(init || base.slice(0, 2).toUpperCase());
      }
    } catch (_) {
      // ignore if auth not ready; initials remain default
    }
  }, [isAuthRoute]);

  // Hide the navbar on authentication routes like /auth/*
  if (isAuthRoute) {
    return null;
  }
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md">
              <span className="text-xs font-bold">TF</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">TalentFlow</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={
                  `rounded-md px-3 py-2 text-sm font-medium transition-colors ` +
                  (pathname === l.href 
                    ? "bg-indigo-50 text-indigo-700" 
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900")
                }
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-gray-900">{displayName || "User"}</div>
            <div className="text-xs text-gray-500">{email || "Guest"}</div>
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700 ring-2 ring-transparent transition-all hover:bg-indigo-200 focus:outline-none focus:ring-indigo-500"
              aria-haspopup="menu"
              aria-expanded={menuOpen ? "true" : "false"}
            >
              {initials}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none animate-in fade-in zoom-in-95 duration-100">
                <div className="border-b px-4 py-2 sm:hidden">
                  <div className="font-medium text-gray-900">{displayName}</div>
                  <div className="text-xs text-gray-500">{email}</div>
                </div>
                <Link href="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Settings</Link>
                <button
                  onClick={async () => {
                    try {
                      // Clear the middleware cookie
                      document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
                      const auth = getClientAuth();
                      await signOut(auth);
                      router.push("/auth/login");
                      router.refresh();
                    } catch (_) {}
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}