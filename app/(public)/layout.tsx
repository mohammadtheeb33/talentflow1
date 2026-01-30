import PublicHeader from "@/components/PublicHeader";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
       <PublicHeader />
       
       <main>
          {children}
       </main>
    </div>
  );
}
