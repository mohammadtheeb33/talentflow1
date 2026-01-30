"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles, Mail, ShieldCheck, LifeBuoy, Cpu, Gauge, Layers } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const softFloat = {
  initial: { y: 0 },
  animate: { y: [0, -12, 0], transition: { duration: 10, repeat: Infinity, ease: "easeInOut" } },
};

const features = [
  {
    title: "AI-Driven Candidate Scoring",
    description: "Parse CVs instantly and score candidates out of 100 with explainable insights.",
    icon: Sparkles,
    size: "lg",
  },
  {
    title: "Seamless Outlook Integration",
    description: "Sync email and calendar in one click to keep the hiring flow moving.",
    icon: Mail,
    size: "sm",
  },
  {
    title: "Centralized Admin Control",
    description: "Manage users, quotas, and AI settings in a unified command center.",
    icon: ShieldCheck,
    size: "sm",
  },
  {
    title: "Built-in Support System",
    description: "Resolve issues faster with integrated ticketing and collaboration.",
    icon: LifeBuoy,
    size: "sm",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden">
        <motion.div
          className="pointer-events-none absolute -top-32 left-1/3 h-80 w-80 rounded-full bg-indigo-500/30 blur-[140px]"
          initial="initial"
          animate="animate"
          variants={softFloat}
        />
        <motion.div
          className="pointer-events-none absolute top-24 right-10 h-72 w-72 rounded-full bg-cyan-400/20 blur-[120px]"
          initial="initial"
          animate="animate"
          variants={softFloat}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-40 left-10 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-[160px]"
          initial="initial"
          animate="animate"
          variants={softFloat}
        />

        <div className="relative z-10">
          <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-[0_0_24px_rgba(99,102,241,0.5)]">
                <Cpu className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold tracking-wide text-slate-900 dark:text-white">TalentFlow</span>
            </div>
            <div className="hidden items-center gap-6 text-sm text-slate-600 dark:text-slate-300 md:flex">
              <Link href="#features" className="hover:text-slate-900 transition-colors dark:hover:text-white">Features</Link>
              <Link href="#cta" className="hover:text-slate-900 transition-colors dark:hover:text-white">Pricing</Link>
              <Link href="/login" className="hover:text-slate-900 transition-colors dark:hover:text-white">Sign In</Link>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
                href="/register"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white ring-1 ring-slate-900/20 hover:bg-slate-800 transition dark:bg-white/10 dark:ring-white/20 dark:hover:bg-white/20"
              >
                Get Started
              </Link>
            </div>
          </header>

          <section className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-2 lg:pt-24">
            <motion.div initial="initial" animate="animate" variants={fadeUp} className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/70 px-4 py-2 text-xs text-slate-700 shadow-lg shadow-indigo-500/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <Sparkles className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                AI-powered hiring intelligence
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
                The future of hiring is{" "}
                <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
                  AI-powered
                </span>
                .
              </h1>
              <p className="max-w-xl text-base text-slate-600 dark:text-slate-300 sm:text-lg">
                Streamline recruitment, analyze resumes instantly, and surface top talent faster with TalentFlow’s intelligent ATS platform.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-cyan-400 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(99,102,241,0.45)] transition hover:brightness-110"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-500/30 bg-white/70 px-6 py-3 text-sm font-semibold text-cyan-700 shadow-[0_0_20px_rgba(34,211,238,0.12)] transition hover:border-cyan-500/60 hover:text-cyan-800 dark:border-cyan-400/40 dark:bg-white/5 dark:text-cyan-200 dark:hover:border-cyan-300/80 dark:hover:text-white">
                  <Play className="h-4 w-4" />
                  Watch Demo
                </button>
              </div>
              <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-cyan-500 dark:text-cyan-300" />
                  3x faster hiring cycles
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                  99% resume parsing accuracy
                </div>
              </div>
            </motion.div>

            <motion.div initial="initial" animate="animate" variants={fadeUp} className="relative">
              <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-indigo-500/20 via-transparent to-cyan-400/20 blur-2xl" />
              <div className="relative rounded-[32px] border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_0_60px_rgba(15,23,42,0.6)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Dashboard</p>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">AI Match Insights</h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">Live</span>
                </div>
                <div className="mt-6 grid gap-4">
                  {[
                    { name: "Sara Ahmed", role: "Product Designer", score: 92 },
                    { name: "Omar Khaled", role: "Data Engineer", score: 88 },
                    { name: "Lina Youssef", role: "Frontend Lead", score: 95 },
                  ].map((c) => (
                    <div key={c.name} className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-slate-900/50">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{c.role}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-24 rounded-full bg-slate-200/80 dark:bg-white/10">
                          <div className="h-2 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300" style={{ width: `${c.score}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-cyan-700 dark:text-cyan-200">{c.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl border border-indigo-400/20 bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 px-4 py-3 text-xs text-slate-700 dark:text-slate-200">
                  AI signals highlight the strongest matches instantly.
                </div>
              </div>
            </motion.div>
          </section>
        </div>
      </div>

      <section id="features" className="mx-auto w-full max-w-7xl px-6 py-20">
        <motion.div initial="initial" animate="animate" variants={fadeUp} className="mb-10 flex flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300">Capabilities</p>
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">Everything you need to hire smarter.</h2>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
            A complete suite of AI-first tools that keeps your pipeline fast, structured, and always informed.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-6">
          {features.map((f) => {
            const Icon = f.icon;
            const colSpan = f.size === "lg" ? "md:col-span-4" : "md:col-span-2";
            return (
              <motion.div
                key={f.title}
                initial="initial"
                animate="animate"
                variants={fadeUp}
                className={`group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white/80 p-6 backdrop-blur-xl transition hover:border-cyan-500/40 hover:shadow-[0_0_40px_rgba(34,211,238,0.12)] dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400/40 dark:hover:shadow-[0_0_40px_rgba(34,211,238,0.2)] ${colSpan}`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-500/10 opacity-0 transition group-hover:opacity-100" />
                <div className="relative z-10 space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/40 to-cyan-400/30 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{f.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{f.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section id="cta" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-fuchsia-500/15 to-cyan-400/20 blur-3xl dark:from-indigo-600/30 dark:via-fuchsia-500/20 dark:to-cyan-400/30" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">Ready to transform your hiring process?</h2>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-200 sm:text-base">
            Launch TalentFlow in minutes and empower your team with AI-driven recruitment.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-cyan-400 px-8 py-3 text-sm font-semibold text-white shadow-[0_0_35px_rgba(99,102,241,0.5)] transition hover:brightness-110"
          >
            Start Your Free Trial Now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
