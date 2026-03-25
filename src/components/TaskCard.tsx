"use client";

import { StudyTask, Tag } from "@/types";
import { cn } from "@/lib/cn";
import { format, parseISO, isPast, isToday, isTomorrow } from "date-fns";
import { motion } from "motion/react";
import {
  Play,
  CheckCircle2,
  Circle,
  Clock,
  GripVertical,
  Pencil,
} from "lucide-react";

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "#94a3b8", bg: "#f1f5f9" },
  medium: { label: "Med", color: "#f59e0b", bg: "#fffbeb" },
  high: { label: "High", color: "#f97316", bg: "#fff7ed" },
  urgent: { label: "Urgent", color: "#ef4444", bg: "#fef2f2" },
};

interface TaskCardProps {
  task: StudyTask;
  tags: Tag[];
  courseColor?: string;
  onToggleComplete: () => void;
  onPlay: () => void;
  onUpdate: (updates: Partial<StudyTask>) => void;
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onEdit?: () => void;
  isDragging?: boolean;
}

export function TaskCard({
  task,
  tags,
  courseColor,
  onToggleComplete,
  onPlay,
  onEdit,
  isDragging,
}: TaskCardProps) {
  const priority = PRIORITY_CONFIG[task.priority];

  const dueDate = task.dueAt ? parseISO(task.dueAt) : null;
  const isOverdue = dueDate ? isPast(dueDate) && !task.completed : false;
  const isDueToday = dueDate ? isToday(dueDate) : false;
  const isDueTomorrow = dueDate ? isTomorrow(dueDate) : false;

  const dueDateLabel = dueDate
    ? isOverdue
      ? "Overdue"
      : isDueToday
        ? "Today"
        : isDueTomorrow
          ? "Tomorrow"
          : format(dueDate, "MMM d")
    : "No due date";

  const taskTags = tags.filter((t) => task.tags.includes(t.id));

  return (
    <motion.div
      layout
      className={cn(
        "group bg-[var(--bg-card)] rounded-xl border border-[var(--border)] hover:border-[var(--border-hover)] transition-all",
        task.completed && "opacity-60",
        isDragging && "shadow-lg scale-[1.02] opacity-90"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex items-center gap-1.5 pt-0.5">
          <GripVertical className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
          <button
            onClick={onToggleComplete}
            className="shrink-0 p-0.5 transition-colors"
          >
            {task.completed ? (
              <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
            ) : (
              <Circle className="w-5 h-5 text-[var(--text-muted)] hover:text-[var(--primary)]" />
            )}
          </button>
        </div>

        <div
          className="flex-1 min-w-0 space-y-1.5 cursor-pointer"
          onClick={onEdit}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-medium leading-tight",
                  task.completed && "line-through text-[var(--text-muted)]"
                )}
              >
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {task.courseName && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-md"
                    style={{
                      backgroundColor: (courseColor || "#6366f1") + "15",
                      color: courseColor || "#6366f1",
                    }}
                  >
                    {task.courseName}
                  </span>
                )}
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: priority.bg, color: priority.color }}
                >
                  {priority.label}
                </span>
                {taskTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="text-xs px-2 py-0.5 rounded-md text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                    {task.secondsRemaining ? (
                      <span className="text-[10px] text-[var(--text-muted)] mt-1">
                        {Math.ceil((task.secondsRemaining || 0) / 60)}m
                      </span>
                    ) : null}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay();
                }}
                className="p-2 rounded-lg hover:bg-[var(--primary-light)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                title="Focus on this task"
              >
                <Play className="w-4 h-4" />
              </button>
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-all"
                  title="Edit task"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span
              className={cn(
                "flex items-center gap-1",
                isOverdue && "text-[var(--danger)] font-medium"
              )}
            >
              <Clock className="w-3 h-3" />
              {dueDateLabel}
              {dueDate && !isOverdue && !isDueToday && !isDueTomorrow && (
                <span className="ml-0.5">
                  {format(dueDate, "h:mm a")}
                </span>
              )}
            </span>
            {task.pointsPossible && (
              <span>{task.pointsPossible} pts</span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {task.estimatedMinutes}m
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
