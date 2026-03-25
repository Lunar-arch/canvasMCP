"use client";

import { useMemo, useState } from "react";
import { StudyTask, Tag } from "@/types";
import { cn } from "@/lib/cn";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import { motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  CheckCircle2,
  Circle,
} from "lucide-react";

interface CalendarViewProps {
  tasks: StudyTask[];
  tags: Tag[];
  courseColors: Record<number, string>;
  onToggleComplete: (taskId: string) => void;
  onPlayTask: (taskId: string) => void;
}

export function CalendarView({
  tasks,
  tags,
  courseColors,
  onToggleComplete,
  onPlayTask,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const tasksByDate = useMemo(() => {
    const map = new Map<string, StudyTask[]>();
    for (const task of tasks) {
      if (!task.dueAt) continue;
      const dateKey = format(parseISO(task.dueAt), "yyyy-MM-dd");
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(task);
    }
    return map;
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);

    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[var(--bg-hover)] transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[var(--border)]">
          {weekDays.map((day) => (
            <div
              key={day}
              className="px-2 py-2.5 text-xs font-semibold text-[var(--text-secondary)] text-center"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate.get(dateKey) || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[100px] p-1.5 border-b border-r border-[var(--border)] transition-colors",
                  !inMonth && "bg-[var(--bg)]",
                  today && "bg-[var(--primary-light)]"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      !inMonth && "text-[var(--text-muted)]",
                      today &&
                        "bg-[var(--primary)] text-white"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {dayTasks.length}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "group/cal flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] leading-tight cursor-default hover:bg-[var(--bg-hover)] transition-colors",
                        task.completed && "opacity-50 line-through"
                      )}
                      style={{
                        borderLeft: `2px solid ${
                          task.courseId
                            ? courseColors[task.courseId] || "#6366f1"
                            : "#6366f1"
                        }`,
                      }}
                    >
                      <button
                        onClick={() => onToggleComplete(task.id)}
                        className="shrink-0"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-3 h-3 text-[var(--success)]" />
                        ) : (
                          <Circle className="w-3 h-3 text-[var(--text-muted)]" />
                        )}
                      </button>
                      <span className="truncate flex-1">{task.title}</span>
                      <button
                        onClick={() => onPlayTask(task.id)}
                        className="shrink-0 opacity-0 group-hover/cal:opacity-100 transition-opacity"
                      >
                        <Play className="w-3 h-3 text-[var(--primary)]" />
                      </button>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="text-[10px] text-[var(--text-muted)] px-1.5">
                      +{dayTasks.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
