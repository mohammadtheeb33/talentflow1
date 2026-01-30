"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoginForm from "../../login/sign-in-form";
import { getClientAuth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ShieldCheck } from "lucide-react";
import { isAdminUser } from "@/config/admins";
import { createUserInFirestore, ROLES } from "@/lib/auth";
import { toast } from "sonner";

export function AdminLoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [lang, setLang] = useState<"en" | "ar">("en");

  useEffect(() => {
    try {
      const auth = getClientAuth();
      const unsub = onAuthStateChanged(auth, async (user) => {
        if (user && !user.isAnonymous) {
          const ok = await isAdminUser({ uid: user.uid, email: user.email });
          if (!ok) {
            toast.error(lang === "ar" ? "هذا الحساب غير مصرح له" : "This account is not authorized");
            await signOut(auth);
            router.replace("/admin/login");
            return;
          }
          await createUserInFirestore(user, ROLES.ADMIN);
          const maxAge = 60 * 60 * 24 * 30;
          const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `auth_token=true; Max-Age=${maxAge}; path=/; SameSite=Lax${secure}`;
          router.refresh();
          const nextDest = params.get("next") || "/admin";
          router.replace(nextDest);
        }
      });
      return () => { try { unsub(); } catch (_) {} };
    } catch (_) {}
  }, [params, router, lang]);

  const t = {
    title: lang === "en" ? "Admin Console" : "لوحة تحكم الإدارة",
    subtitle: lang === "en" ? "Sign in with an authorized admin account." : "سجّل الدخول بحساب مدير مصرح.",
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="relative hidden lg:flex flex-col items-center justify-center h-full w-full bg-gray-900 text-white p-12">
        <div className="max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm shadow-xl">
              <ShieldCheck className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-4">Admin</h1>
          <p className="text-lg text-gray-300 mt-4 opacity-90">{t.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center h-full w-full bg-white p-8 sm:p-12 lg:p-24 relative">
        <div className="absolute top-8 right-8 flex items-center gap-2">
          <button
            onClick={() => setLang("en")}
            className={`text-sm font-medium transition-colors ${lang === "en" ? "text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            English
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => setLang("ar")}
            className={`text-sm font-medium transition-colors ${lang === "ar" ? "text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            العربية
          </button>
        </div>

        <div className="w-full max-w-md space-y-6">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">{t.title}</h2>
            <p className="mt-2 text-sm text-gray-500">{t.subtitle}</p>
          </div>
          <LoginForm lang={lang} showSignUp={false} />
        </div>
      </div>
    </div>
  );
}
