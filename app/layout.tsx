import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import RequireAuth from "@/components/RequireAuth";
import MainLayout from "@/components/MainLayout";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TalentFlow | ATS Dashboard",
  description: "Modern ATS with CV scoring and reports",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`min-h-screen bg-gray-50 text-gray-900 ${inter.className}`}>
        <RequireAuth>
          <MainLayout>
            {children}
          </MainLayout>
          <Toaster position="top-center" />
        </RequireAuth>
      </body>
    </html>
  );
}