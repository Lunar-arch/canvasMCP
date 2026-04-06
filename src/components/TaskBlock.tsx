"use client";

import { useState, useRef, useEffect } from "react";
import { TaskBlock as TaskBlockType, StudyTask, Tag, Course } from "@/types";
import { TaskCard } from "./TaskCard";
import { cn } from "@/lib/cn";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Settings,
  Trash2,
  ChevronDown,
  ChevronRight,
  Timer,
} from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BLOCK_COLORS } from "@/lib/colors";

function SortableTaskItem({ task, children }: { task: StudyTask; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

interface TaskBlockProps {
  block: TaskBlockType;
  tasks: StudyTask[];
  tags: Tag[];
  courses: Course[];
  courseColors: Record<number, string>;
  onPlayBlock: () => void;
  onToggleComplete: (taskId: string) => void;
  onPlayTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<StudyTask>) => void;
  onUpdateBlock: (updates: Partial<TaskBlockType>) => void;
  onDeleteBlock: () => void;
  onAddTag: (taskId: string, tagId: string) => void;
  onRemoveTag: (taskId: string, tagId: string) => void;
  onBulkUpdateTasks: (updates: Partial<StudyTask>) => void;
  onEditTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  selectedTaskIds?: Set<string>;
  onSelectTask?: (taskId: string, e: React.MouseEvent) => void;
}

export function TaskBlockComponent({
  block,
  tasks,
  tags,
  courses,
  courseColors,
  onPlayBlock,
  onToggleComplete,
  onPlayTask,
  onUpdateTask,
  onUpdateBlock,
  onDeleteBlock,
  onAddTag,
  onRemoveTag,
  onBulkUpdateTasks,
  onEditTask,
  onDeleteTask,
  selectedTaskIds,
  onSelectTask,
}: TaskBlockProps) {
  const [blockName, setBlockName] = useState(block.name);
  const [showSettings, setShowSettings] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [breakEnabled, setBreakEnabled] = useState(!!block.breakMinutes);
  const [breakMinutes, setBreakMinutes] = useState(String(block.breakMinutes || 5));
  const settingsRef = useRef<HTMLDivElement>(null);

  const { setNodeRef, isOver } = useDroppable({ id: `block-${block.id}` });

  const totalMinutes = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalRemainingSeconds = tasks.reduce((sum, t) => sum + (t.secondsRemaining || 0), 0);

  const formatRemaining = (secs: number) => {
    if (!secs) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  };

  useEffect(() => {
    setBlockName(block.name);
  }, [block.name]);

  useEffect(() => {
    setBreakEnabled(!!block.breakMinutes);
    setBreakMinutes(String(block.breakMinutes || 5));
  }, [block.breakMinutes]);

  useEffect(() => {
    if (!showSettings) return;
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSettings]);

  const commitName = () => {
    const trimmed = blockName.trim();
    if (trimmed && trimmed !== block.name) {
      onUpdateBlock({ name: trimmed });
    } else {
      setBlockName(block.name);
    }
  };

  const handleBreakToggle = () => {
    const enabled = !breakEnabled;
    setBreakEnabled(enabled);
    onUpdateBlock({ breakMinutes: enabled ? (parseInt(breakMinutes) || 5) : undefined });
  };

  const handleBreakMinutesBlur = () => {
    const val = parseInt(breakMinutes) || 5;
    setBreakMinutes(String(val));
    if (breakEnabled) onUpdateBlock({ breakMinutes: val });
  };

  return (
    <motion.div
      layout
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border-2 transition-colors",
        isOver ? "border-[var(--primary)] bg-[var(--primary-light)]" : ""
      )}
      style={{
        borderColor: isOver ? undefined : block.color + "40",
        backgroundColor: isOver ? undefined : block.color + "08",
      }}
    >
      {/* Block header */}
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-0.5 rounded hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)] shrink-0"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: block.color }} />

          {/* Always-visible name input */}
          <input
            type="text"
            value={blockName}
            onChange={(e) => setBlockName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") { setBlockName(block.name); e.currentTarget.blur(); }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border border-transparent rounded px-1 -ml-1 focus:outline-none focus:border-[var(--border)] min-w-0 flex-1 max-w-[200px] transition-colors"
          />

          <span className="text-xs text-[var(--text-muted)] shrink-0">
            {completedCount}/{tasks.length} · {totalMinutes}m
          </span>
          {totalRemainingSeconds > 0 && (
            <span className="text-xs text-[var(--text-muted)] shrink-0 ml-1">
              {formatRemaining(totalRemainingSeconds)} left
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onPlayBlock}
            className="p-2 rounded-lg hover:bg-[var(--primary-light)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
            title="Focus on all tasks in this block"
          >
            <Play className="w-4 h-4" />
          </button>

          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings((s) => !s)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showSettings
                  ? "bg-[var(--bg-hover)] text-[var(--text)]"
                  : "hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
              )}
              title="Block settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-xl z-20 w-64 p-3 space-y-4"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {/* Color */}
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Color</p>
                    <div className="flex flex-wrap gap-2">
                      {BLOCK_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => onUpdateBlock({ color: c })}
                          className={cn(
                            "w-5 h-5 rounded-full transition-transform hover:scale-110",
                            block.color === c && "ring-2 ring-offset-1 ring-[var(--text)]"
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Break between tasks */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Break after each task</p>
                      <button
                        onClick={handleBreakToggle}
                        className="relative shrink-0 transition-colors rounded-full"
                        style={{ width: 32, height: 18, backgroundColor: breakEnabled ? "var(--primary)" : "var(--border)" }}
                      >
                        <span
                          className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all"
                          style={{ left: breakEnabled ? 14 : 2 }}
                        />
                      </button>
                    </div>
                    {breakEnabled && (
                      <div className="flex items-center gap-2">
                        <Timer className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                        <input
                          type="number"
                          value={breakMinutes}
                          min={1}
                          max={60}
                          onChange={(e) => setBreakMinutes(e.target.value)}
                          onBlur={handleBreakMinutesBlur}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          className="w-14 text-xs px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                        />
                        <span className="text-xs text-[var(--text-muted)]">min break</span>
                      </div>
                    )}
                  </div>

                  {/* Set course for all tasks */}
                  {courses.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Set course for all tasks</p>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const courseId = parseInt(e.target.value);
                          if (!courseId) return;
                          const course = courses.find((c) => c.id === courseId);
                          if (!course) return;
                          onBulkUpdateTasks({ courseId: course.id, courseName: course.name });
                          e.target.value = "";
                        }}
                        className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                      >
                        <option value="">Select course...</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Add tag to all tasks */}
                  {tags.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Add tag to all tasks</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => {
                              tasks.forEach((t) => {
                                if (!t.tags.includes(tag.id)) {
                                  onAddTag(t.id, tag.id);
                                }
                              });
                            }}
                            className="text-xs px-2 py-0.5 rounded-md text-white hover:opacity-75 transition-opacity"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Delete */}
                  <div className="border-t border-[var(--border)] pt-2">
                    <button
                      onClick={() => { onDeleteBlock(); setShowSettings(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-[var(--danger)] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete block
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="tasks"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              {tasks.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">
                  Drag tasks here
                </p>
              )}
              <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <SortableTaskItem key={task.id} task={task}>
                      <TaskCard
                        task={task}
                        tags={tags}
                        courseColor={task.courseId ? courseColors[task.courseId] : undefined}
                        onToggleComplete={() => onToggleComplete(task.id)}
                        onPlay={() => onPlayTask(task.id)}
                        onUpdate={(updates) => onUpdateTask(task.id, updates)}
                        onAddTag={(tagId) => onAddTag(task.id, tagId)}
                        onRemoveTag={(tagId) => onRemoveTag(task.id, tagId)}
                        onEdit={onEditTask ? () => onEditTask(task.id) : undefined}
                        onDelete={onDeleteTask ? () => onDeleteTask(task.id) : undefined}
                        isSelected={selectedTaskIds?.has(task.id)}
                        onSelect={onSelectTask ? (e) => onSelectTask(task.id, e) : undefined}
                      />
                    </SortableTaskItem>
                  ))}
                </div>
              </SortableContext>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
