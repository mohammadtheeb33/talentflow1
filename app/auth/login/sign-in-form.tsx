"use client";
import { useState } from "react";
import { getClientAuth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

function translateError(code?: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "البريد الإلكتروني غير صالح";
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return "لا يوجد مستخدم بهذه البيانات";
    case "auth/wrong-password":
      return "كلمة المرور غير صحيحة";
    case "auth/too-many-requests":
      return "محاولات كثيرة، الرجاء المحاولة لاحقًا";
    case "auth/network-request-failed":
      return "تعذّر الاتصال بالشبكة";
    default:
      return "تعذّر تسجيل الدخول";
  }
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const auth = getClientAuth();
      await signInWithEmailAndPassword(auth, email, password);
      setMessage("تم تسجيل الدخول بنجاح");
    } catch (err: any) {
      const code = err?.code ?? "";
      const baseMsg = translateError(code);
      // أثناء التطوير المحلي، أظهر كود الخطأ للمساعدة على التشخيص
      setMessage(isLocalhost && baseMsg === "تعذّر تسجيل الدخول" ? `${baseMsg} (${code || "unknown"})` : baseMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-gray-600">البريد الإلكتروني</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 w-full rounded border p-2 text-sm"
          placeholder="name@example.com"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-600">كلمة المرور</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1 w-full rounded border p-2 text-sm"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? "جاري تسجيل الدخول…" : "تسجيل الدخول"}
      </button>
      {message && (
        <div className="rounded-md border bg-gray-50 p-3 text-xs text-gray-700">{message}</div>
      )}
    </form>
  );
}
