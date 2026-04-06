"use client";

import { useState, useRef } from "react";
import { StudyTask, Tag } from "@/types";
import { cn } from "@/lib/cn";
import { format, parseISO, isPast, isToday, isTomorrow } from "date-fns";
import { motion } from "motion/react";
import { Play, CheckCircle2, Circle, Clock, GripVertical, Pencil, Trash2 } from "lucide-react";

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
  isDragging,
  isSelected,
  onSelect,
}: TaskCardProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [editingTime, setEditingTime] = useState(false);
  const [timeValue, setTimeValue] = useState(String(task.estimatedMinutes));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateValue, setDateValue] = useState(task.dueAt ? task.dueAt.slice(0, 16) : "");

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

  const cyclePriority = (e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = PRIORITY_CYCLE.indexOf(task.priority);
    const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
    onUpdate({ priority: next });
  };

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate({ title: trimmed });
    } else {
      setTitleValue(task.title);
    }
  };

  const commitTime = () => {
    setEditingTime(false);
    const val = parseInt(timeValue) || 25;
    setTimeValue(String(val));
    if (val !== task.estimatedMinutes) {
      onUpdate({ estimatedMinutes: val });
    }
  };

  const commitDate = (value: string) => {
    setShowDatePicker(false);
    const newDue = value ? new Date(value).toISOString() : null;
    setDateValue(value);
    onUpdate({ dueAt: newDue });
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
        {/* Selection zone — left 6 units */}
        <div
          className={cn(
            "w-6 shrink-0 flex items-center justify-center cursor-pointer rounded-l-xl transition-colors",
            isSelected ? "bg-[var(--primary)]/10" : "hover:bg-[var(--bg-hover)]"
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onSelect}
          title="Select task"
        >
          {isSelected && (
            <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-start gap-3 py-3 pr-3 min-w-0">
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

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Inline title editing */}
                {editingTitle ? (
                  <input
                    type="text"
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitTitle();
                      if (e.key === "Escape") {
                        setTitleValue(task.title);
                        setEditingTitle(false);
                      }
                    }}
                    className="text-sm font-medium w-full bg-transparent border-b border-[var(--primary)] focus:outline-none leading-tight pb-0.5"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p
                    className={cn(
                      "text-sm font-medium leading-tight cursor-text",
                      task.completed && "line-through text-[var(--text-muted)]"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTitle(true);
                    }}
                  >
                    {task.title}
                  </p>
                )}

                {/* Badges row */}
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

                  {/* Priority badge — click to cycle */}
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

              {/* Hover action group */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {task.secondsRemaining ? (
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {Math.ceil((task.secondsRemaining || 0) / 60)}m
                  </span>
                ) : null}
                <button
                  onClick={(e) => { e.stopPropagation(); onPlay(); }}
                  className="p-1.5 rounded-lg hover:bg-[var(--primary-light)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                  title="Focus"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
                {onEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              {/* Due date — click to open picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDatePicker((s) => !s);
                  }}
                  className={cn(
                    "flex items-center gap-1 hover:text-[var(--text)] transition-colors",
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
                  >
                    <input
                      type="datetime-local"
                      defaultValue={dateValue}
                      className="text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                      onChange={(e) => setDateValue(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() => commitDate(dateValue)}
                        className="flex-1 text-xs px-2 py-1 rounded-lg bg-[var(--primary)] text-white"
                      >
                        Set
                      </button>
                      <button
                        type="button"
                        onClick={() => commitDate("")}
                        className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--bg-hover)]"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDatePicker(false)}
                        className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--bg-hover)]"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {task.pointsPossible && <span>{task.pointsPossible} pts</span>}

              {/* Estimated time — click to edit inline */}
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {editingTime ? (
                  <input
                    type="number"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    onBlur={commitTime}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitTime();
                      if (e.key === "Escape") {
                        setTimeValue(String(task.estimatedMinutes));
                        setEditingTime(false);
                      }
                    }}
                    className="w-10 text-xs bg-transparent border-b border-transparent focus:border-[var(--primary)] focus:outline-none text-center"
                    min={1}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingTime(true); }}
                    className="hover:text-[var(--text)] transition-colors"
                  >
                    {task.estimatedMinutes}m
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
