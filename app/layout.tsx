import "./globals.css";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import RequireAuth from "@/components/RequireAuth";

export const metadata: Metadata = {
  title: "TalentFlow | ATS Dashboard",
  description: "Modern ATS with CV scoring and reports",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <RequireAuth>
          <Navbar />
          <div className="w-full px-6 py-6">
            {children}
          </div>
        </RequireAuth>
      </body>
    </html>
  );
}