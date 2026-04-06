"use client";

import { useState } from "react";
import { TaskBlock as TaskBlockType, StudyTask, Tag } from "@/types";
import { TaskCard } from "./TaskCard";
import { cn } from "@/lib/cn";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableTaskItem({ task, children }: { task: StudyTask; children: React.ReactNode; }) {
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
  courseColors: Record<number, string>;
  onPlayBlock: () => void;
  onToggleComplete: (taskId: string) => void;
  onPlayTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<StudyTask>) => void;
  onUpdateBlock: (updates: Partial<TaskBlockType>) => void;
  onDeleteBlock: () => void;
  onAddTag: (taskId: string, tagId: string) => void;
  onRemoveTag: (taskId: string, tagId: string) => void;
  onEditTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  selectedTaskIds?: Set<string>;
  onSelectTask?: (taskId: string, e: React.MouseEvent) => void;
}

export function TaskBlockComponent({
  block,
  tasks,
  tags,
  courseColors,
  onPlayBlock,
  onToggleComplete,
  onPlayTask,
  onUpdateTask,
  onUpdateBlock,
  onDeleteBlock,
  onAddTag,
  onRemoveTag,
  onEditTask,
  onDeleteTask,
  selectedTaskIds,
  onSelectTask,
}: TaskBlockProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(block.name);
  const [showMenu, setShowMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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

  return (
    <motion.div
      layout
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border-2 transition-colors",
        isOver ? "border-[var(--primary)] bg-[var(--primary-light)]" : "border-[var(--border)]"
      )}
      style={{
        borderColor: isOver ? undefined : block.color + "40",
        backgroundColor: isOver ? undefined : block.color + "08",
      }}
    >
      {/* Block header */}
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-3">
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-0.5 rounded hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: block.color }}
          />
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onUpdateBlock({ name: editName });
                    setEditing(false);
                  }
                  if (e.key === "Escape") setEditing(false);
                }}
                className="text-sm font-semibold bg-[var(--bg-card)] px-2 py-0.5 rounded border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                autoFocus
              />
              <button
                onClick={() => {
                  onUpdateBlock({ name: editName });
                  setEditing(false);
                }}
                className="p-1.5 rounded hover:bg-[var(--bg-hover)]"
              >
                <Check className="w-4 h-4 text-[var(--success)]" />
              </button>
              <button
                onClick={() => setEditing(false)}
                className="p-1.5 rounded hover:bg-[var(--bg-hover)]"
              >
                <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </button>
            </div>
          ) : (
            <h3 className="text-sm font-semibold">{block.name}</h3>
          )}
          <span className="text-xs text-[var(--text-muted)]">
            {completedCount}/{tasks.length} · {totalMinutes}m
          </span>
          {totalRemainingSeconds > 0 && (
            <span className="text-xs text-[var(--text-muted)] ml-2">
              {formatRemaining(totalRemainingSeconds)} remaining
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onPlayBlock}
            className="p-2 rounded-lg hover:bg-[var(--primary-light)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
            title="Focus on all tasks in this block"
          >
            <Play className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-lg z-10 w-36 py-1">
                <button
                  onClick={() => {
                    setEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Rename
                </button>
                <button
                  onClick={() => {
                    onDeleteBlock();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 text-[var(--danger)] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
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
