"use client";

import { useState, useRef, useEffect } from "react";
import { FilterState, Course, Tag } from "@/types";
import { cn } from "@/lib/cn";
import { motion, AnimatePresence } from "motion/react";
import {
  Filter,
  Search,
  X,
  Calendar,
  Tag as TagIcon,
  BookOpen,
  AlertTriangle,
  Plus,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { TAG_COLORS } from "@/lib/colors";

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  courses: Course[];
  tags: Tag[];
  onCreateTag: (name: string, color: string) => void;
}

export function FilterPanel({
  filters,
  onFiltersChange,
  courses,
  tags,
  onCreateTag,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showNewTag, setShowNewTag] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeFilterCount =
    filters.courses.length +
    filters.tags.length +
    filters.priorities.length +
    (filters.dueDateRange.start || filters.dueDateRange.end ? 1 : 0) +
    (filters.hideCompleted ? 1 : 0) +
    (filters.search ? 1 : 0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const update = (patch: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const toggleArrayItem = (
    key: "courses" | "tags" | "priorities",
    value: string | number
  ) => {
    const arr = filters[key] as (string | number)[];
    const next = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value];
    update({ [key]: next });
  };

  const clearAll = () => {
    onFiltersChange({
      search: "",
      courses: [],
      tags: [],
      priorities: [],
      dueDateRange: { start: null, end: null },
      hideCompleted: false,
    });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors",
          open || activeFilterCount > 0
            ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
            : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
        )}
      >
        <Filter className="w-4 h-4" />
        Filters
        {activeFilterCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-[380px] bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-xl z-50 overflow-hidden"
          >
            {/* Search */}
            <div className="p-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                <Search className="w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => update({ search: e.target.value })}
                  placeholder="Search tasks..."
                  className="flex-1 bg-transparent outline-none text-sm"
                  autoFocus
                />
                {filters.search && (
                  <button onClick={() => update({ search: "" })}>
                    <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
              {/* Hide Completed */}
              <button
                onClick={() =>
                  update({ hideCompleted: !filters.hideCompleted })
                }
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              >
                {filters.hideCompleted ? (
                  <EyeOff className="w-4 h-4 text-[var(--primary)]" />
                ) : (
                  <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                )}
                <span className="text-sm">
                  {filters.hideCompleted
                    ? "Completed tasks hidden"
                    : "Showing all tasks"}
                </span>
              </button>

              {/* Courses */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <BookOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Courses
                  </span>
                </div>
                <div className="space-y-0.5">
                  {courses.map((course) => {
                    const active = filters.courses.includes(course.id);
                    return (
                      <button
                        key={course.id}
                        onClick={() => toggleArrayItem("courses", course.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                          active
                            ? "bg-[var(--primary-light)] text-[var(--primary)]"
                            : "hover:bg-[var(--bg-hover)]"
                        )}
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: course.color || "#6366f1" }}
                        />
                        <span className="flex-1 text-left truncate">
                          {course.name}
                        </span>
                        {active && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                  {courses.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] px-3 py-2">
                      No courses synced yet
                    </p>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Priority
                  </span>
                </div>
                <div className="flex gap-1.5 px-1">
                  {(["low", "medium", "high", "urgent"] as const).map((p) => {
                    const active = filters.priorities.includes(p);
                    const colors = {
                      low: "#94a3b8",
                      medium: "#f59e0b",
                      high: "#f97316",
                      urgent: "#ef4444",
                    };
                    return (
                      <button
                        key={p}
                        onClick={() => toggleArrayItem("priorities", p)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize",
                          active
                            ? "border-current"
                            : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                        )}
                        style={{
                          color: active ? colors[p] : undefined,
                          backgroundColor: active ? colors[p] + "15" : undefined,
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <TagIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Tags
                  </span>
                </div>
                <div className="space-y-0.5">
                  {tags.map((tag) => {
                    const active = filters.tags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleArrayItem("tags", tag.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                          active
                            ? "bg-[var(--primary-light)]"
                            : "hover:bg-[var(--bg-hover)]"
                        )}
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 text-left">{tag.name}</span>
                        {active && (
                          <Check className="w-3.5 h-3.5 text-[var(--primary)]" />
                        )}
                      </button>
                    );
                  })}
                  {!showNewTag ? (
                    <button
                      onClick={() => setShowNewTag(true)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create new tag
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <div className="relative">
                        <button
                          className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: newTagColor }}
                        />
                        <div className="absolute left-0 top-full mt-1 flex gap-1 bg-[var(--bg-card)] p-1.5 rounded-lg border border-[var(--border)] shadow-lg z-10">
                          {TAG_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setNewTagColor(c)}
                              className={cn(
                                "w-5 h-5 rounded-full transition-transform",
                                newTagColor === c && "scale-125 ring-2 ring-offset-1 ring-current"
                              )}
                              style={{ backgroundColor: c, color: c }}
                            />
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Tag name"
                        className="flex-1 text-sm bg-transparent outline-none border-b border-[var(--border)] px-1 py-0.5"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newTagName.trim()) {
                            onCreateTag(newTagName.trim(), newTagColor);
                            setNewTagName("");
                            setShowNewTag(false);
                          }
                          if (e.key === "Escape") setShowNewTag(false);
                        }}
                      />
                      <button
                        onClick={() => {
                          if (newTagName.trim()) {
                            onCreateTag(newTagName.trim(), newTagColor);
                            setNewTagName("");
                            setShowNewTag(false);
                          }
                        }}
                        className="p-1 rounded hover:bg-[var(--bg-hover)]"
                      >
                        <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Due Date Range */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Due Date Range
                  </span>
                </div>
                <div className="flex gap-2 px-1">
                  <input
                    type="date"
                    value={filters.dueDateRange.start || ""}
                    onChange={(e) =>
                      update({
                        dueDateRange: {
                          ...filters.dueDateRange,
                          start: e.target.value || null,
                        },
                      })
                    }
                    className="flex-1 px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                  <span className="text-xs text-[var(--text-muted)] self-center">
                    to
                  </span>
                  <input
                    type="date"
                    value={filters.dueDateRange.end || ""}
                    onChange={(e) =>
                      update({
                        dueDateRange: {
                          ...filters.dueDateRange,
                          end: e.target.value || null,
                        },
                      })
                    }
                    className="flex-1 px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            {activeFilterCount > 0 && (
              <div className="p-3 border-t border-[var(--border)]">
                <button
                  onClick={clearAll}
                  className="w-full text-center text-sm text-[var(--primary)] hover:text-[var(--primary-hover)] font-medium py-1.5"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
