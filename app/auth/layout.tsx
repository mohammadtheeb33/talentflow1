import "../globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | TalentFlow",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-6 py-12">
      {children}
    </div>
  );
}