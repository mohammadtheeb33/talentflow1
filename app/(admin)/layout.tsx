import RequireAuth from "@/components/RequireAuth";
import MainLayout from "@/components/MainLayout";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <MainLayout>
        {children}
      </MainLayout>
    </RequireAuth>
  );
}
