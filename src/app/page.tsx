"use client";

import { useAppData } from "@/hooks/useAppData";
import Link from "next/link";
import { motion } from "motion/react";
import {
  BookOpen,
  Settings,
  ArrowRight,
  Calendar,
  CheckSquare,
  Timer,
} from "lucide-react";

export default function Home() {
  const { data, isLoaded } = useAppData();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasConfig = !!data.config;
  const hasTasks = data.tasks.length > 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full text-center space-y-8"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--primary)] flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">StudyFlow</h1>
          <p className="text-[var(--text-secondary)] text-lg">
            Your personal study dashboard. Sync with Canvas, organize tasks,
            and focus on what matters.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {[
            {
              icon: CheckSquare,
              title: "Task Blocks",
              desc: "Organize assignments into drag-and-drop groups",
            },
            {
              icon: Calendar,
              title: "Calendar View",
              desc: "See your deadlines at a glance on a calendar",
            },
            {
              icon: Timer,
              title: "Focus Timer",
              desc: "Pomodoro-style sessions with smart queuing",
            },
          ].map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]"
            >
              <feat.icon className="w-5 h-5 text-[var(--primary)] mb-2" />
              <h3 className="font-semibold text-sm">{feat.title}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {feat.desc}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!hasConfig && (
            <Link
              href="/setup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary-hover)] transition-colors"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          {hasConfig && (
            <>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] text-white font-medium hover:bg-[var(--primary-hover)] transition-colors"
              >
                {hasTasks ? "Open Dashboard" : "Sync & Get Started"}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/setup"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </>
          )}
        </div>

        {data.lastSynced && (
          <p className="text-xs text-[var(--text-muted)]">
            Last synced:{" "}
            {new Date(data.lastSynced).toLocaleString()}
          </p>
        )}
      </motion.div>
    </div>
  );
}
