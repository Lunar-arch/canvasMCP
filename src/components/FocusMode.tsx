"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { StudyTask } from "@/types";
import { cn } from "@/lib/cn";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Pause,
  Play,
  SkipForward,
  CheckCircle2,
  Clock,
  ChevronDown,
  RotateCcw,
  Bookmark,
} from "lucide-react";

interface FocusModeProps {
  tasks: StudyTask[];
  currentIndex: number;
  defaultTimerMinutes: number;
  extraTimeMinutes: number;
  onComplete: (taskId: string) => void;
  onSkip: (taskId: string) => void;
  onSaveRemaining: (taskId: string, secondsRemaining: number) => void;
  onClose: () => void;
}

export function FocusMode({
  tasks,
  currentIndex: initialIndex,
  defaultTimerMinutes,
  extraTimeMinutes,
  onComplete,
  onSkip,
  onSaveRemaining,
  onClose,
}: FocusModeProps) {
  const [index, setIndex] = useState(initialIndex);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showNotDoneMenu, setShowNotDoneMenu] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const task = tasks[index];

  // Initialize timer for current task
  useEffect(() => {
    if (!task) return;
    const mins = task.estimatedMinutes || defaultTimerMinutes;
    const secs = mins * 60;
    // Always use the full timer length for totalSeconds, but if the task
    // has a saved `secondsRemaining`, apply it so the elapsed portion
    // reflects prior progress while the ring/total remains the full amount.
    const savedRemaining = typeof task.secondsRemaining === "number" ? Math.max(0, Math.floor(task.secondsRemaining)) : null;
    setTotalSeconds(secs);
    setSecondsLeft(savedRemaining !== null ? Math.min(secs, savedRemaining) : secs);
    setRunning(true);
    setFinished(false);
    setShowNotDoneMenu(false);
  }, [index, task, defaultTimerMinutes]);

  // Timer tick
  useEffect(() => {
    if (running && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setRunning(false);
            setFinished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, secondsLeft]);

  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleFinished = useCallback(() => {
    onComplete(task.id);
    if (index < tasks.length - 1) {
      setIndex(index + 1);
    } else {
      onClose();
    }
  }, [task, index, tasks.length, onComplete, onClose]);

  const handleAddTime = useCallback(() => {
    setSecondsLeft((prev) => prev + extraTimeMinutes * 60);
    setTotalSeconds((prev) => prev + extraTimeMinutes * 60);
    setFinished(false);
    setRunning(true);
    setShowNotDoneMenu(false);
  }, [extraTimeMinutes]);

  const handleSaveForLater = useCallback(() => {
    // save remaining time to task then call skip handler
    onSaveRemaining(task.id, secondsLeft);
    onSkip(task.id);
    setShowNotDoneMenu(false);
    if (index < tasks.length - 1) {
      setIndex(index + 1);
    } else {
      onClose();
    }
  }, [task, index, tasks.length, onSkip, onClose]);

  if (!task) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#0f172a] z-[100] flex flex-col items-center justify-center text-white"
    >
      {/* Close button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
              // Save remaining seconds for current task before closing
              onSaveRemaining(task.id, secondsLeft);
              onClose();
        }}
        className="absolute top-6 right-6 z-10 p-3 rounded-xl hover:bg-white/10 transition-colors"
      >
        <X className="w-7 h-7" />
      </button>

      {/* Queue progress line */}
      {tasks.length > 1 && (
        <div className="absolute top-6 left-6 right-20 flex items-center gap-3">
          <span className="text-sm text-white/60 shrink-0">
            {index + 1} / {tasks.length}
          </span>
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--success)]"
              initial={{ width: 0 }}
              animate={{ width: `${((index + (finished ? 1 : 0)) / tasks.length) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Task info */}
      <motion.div
        key={task.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        {task.courseName && (
          <p className="text-sm text-white/50 mb-1">{task.courseName}</p>
        )}
        <h2 className="text-2xl font-bold max-w-md">{task.title}</h2>
      </motion.div>

      {/* Timer ring */}
      <div className="relative w-72 h-72 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
          {/* Background ring */}
          <circle
            cx="130"
            cy="130"
            r={radius}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            fill="none"
          />
          {/* Progress ring */}
          <circle
            cx="130"
            cy="130"
            r={radius}
            stroke={finished ? "#22c55e" : "#6366f1"}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Timer text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-mono font-bold tabular-nums">
            {formatTime(secondsLeft)}
          </span>
          {!finished && (
            <span className="text-sm text-white/40 mt-2">
              {task.estimatedMinutes || defaultTimerMinutes} min estimated
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      {!finished ? (
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              // Early complete: mark complete and clear remaining time
              onSaveRemaining(task.id, 0);
              onComplete(task.id);
              if (index < tasks.length - 1) {
                setIndex(index + 1);
              } else {
                onClose();
              }
            }}
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            title="Complete task"
          >
            <CheckCircle2 className="w-6 h-6" />
          </button>
          <button
            onClick={() => setRunning(!running)}
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            {running ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </button>
          <button
            onClick={() => {
              setSecondsLeft(totalSeconds);
              setRunning(false);
            }}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            title="Reset timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {tasks.length > 1 && (
            <button
              onClick={() => {
                if (index < tasks.length - 1) setIndex(index + 1);
              }}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              title="Skip to next"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3"
        >
          <p className="text-white/60 text-sm mb-2">Time&apos;s up!</p>
          <div className="flex gap-3">
            <button
              onClick={handleFinished}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--success)] text-white font-semibold hover:brightness-110 transition-all"
            >
              <CheckCircle2 className="w-5 h-5" />
              Finished!
            </button>
            <div className="relative">
              <button
                onClick={() => setShowNotDoneMenu(!showNotDoneMenu)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-medium transition-colors"
              >
                Not done
                <ChevronDown className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {showNotDoneMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute bottom-full mb-2 right-0 bg-[#1e293b] rounded-xl border border-white/10 shadow-2xl overflow-hidden w-48"
                  >
                    <button
                      onClick={handleAddTime}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-white/5 transition-colors"
                    >
                      <Clock className="w-4 h-4 text-[var(--primary)]" />
                      + {extraTimeMinutes} min
                    </button>
                    <button
                      onClick={handleSaveForLater}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-white/5 transition-colors"
                    >
                      <Bookmark className="w-4 h-4 text-[var(--warning)]" />
                      Save for later
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}

      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
        <motion.div
          className="h-full bg-[var(--primary)]"
          style={{ width: `${progress * 100}%` }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}
