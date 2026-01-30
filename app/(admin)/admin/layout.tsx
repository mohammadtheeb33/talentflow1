"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getClientAuth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { isAdminUser } from "@/config/admins";
import { LayoutDashboard, Users, Settings, LifeBuoy, FileText, Search, Bell, UserCircle2, LogOut } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const auth = getClientAuth();
    let active = true;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      if (!user) {
        setStatus("denied");
        router.push("/admin/login");
        return;
      }
      const ok = await isAdminUser({ uid: user.uid, email: user.email });
      if (!active) return;
      if (!ok) {
        setStatus("denied");
        router.push("/dashboard");
      } else {
        setStatus("allowed");
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, [router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200/60 bg-white/70 px-6 py-5 shadow-xl shadow-slate-200/40 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-slate-600 dark:text-slate-300">Loading admin...</p>
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return null;
  }

  const links = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/ai-config", label: "AI Config", icon: Settings },
    { href: "/admin/support", label: "Support", icon: LifeBuoy },
    { href: "/admin/logs", label: "System Logs", icon: FileText },
  ];

  const handleLogout = async () => {
    try {
      document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      const auth = getClientAuth();
      await signOut(auth);
      router.replace("/admin/login");
      router.refresh();
    } catch (_) {}
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 h-72 w-72 rounded-full bg-indigo-500/25 blur-[120px] dark:bg-indigo-500/30" />
        <div className="absolute top-1/2 -left-20 h-72 w-72 rounded-full bg-cyan-400/15 blur-[140px] dark:bg-cyan-400/20" />
        <div className="absolute -bottom-40 right-10 h-72 w-72 rounded-full bg-purple-500/20 blur-[140px] dark:bg-purple-500/25" />
      </div>
      <div className="relative grid grid-cols-12 gap-0">
        <aside className="col-span-12 md:col-span-3 lg:col-span-2 border-r border-slate-200/60 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div className="px-5 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-400 shadow-[0_0_25px_rgba(99,102,241,0.45)]">
                <span className="text-sm font-bold text-white">A</span>
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-900 dark:text-white">Admin Dock</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Control Center</p>
              </div>
            </div>
          </div>
          <nav className="px-3 pb-6 space-y-1">
            {links.map((l) => {
              const Icon = l.icon;
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-slate-200/70 text-slate-900 shadow-[0_0_20px_rgba(56,189,248,0.18)] dark:bg-white/10 dark:text-white dark:shadow-[0_0_20px_rgba(56,189,248,0.25)]"
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-cyan-500 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)] dark:text-cyan-300 dark:drop-shadow-[0_0_6px_rgba(34,211,238,0.9)]" : "text-slate-400 dark:text-slate-400"}`} />
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="col-span-12 md:col-span-9 lg:col-span-10 p-6 md:p-8">
          <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users, logs, or settings..."
                  className="w-full rounded-2xl border border-slate-200/60 bg-white/80 px-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <button className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/60 bg-white/70 text-slate-600 hover:bg-slate-100/80 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]" />
                </button>
                <button className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/70 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100/80 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
                  <UserCircle2 className="h-5 w-5 text-cyan-500 dark:text-cyan-300" />
                  <span className="hidden sm:inline">Admin</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/70 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100/80 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  title="Sign out"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </header>
            <div>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
