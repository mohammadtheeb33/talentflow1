"use client";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import LoginForm from "./sign-in-form";
import { useState, useEffect } from "react";
import { getClientAuth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Globe } from "lucide-react";

const ConnectOutlookModal = dynamic(
  () => import("@/components/ConnectOutlookModal").then((mod) => mod.ConnectOutlookModal),
  { ssr: false }
);



export function LoginClient() {
  const params = useSearchParams();
  const router = useRouter();
  const tenant = params.get("tenant") || "consumers";
  const showModalParam = params.get("outlook") === "1";
  const [showOutlook, setShowOutlook] = useState(false);
  const [lang, setLang] = useState<"en" | "ar">("en");

  useEffect(() => { if (showModalParam) setShowOutlook(true); }, [showModalParam]);

  // After successful login, set cookie and redirect
  useEffect(() => {
    try {
      const auth = getClientAuth();
      const unsub = onAuthStateChanged(auth, async (user) => {
        if (user && !user.isAnonymous) {
          const expires = new Date();
          expires.setTime(expires.getTime() + (1 * 24 * 60 * 60 * 1000));
          document.cookie = `auth_token=true; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
          router.refresh();
          const nextDest = params.get("next") || "/dashboard";
          router.replace(nextDest);
        }
      });
      return () => { try { unsub(); } catch (_) {} };
    } catch (_) {}
  }, [params, router]);

  const t = {
    title: lang === "en" ? "Sign in to your account" : "تسجيل الدخول إلى حسابك",
    privacy: lang === "en" ? "Privacy Policy" : "سياسة الخصوصية",
    terms: lang === "en" ? "Terms of Use" : "شروط الاستخدام",
    tagline: lang === "en" ? "Smart hiring starts here." : "التوظيف الذكي يبدأ هنا.",
    brand: "TalentFlow"
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Left Panel (Branding) */}
      <div className="relative hidden lg:flex flex-col items-center justify-center h-full w-full bg-[#6366F1] text-white p-12">
        <div className="max-w-md text-center">
          <div className="mb-6 flex justify-center">
             <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-xl">
                <span className="text-3xl font-bold text-white">TF</span>
             </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-4">
            {t.brand}
          </h1>
          <p className="text-lg text-indigo-100 mt-4 opacity-90">
            {t.tagline}
          </p>
        </div>
      </div>

      {/* Right Panel (Auth) */}
      <div className="flex flex-col items-center justify-center h-full w-full bg-white p-8 sm:p-12 lg:p-24 relative">
        {/* Language Selector */}
        <div className="absolute top-8 right-8 flex items-center gap-2">
          <Globe className="h-4 w-4 text-gray-500" />
          <button 
             onClick={() => setLang("en")} 
             className={`text-sm font-medium transition-colors ${lang === "en" ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            English
          </button>
          <span className="text-gray-300">|</span>
          <button 
             onClick={() => setLang("ar")} 
             className={`text-sm font-medium transition-colors ${lang === "ar" ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            العربية
          </button>
        </div>

        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
             <h2 className="text-3xl font-bold tracking-tight text-gray-900">
               {t.title}
             </h2>
          </div>

          <div className="mt-8">
            <LoginForm lang={lang} />


          </div>
          
          {/* Footer */}
          <div className="mt-8 flex justify-center gap-6 text-xs text-gray-500">
             <a href="#" className="hover:text-indigo-600 hover:underline">{t.privacy}</a>
             <a href="#" className="hover:text-indigo-600 hover:underline">{t.terms}</a>
          </div>
        </div>
      </div>
      
      {showOutlook && <ConnectOutlookModal isOpen={showOutlook} onClose={() => setShowOutlook(false)} />}
    </div>
  );
}
