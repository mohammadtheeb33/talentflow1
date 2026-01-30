"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = resolvedTheme || theme;
  const isDark = currentTheme === "dark";

  if (!mounted) {
    return (
      <div className="h-9 w-16 rounded-full border border-slate-200/60 bg-white/70 dark:border-white/10 dark:bg-slate-900/40" />
    );
  }

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative inline-flex h-9 w-16 items-center rounded-full border border-slate-200/60 bg-white/70 px-1 transition-colors dark:border-white/10 dark:bg-slate-900/40"
    >
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow transition-transform dark:bg-slate-950 dark:text-slate-200 ${
          isDark ? "translate-x-7" : "translate-x-0"
        }`}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
    </button>
  );
}
