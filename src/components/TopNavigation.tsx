"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, Briefcase, LayoutDashboard, Users, FileBarChart, LifeBuoy, Calendar, X, LogOut, User, Settings } from "lucide-react";
import { getClientAuth, getClientFirestore } from "@/lib/firebase";
import { useEffect, useState, useRef } from "react";
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { formatDistanceToNow } from "date-fns";
import ThemeToggle from "@/components/ThemeToggle";

export default function TopNavigation() {
  const pathname = usePathname();
  const [userInitials, setUserInitials] = useState("U");
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);
  const [creditsLimit, setCreditsLimit] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  
  // Notification State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      const auth = getClientAuth();
      // Clear cookie
      document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
      await signOut(auth);
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // Real-time notifications
  useEffect(() => {
    const auth = getClientAuth();
    const db = getClientFirestore();
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
        if (user) {
            // Setup notification listener
            // Try with composite index (uid + timestamp desc)
            const q = query(
                collection(db, "notifications"),
                where("uid", "==", user.uid),
                orderBy("timestamp", "desc"),
                limit(10)
            );

            unsubscribeNotifications = onSnapshot(q, (snapshot) => {
                const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setNotifications(notifs);
                setUnreadCount(notifs.filter((n: any) => !n.isRead).length);
            }, (error) => {
                console.warn("Notification query failed (likely missing index):", error);
                // Fallback: simple query + client-side sort
                const qFallback = query(
                    collection(db, "notifications"),
                    where("uid", "==", user.uid),
                    limit(20) 
                );
                
                unsubscribeNotifications = onSnapshot(qFallback, (snapshot) => {
                     const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                     // Client side sort
                     notifs.sort((a: any, b: any) => {
                        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (new Date(a.createdAt || 0).getTime());
                        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (new Date(b.createdAt || 0).getTime());
                        return tB - tA;
                     });
                     setNotifications(notifs.slice(0, 10));
                     setUnreadCount(notifs.filter((n: any) => !n.isRead).length);
                });
            });
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    });

    return () => {
        unsubscribeAuth();
        if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, []);

  useEffect(() => {
    const auth = getClientAuth();
    const db = getClientFirestore();
    let unsubscribeProfile: (() => void) | undefined;
    setProfileLoading(true);
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setProfileName(null);
        setProfileEmail(null);
        setCreditsUsed(null);
        setCreditsLimit(null);
        setUserInitials("U");
        setProfileLoading(false);
        if (unsubscribeProfile) unsubscribeProfile();
        return;
      }
      setProfileEmail(user.email || null);
      if (user.displayName) {
        setProfileName(user.displayName);
        setUserInitials(user.displayName.slice(0, 2).toUpperCase());
      } else if (user.email) {
        setUserInitials(user.email.slice(0, 2).toUpperCase());
      }
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
        const data = snap.data() as any;
        if (data?.displayName) {
          setProfileName(data.displayName);
          setUserInitials(String(data.displayName).slice(0, 2).toUpperCase());
        }
        if (data?.email) {
          setProfileEmail(data.email);
        }
        setCreditsUsed(Number(data?.credits_used ?? 0));
        setCreditsLimit(Number(data?.credits_limit ?? 0));
        setProfileLoading(false);
      }, () => {
        setProfileLoading(false);
      });
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
        try {
            const db = getClientFirestore();
            await updateDoc(doc(db, "notifications", notification.id), { isRead: true });
        } catch (e) {
            console.error("Failed to mark as read:", e);
        }
    }
    setShowDropdown(false);
    if (notification.targetUrl) {
        router.push(notification.targetUrl);
    }
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Jobs", href: "/job-profiles", icon: Briefcase },
    { name: "Candidates", href: "/candidates", icon: Users },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Reports", href: "/reports", icon: FileBarChart },
  ];

  return (
    <nav className="relative z-50 mx-4 mt-4 overflow-visible rounded-2xl border border-slate-200/60 bg-white/70 text-slate-900 shadow-[0_0_25px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-white/5 dark:bg-slate-900/60 dark:text-white dark:shadow-[0_0_25px_rgba(15,23,42,0.45)]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          
          {/* Left: Logo & Nav Links */}
          <div className="flex items-center gap-8">
            <div className="flex-shrink-0">
               {/* Logo placeholder or simple text */}
               <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">TalentFlow</span>
            </div>
            
            <div className="hidden md:block">
              <div className="flex items-baseline space-x-1">
                {navItems.map((item) => {
                  const isActive = pathname?.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-slate-200/70 text-slate-900 dark:bg-white/10 dark:text-white"
                          : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Actions & Profile */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button className="rounded-full bg-slate-100/80 p-1 text-slate-600 transition hover:bg-slate-200/80 hover:text-slate-900 focus:outline-none dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white">
              <Search className="h-5 w-5" />
            </button>
            
            {/* Notification Bell */}
            <div className="relative overflow-visible" ref={dropdownRef}>
                <button 
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="relative rounded-full bg-slate-100/80 p-1 text-slate-600 transition hover:bg-slate-200/80 hover:text-slate-900 focus:outline-none dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 block h-4 w-4 rounded-full bg-rose-500 ring-2 ring-white/80 text-[10px] flex items-center justify-center text-white font-bold dark:ring-slate-900/80">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
                
                {/* Dropdown */}
                {showDropdown && (
                    <div className="absolute right-0 mt-2 w-80 overflow-visible rounded-2xl border border-slate-200/60 bg-white/90 py-2 text-slate-700 shadow-xl ring-1 ring-black/5 backdrop-blur-xl z-[999] dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-200">
                        <div className="flex justify-between items-center px-4 py-2 border-b border-slate-200/60 dark:border-white/10">
                            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Notifications</h3>
                            {notifications.length > 0 && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">{notifications.length} recent</span>
                            )}
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="px-4 py-8 text-center text-slate-500 text-sm dark:text-slate-400">
                                    No new notifications
                                </div>
                            ) : (
                                notifications.map((notif) => (
                                    <div 
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`px-4 py-3 cursor-pointer transition-colors border-b border-slate-200/60 last:border-0 hover:bg-slate-100/80 dark:border-white/5 dark:hover:bg-white/5 ${!notif.isRead ? 'bg-slate-100/80 dark:bg-white/5' : ''}`}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <p className={`text-sm ${!notif.isRead ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                                                {notif.title}
                                            </p>
                                            <span className="text-[10px] text-slate-500 whitespace-nowrap dark:text-slate-400">
                                                {notif.createdAt ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true }) : 'Just now'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 dark:text-slate-400">
                                            {notif.message}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            <Link href="/dashboard/support" className="rounded-full bg-slate-100/80 p-1 text-slate-600 transition hover:bg-slate-200/80 hover:text-slate-900 focus:outline-none dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white">
              <LifeBuoy className="h-5 w-5" />
            </Link>
            
            {/* User Avatar */}
            <div className="ml-2 relative overflow-visible" ref={profileRef}>
              <button 
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/80 to-indigo-500/80 text-xs font-bold text-white ring-2 ring-white/10 transition-all hover:ring-white/30 focus:outline-none"
              >
                {userInitials}
              </button>

              {/* Profile Dropdown */}
              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-48 overflow-visible rounded-2xl border border-slate-200/60 bg-white/90 py-1 text-slate-700 shadow-xl ring-1 ring-black/5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 z-[999] dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-200">
                  <div className="px-4 py-3 border-b border-slate-200/60 dark:border-white/10">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Signed in as</p>
                    <p className="text-xs text-slate-600 truncate dark:text-slate-300">{profileLoading ? "..." : (profileName || "User")}</p>
                    <p className="text-xs text-slate-500 truncate dark:text-slate-400">{profileLoading ? "..." : (profileEmail || "—")}</p>
                  </div>
                  <div className="px-4 py-3 border-b border-slate-200/60 dark:border-white/10">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Credits: {profileLoading ? "..." : `${creditsUsed ?? 0} / ${creditsLimit ?? 0}`}
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                      <div
                        className={`h-full rounded-full ${
                          (creditsLimit || 0) > 0 && (creditsUsed || 0) / (creditsLimit || 1) >= 0.8
                            ? "bg-rose-500"
                            : (creditsLimit || 0) > 0 && (creditsUsed || 0) / (creditsLimit || 1) >= 0.5
                              ? "bg-amber-500"
                              : "bg-emerald-400"
                        }`}
                        style={{
                          width: `${(creditsLimit || 0) > 0 ? Math.min(100, Math.round(((creditsUsed || 0) / (creditsLimit || 1)) * 100)) : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="py-1">
                    <Link href="/settings" className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-white/5">
                      <Settings className="mr-3 h-4 w-4 text-slate-400 dark:text-slate-400" />
                      Settings
                    </Link>
                  </div>

                  <div className="py-1 border-t border-slate-200/60 dark:border-white/10">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 dark:text-rose-300"
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </nav>
  );
}
