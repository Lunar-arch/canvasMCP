"use client";

import { useCallback, useEffect, useState } from "react";
import { StudyTask, Tag, Course } from "@/types";
import { motion } from "motion/react";
import {
  X,
  ExternalLink,
  Clock,
  Star,
  Tag as TagIcon,
  Calendar,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { TagEditor } from "@/components/ui/TagEditor";
import { CustomSelect } from "@/components/ui/CustomSelect";

const PRIORITY_OPTIONS = [
  { value: null, label: "None", color: "#94a3b8" },
  { value: "low", label: "Low", color: "#94a3b8" },
  { value: "medium", label: "Medium", color: "#f59e0b" },
  { value: "high", label: "High", color: "#f97316" },
  { value: "urgent", label: "Urgent", color: "#ef4444" },
] as const;

interface TaskEditModalProps {
  task: StudyTask;
  tags: Tag[];
  courses: Course[];
  onUpdate: (updates: Partial<StudyTask>) => void;
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateTag: (name: string, color: string) => Tag;
  onCreateCourse?: (name: string, course_code?: string, color?: string) => Course;
  onClose: () => void;
  onDelete?: () => void;
}

export function TaskEditModal({
  task,
  tags,
  courses,
  onUpdate,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onCreateCourse,
  onClose,
  onDelete,
}: TaskEditModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [dueAt, setDueAt] = useState(
    task.dueAt ? task.dueAt.slice(0, 16) : ""
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    task.estimatedMinutes
  );
  const [priority, setPriority] = useState<StudyTask["priority"]>(task.priority);
  const [selectedCourseId, setSelectedCourseId] = useState<number | "">(
    task.courseId ?? ""
  );
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseColor, setNewCourseColor] = useState<string>("#6366f1");

  const taskTags = tags.filter((t) => task.tags.includes(t.id));

  const handleSave = useCallback(() => {
    onUpdate({
      title: title.trim() || task.title,
      description: description.trim() || undefined,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      estimatedMinutes,
      priority,
      courseId: selectedCourseId === "" ? undefined : selectedCourseId,
      courseName:
        selectedCourseId === ""
          ? undefined
          : courses.find((c) => c.id === selectedCourseId)?.name,
    });
    onClose();
  }, [
    onUpdate,
    title,
    task.title,
    description,
    dueAt,
    estimatedMinutes,
    priority,
    selectedCourseId,
    courses,
    onClose,
  ]);

  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [handleSave]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="text-lg font-bold">Edit Task</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes or details..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
            />
          </div>

          {/* Due Date & Estimated Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Due Date
              </label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Estimated Time
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={estimatedMinutes}
                  onChange={(e) =>
                    setEstimatedMinutes(parseInt(e.target.value) || 25)
                  }
                  min={1}
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <span className="text-sm text-[var(--text-muted)] shrink-0">
                  min
                </span>
              </div>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5" />
              Priority
            </label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={String(p.value)}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all",
                    priority === p.value
                      ? "border-current shadow-sm"
                      : "border-transparent bg-[var(--bg)] hover:bg-[var(--bg-hover)]"
                  )}
                  style={{
                    color: priority === p.value ? p.color : undefined,
                    backgroundColor:
                      priority === p.value ? p.color + "15" : undefined,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {/* Course selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
              Course
            </label>
            <div className="flex items-center gap-2">
              <CustomSelect
                className="flex-1"
                value={selectedCourseId === "" ? "" : String(selectedCourseId)}
                onChange={(v) => setSelectedCourseId(v === "" ? "" : Number(v))}
                placeholder="No course"
                options={[
                  { value: "", label: "No course" },
                  ...courses.map((c) => ({ value: String(c.id), label: c.name, color: c.color })),
                ]}
              />
              {onCreateCourse && (
                <button
                  type="button"
                  onClick={() => setShowNewCourse((s) => !s)}
                  className="px-3 py-2 rounded-xl border border-[var(--border)] text-sm hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Create
                </button>
              )}
            </div>
            {showNewCourse && onCreateCourse && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="Course name"
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    placeholder="Course code"
                    className="flex-1 px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                  <input
                    type="color"
                    value={newCourseColor}
                    onChange={(e) => setNewCourseColor(e.target.value)}
                    className="w-14 h-10 p-0 border-0 bg-transparent"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!newCourseName.trim()) return;
                      const c = onCreateCourse(newCourseName.trim(), newCourseCode.trim() || undefined, newCourseColor);
                      setSelectedCourseId(c.id);
                      setShowNewCourse(false);
                      setNewCourseName("");
                      setNewCourseCode("");
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCourse(false)}
                    className="px-4 py-2 rounded-xl bg-[var(--bg)] text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5" />
              Tags
            </label>
            <TagEditor
              tags={taskTags}
              allTags={tags}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onCreateTag={onCreateTag}
            />
          </div>

          {/* Canvas link */}
          {task.htmlUrl && (
            <a
              href={task.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Canvas
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 pt-0">
          <button
            type="button"
            onClick={() => {
              if (!onDelete) return;
              if (confirm("Delete this task? This cannot be undone.")) {
                onDelete();
                onClose();
              }
            }}
            disabled={!onDelete}
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
              onDelete
                ? "text-[var(--danger)] hover:bg-red-50"
                : "text-[var(--text-muted)] opacity-40 cursor-not-allowed"
            )}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
