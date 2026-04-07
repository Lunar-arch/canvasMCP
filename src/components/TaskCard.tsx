"use client";

import { useEffect, useRef, useState } from "react";
import { StudyTask, Tag } from "@/types";
import { cn } from "@/lib/cn";
import { format, parseISO, isPast, isToday, isTomorrow } from "date-fns";
import { motion } from "motion/react";
import { Play, CheckCircle2, Circle, Clock, GripVertical, Pencil, Trash2, X } from "lucide-react";

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "#94a3b8", bg: "#f1f5f9" },
  medium: { label: "Med", color: "#f59e0b", bg: "#fffbeb" },
  high: { label: "High", color: "#f97316", bg: "#fff7ed" },
  urgent: { label: "Urgent", color: "#ef4444", bg: "#fef2f2" },
} as const;

const PRIORITY_CYCLE: Array<StudyTask["priority"]> = [null, "low", "medium", "high", "urgent"];

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
  onDelete?: () => void;
  isDragging?: boolean;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}

export function TaskCard({
  task,
  tags,
  courseColor,
  onToggleComplete,
  onPlay,
  onEdit,
  onDelete,
  onUpdate,
  onRemoveTag,
  isDragging,
  isSelected,
  onSelect,
}: TaskCardProps) {
  const [titleValue, setTitleValue] = useState(task.title);
  const [timeValue, setTimeValue] = useState(task.estimatedMinutes > 0 ? String(task.estimatedMinutes) : "");
  const [showZeroEstimateInput, setShowZeroEstimateInput] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateValue, setDateValue] = useState(task.dueAt ? task.dueAt.slice(0, 16) : "");
  const timeInputRef = useRef<HTMLInputElement>(null);

  const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null;
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
  const parsedEstimate = timeValue === "" ? 0 : Number.parseInt(timeValue, 10) || 0;
  const hasEstimate = parsedEstimate > 0;
  const estimateInputWidth = `${Math.max(timeValue.length, 1)}ch`;

  useEffect(() => {
    setTitleValue(task.title);
  }, [task.title]);

  useEffect(() => {
    setTimeValue(task.estimatedMinutes > 0 ? String(task.estimatedMinutes) : "");
  }, [task.estimatedMinutes]);

  useEffect(() => {
    if (!hasEstimate && showZeroEstimateInput) {
      timeInputRef.current?.focus();
    }
  }, [hasEstimate, showZeroEstimateInput]);

  const cyclePriority = (e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = PRIORITY_CYCLE.indexOf(task.priority);
    const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
    onUpdate({ priority: next });
  };

  const commitTitle = () => {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== task.title) onUpdate({ title: trimmed });
    else setTitleValue(task.title);
  };

  const commitTime = () => {
    const val = timeValue === "" ? 0 : Math.max(0, Number.parseInt(timeValue, 10) || 0);
    setTimeValue(val > 0 ? String(val) : "");
    if (val === 0) {
      setShowZeroEstimateInput(false);
    }
    if (val !== task.estimatedMinutes) onUpdate({ estimatedMinutes: val });
  };

  const commitDate = (value: string) => {
    setShowDatePicker(false);
    setDateValue(value);
    onUpdate({ dueAt: value ? new Date(value).toISOString() : null });
  };

  return (
    <motion.div
      layout
      className={cn(
        "group relative bg-[var(--bg-card)] rounded-xl border transition-all",
        isSelected
          ? "border-[var(--primary)] bg-[var(--primary-light)]"
          : "border-[var(--border)] hover:border-[var(--border-hover)]",
        task.completed && "opacity-60",
        isDragging && "shadow-lg scale-[1.02] opacity-90"
      )}
    >
      <div className="flex items-stretch">
        {/* Selection zone */}
        <div
          className={cn(
            "w-6 shrink-0 flex items-center justify-center cursor-pointer rounded-l-xl transition-colors",
            isSelected ? "bg-[var(--primary)]/10" : "hover:bg-[var(--bg-hover)]"
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onSelect}
          title="Select task"
        >
          {isSelected && <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />}
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-start gap-3 py-3 pr-3 min-w-0">
          <div className="flex items-center gap-1.5 pt-0.5">
            <GripVertical className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
            <button
              onClick={onToggleComplete}
              className="shrink-0 p-0.5 transition-colors cursor-pointer"
            >
              {task.completed ? (
                <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
              ) : (
                <Circle className="w-5 h-5 text-[var(--text-muted)] hover:text-[var(--primary)]" />
              )}
            </button>
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Always-visible title input */}
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") {
                      setTitleValue(task.title);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "text-sm font-medium w-full bg-transparent border-b border-transparent focus:border-[var(--primary)] focus:outline-none leading-tight pb-0.5 transition-colors",
                    task.completed && "line-through text-[var(--text-muted)]"
                  )}
                />

                {/* Badges row */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
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

                  {priority ? (
                    <button
                      type="button"
                      onClick={cyclePriority}
                      className="text-xs font-medium px-2 py-0.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: priority.bg, color: priority.color }}
                    >
                      {priority.label}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={cyclePriority}
                      className="text-xs font-medium px-2 py-0.5 rounded-md cursor-pointer text-[var(--text-muted)] hover:bg-[var(--bg-hover)] opacity-0 group-hover:opacity-100 transition-all"
                    >
                      + priority
                    </button>
                  )}

                  {/* Tags with hover-X removal */}
                  {taskTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="relative inline-flex items-center text-xs px-2.5 py-0.5 rounded-md text-white group/tag overflow-hidden cursor-default select-none"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                      <span
                        className="absolute inset-y-0 right-0 left-[30%] flex items-center justify-end px-1 opacity-0 group-hover/tag:opacity-100 transition-opacity cursor-pointer"
                        style={{ background: `linear-gradient(to right, transparent, ${tag.color})` }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveTag(tag.id);
                        }}
                      >
                        <X className="w-2.5 h-2.5" />
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Hover actions */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {task.secondsRemaining ? (
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {Math.ceil((task.secondsRemaining || 0) / 60)}m
                  </span>
                ) : null}
                <button
                  onClick={(e) => { e.stopPropagation(); onPlay(); }}
                  className="p-1.5 rounded-lg hover:bg-[var(--primary-light)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                  title="Focus"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
                {onEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors cursor-pointer"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              {/* Due date */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowDatePicker((s) => !s); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={cn(
                    "flex items-center gap-1 hover:text-[var(--text)] transition-colors cursor-pointer",
                    isOverdue && "text-[var(--danger)] font-medium"
                  )}
                >
                  <Clock className="w-3 h-3" />
                  {dueDateLabel}
                  {dueDate && !isOverdue && !isDueToday && !isDueTomorrow && (
                    <span className="ml-0.5">{format(dueDate, "h:mm a")}</span>
                  )}
                </button>
                {showDatePicker && (
                  <div
                    className="absolute left-0 top-full mt-1 z-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-2 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="datetime-local"
                      defaultValue={dateValue}
                      className="text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                      onChange={(e) => setDateValue(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-1.5 mt-1.5">
                      <button type="button" onClick={() => commitDate(dateValue)} className="flex-1 text-xs px-2 py-1 rounded-lg bg-[var(--primary)] text-white cursor-pointer">Set</button>
                      <button type="button" onClick={() => commitDate("")} className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer">Clear</button>
                      <button type="button" onClick={() => setShowDatePicker(false)} className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer">✕</button>
                    </div>
                  </div>
                )}
              </div>

              {task.pointsPossible && <span>{task.pointsPossible} pts</span>}

              {/* Always-visible time input */}
              <div className="flex items-center gap-1">
                {!hasEstimate && !showZeroEstimateInput ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowZeroEstimateInput(true);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="inline-flex items-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                    title="Set estimated time"
                  >
                    <Clock className="w-3 h-3" />
                  </button>
                ) : (
                  <>
                    <Clock className="w-3 h-3" />
                    <input
                      ref={timeInputRef}
                      type="number"
                      value={timeValue}
                      onChange={(e) => {
                        const next = e.target.value.replace(/[^\d]/g, "");
                        setTimeValue(next);
                      }}
                      onBlur={commitTime}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") {
                          const fallback = task.estimatedMinutes > 0 ? String(task.estimatedMinutes) : "";
                          setTimeValue(fallback);
                          if (!task.estimatedMinutes) setShowZeroEstimateInput(false);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: estimateInputWidth }}
                      className="min-w-[1ch] px-0 text-xs bg-transparent border-b border-transparent focus:border-[var(--primary)] focus:outline-none text-center transition-colors cursor-text"
                      min={0}
                    />
                    {hasEstimate && <span>m</span>}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
