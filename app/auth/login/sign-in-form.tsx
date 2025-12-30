"use client";
import { useState } from "react";
import { getClientAuth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Loader2 } from "lucide-react";

interface LoginFormProps {
  lang: "en" | "ar";
}

function translateError(code: string, lang: "en" | "ar"): string {
  if (lang === "en") {
    switch (code) {
      case "auth/invalid-email": return "Invalid email address";
      case "auth/user-not-found":
      case "auth/invalid-credential": return "Invalid email or password";
      case "auth/wrong-password": return "Invalid email or password";
      case "auth/too-many-requests": return "Too many attempts, please try again later";
      case "auth/network-request-failed": return "Network connection failed";
      default: return "Authentication failed";
    }
  } else {
    switch (code) {
      case "auth/invalid-email": return "البريد الإلكتروني غير صالح";
      case "auth/user-not-found":
      case "auth/invalid-credential": return "لا يوجد مستخدم بهذه البيانات";
      case "auth/wrong-password": return "كلمة المرور غير صحيحة";
      case "auth/too-many-requests": return "محاولات كثيرة، الرجاء المحاولة لاحقًا";
      case "auth/network-request-failed": return "تعذّر الاتصال بالشبكة";
      default: return "تعذّر تسجيل الدخول";
    }
  }
}

export default function LoginForm({ lang }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const t = {
    emailLabel: lang === "en" ? "Email address" : "البريد الإلكتروني",
    passwordLabel: lang === "en" ? "Password" : "كلمة المرور",
    emailPlaceholder: "name@company.com",
    passwordPlaceholder: "••••••••",
    signIn: lang === "en" ? "Sign in" : "تسجيل الدخول",
    signingIn: lang === "en" ? "Signing in..." : "جاري تسجيل الدخول...",
    success: lang === "en" ? "Login successful" : "تم تسجيل الدخول بنجاح",
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const auth = getClientAuth();
      await signInWithEmailAndPassword(auth, email, password);
      setMessage(t.success);
    } catch (err: any) {
      console.error("Login Error:", err);
      const code = err?.code ?? "";
      setMessage(translateError(code, lang));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          {t.emailLabel}
        </label>
        <div className="mt-1">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            placeholder={t.emailPlaceholder}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          {t.passwordLabel}
        </label>
        <div className="mt-1">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            placeholder={t.passwordPlaceholder}
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t.signingIn}
            </>
          ) : (
            t.signIn
          )}
        </button>
      </div>
      
      {message && (
        <div className={`rounded-md p-4 ${message === t.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium">{message}</h3>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
