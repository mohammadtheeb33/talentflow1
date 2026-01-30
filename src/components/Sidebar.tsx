"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getClientAuth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { 
  Users, 
  Briefcase, 
  FileBarChart, 
  LogOut, 
} from "lucide-react";

const links = [
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/job-profiles", label: "Jobs", icon: Briefcase },
  { href: "/reports", label: "Reports", icon: FileBarChart },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>("TF");
  const isAuthRoute = (pathname || "").startsWith("/auth");

  useEffect(() => {
    if (isAuthRoute) return;
    try {
      const auth = getClientAuth();
      const unsub = auth.onAuthStateChanged(async (u) => {
        if (u) {
          // If user is anonymous, force logout
          if (u.isAnonymous) {
            try {
              document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
              await signOut(auth);
              router.push("/login");
              return;
            } catch (_) {}
          }
          
          const name = u.displayName || null;
          const em = u.email || null;
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
        } else {
          setDisplayName(null);
          setEmail(null);
        }
      });
      return () => unsub();
    } catch (_) {
      // ignore
    }
  }, [isAuthRoute, router]);

  if (isAuthRoute) return null;

  const isActive = (path: string) => {
    if (path === "/dashboard" && pathname === "/dashboard") return true;
    if (path !== "/dashboard" && pathname?.startsWith(path)) return true;
    return false;
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md">
            <span className="text-xs font-bold">TF</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">TalentFlow</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-6">
        {links.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-indigo-600" : "text-gray-500 group-hover:text-gray-600"}`} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700">
            {initials}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-gray-900">{displayName || "User"}</p>
            <p className="truncate text-xs text-gray-500">{email || "Guest"}</p>
          </div>
          <button
            onClick={async () => {
              try {
                // Clear the middleware cookie
                document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
                const auth = getClientAuth();
                await signOut(auth);
                router.push("/login");
                router.refresh();
              } catch (_) {}
            }}
            className="text-gray-400 hover:text-gray-600"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
