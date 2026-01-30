export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-slate-950 animate-in fade-in duration-300">
      {children}
    </div>
  );
}
