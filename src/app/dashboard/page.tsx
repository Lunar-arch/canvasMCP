"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useFilteredTasks } from "@/hooks/useFilteredTasks";
import { FilterState, StudyTask, ViewMode } from "@/types";
import { TaskCard } from "@/components/TaskCard";
import { TaskBlockComponent } from "@/components/TaskBlock";
import { CalendarView } from "@/components/CalendarView";
import { FilterPanel } from "@/components/FilterPanel";
import { FocusMode } from "@/components/FocusMode";
import { TaskEditModal } from "@/components/TaskEditModal";
import { cn } from "@/lib/cn";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  ListTodo,
  Calendar,
  Plus,
  RefreshCw,
  Settings,
  BookOpen,
  Loader2,
  ArrowLeft,
  ChevronDown,
  Trash2,
  CheckCircle2,
  X,
  Layers,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BLOCK_COLORS } from "@/lib/colors";
import Link from "next/link";

function SortableTaskCard({ task, children }: { task: StudyTask; children: React.ReactNode }) {
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

function DroppableUnblocked({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "unblocked" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border-2 border-dashed transition-colors p-4",
        isOver
          ? "border-[var(--primary)] bg-[var(--primary-light)]"
          : "border-transparent"
      )}
    >
      {children}
    </div>
  );
}

const defaultFilters: FilterState = {
  search: "",
  courses: [],
  tags: [],
  priorities: [],
  dueDateRange: { start: null, end: null },
  hideCompleted: false,
};

export default function DashboardPage() {
  const {
    data,
    isLoaded,
    completeTask,
    updateTask,
    createBlock,
    updateBlock,
    deleteBlock,
    moveTaskToBlock,
    reorderTasks,
    createCourse,
    createTask,
    deleteTask,
    createTag,
    addTagToTask,
    removeTagFromTask,
    syncFromCanvas,
  } = useAppData();

  const totalRemainingSeconds = useMemo(() =>
    data.tasks.reduce((sum, t) => (!t.completed && t.secondsRemaining ? sum + t.secondsRemaining : sum), 0),
    [data.tasks]
  );

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const [view, setView] = useState<ViewMode>("tasks");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [focusTasks, setFocusTasks] = useState<StudyTask[] | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);

  // Quick-add input state
  const [quickTitle, setQuickTitle] = useState("");
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);

  // Selection state
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const filteredTasks = useFilteredTasks(data.tasks, filters, data.settings.excludedCourseIds || []);

  const courseColors = useMemo(() => {
    const map: Record<number, string> = {};
    data.courses.forEach((c) => {
      map[c.id] = c.color || "#6366f1";
    });
    return map;
  }, [data.courses]);

  const unblockedTasks = useMemo(
    () =>
      filteredTasks
        .filter((t) => !t.blockId)
        .sort((a, b) => a.order - b.order),
    [filteredTasks]
  );

  const blockTasks = useMemo(() => {
    const map: Record<string, StudyTask[]> = {};
    data.blocks.forEach((b) => {
      map[b.id] = filteredTasks
        .filter((t) => t.blockId === b.id)
        .sort((a, b) => a.order - b.order);
    });
    return map;
  }, [data.blocks, filteredTasks]);

  // All visible tasks in display order (blocks first, then unblocked)
  const allVisibleTasks = useMemo(() => {
    const fromBlocks = data.blocks.flatMap((b) => blockTasks[b.id] || []);
    return [...fromBlocks, ...unblockedTasks];
  }, [data.blocks, blockTasks, unblockedTasks]);

  // Focus mode handlers
  const startFocusAll = useCallback(() => {
    const incomplete = filteredTasks.filter((t) => !t.completed);
    if (incomplete.length > 0) {
      setFocusTasks(incomplete);
      setFocusIndex(0);
    }
  }, [filteredTasks]);

  const startFocusBlock = useCallback(
    (blockId: string) => {
      const tasks = (blockTasks[blockId] || []).filter((t) => !t.completed);
      if (tasks.length > 0) {
        setFocusTasks(tasks);
        setFocusIndex(0);
      }
    },
    [blockTasks]
  );

  const startFocusTask = useCallback(
    (taskId: string) => {
      const task = data.tasks.find((t) => t.id === taskId);
      if (task) {
        setFocusTasks([task]);
        setFocusIndex(0);
      }
    },
    [data.tasks]
  );

  // Sync handler
  const handleSync = async () => {
    if (!data.config) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.config),
      });
      const result = await res.json();
      if (res.ok) {
        syncFromCanvas(result.courses, result.assignments);
      }
    } catch {
      // Silent fail
    } finally {
      setSyncing(false);
    }
  };

  // Quick-add handlers
  const handleQuickAddTask = useCallback(
    ({ openEditor = false }: { openEditor?: boolean } = {}) => {
      const title = quickTitle.trim();
      if (!title) return;
      const task = createTask({ title });

      if (openEditor) {
        setCreatingTaskId(task.id);
        setTimeout(() => setEditingTaskId(task.id), 0);
      }

      setQuickTitle("");
      setShowAddDropdown(false);
    },
    [quickTitle, createTask]
  );

  const handleQuickAddBlock = useCallback(() => {
    const name = quickTitle.trim();
    if (!name) return;
    createBlock(name, BLOCK_COLORS[data.blocks.length % BLOCK_COLORS.length]);
    setQuickTitle("");
    setShowAddDropdown(false);
  }, [quickTitle, createBlock, data.blocks.length]);

  const handleQuickKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleQuickAddTask({ openEditor: true });
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      handleQuickAddBlock();
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleQuickAddTask();
    } else if (e.key === "Escape") {
      setQuickTitle("");
    }
  };

  const handleQuickTaskOnlyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleQuickAddTask({ openEditor: e.ctrlKey || e.metaKey });
    } else if (e.key === "Escape") {
      setQuickTitle("");
    }
  };

  const handleQuickPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text");
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.replace(/^[\s\t]*[-*•◦▪▸►>]+\s*/, "").trim())
        .filter(Boolean);
      if (lines.length <= 1) return; // single line — let browser handle normally
      e.preventDefault();
      lines.forEach((title) => createTask({ title }));
      setQuickTitle("");
    },
    [createTask]
  );

  // Selection handler
  const handleTaskSelect = useCallback(
    (taskId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.shiftKey && lastSelectedId) {
        const allIds = allVisibleTasks.map((t) => t.id);
        const startIdx = allIds.indexOf(lastSelectedId);
        const endIdx = allIds.indexOf(taskId);
        if (startIdx !== -1 && endIdx !== -1) {
          const [lo, hi] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
          setSelectedTaskIds(new Set(allIds.slice(lo, hi + 1)));
        }
      } else if (e.ctrlKey || e.metaKey) {
        setSelectedTaskIds((prev) => {
          const next = new Set(prev);
          if (next.has(taskId)) next.delete(taskId);
          else next.add(taskId);
          return next;
        });
        setLastSelectedId(taskId);
      } else {
        if (selectedTaskIds.size === 1 && selectedTaskIds.has(taskId)) {
          setSelectedTaskIds(new Set());
          setLastSelectedId(null);
        } else {
          setSelectedTaskIds(new Set([taskId]));
          setLastSelectedId(taskId);
        }
      }
    },
    [allVisibleTasks, lastSelectedId, selectedTaskIds]
  );

  const clearSelection = () => {
    setSelectedTaskIds(new Set());
    setLastSelectedId(null);
  };

  // Bulk actions
  const bulkComplete = () => {
    selectedTaskIds.forEach((id) => completeTask(id));
    clearSelection();
  };

  const bulkDelete = () => {
    if (!confirm(`Delete ${selectedTaskIds.size} task(s)? This cannot be undone.`)) return;
    selectedTaskIds.forEach((id) => deleteTask(id));
    clearSelection();
  };

  const bulkSetPriority = (priority: StudyTask["priority"]) => {
    selectedTaskIds.forEach((id) => updateTask(id, { priority }));
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setDraggedId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const activeTask = data.tasks.find((t) => t.id === taskId);
    if (active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeTask) return;

    if (overId.startsWith("block-")) {
      const blockId = overId.replace("block-", "");
      moveTaskToBlock(taskId, blockId);
      return;
    }

    if (overId === "unblocked") {
      moveTaskToBlock(taskId, undefined);
      return;
    }

    const destTask = data.tasks.find((t) => t.id === overId);
    if (!destTask) return;

    const sourceBlock = activeTask.blockId;
    const destBlock = destTask.blockId;

    if (sourceBlock === destBlock) {
      const list = (sourceBlock ? blockTasks[sourceBlock] || [] : unblockedTasks).map((t) => t.id);
      const oldIndex = list.indexOf(taskId);
      const newIndex = list.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const next = arrayMove(list, oldIndex, newIndex);
        reorderTasks(next);
      }
      return;
    }

    const destList = (destBlock ? blockTasks[destBlock] || [] : unblockedTasks).map((t) => t.id).filter((id) => id !== taskId);
    const insertIndex = destList.indexOf(overId);
    const nextDest = [...destList];
    nextDest.splice(insertIndex === -1 ? nextDest.length : insertIndex, 0, taskId);

    moveTaskToBlock(taskId, destBlock);
    reorderTasks(nextDest);

    const sourceList = (sourceBlock ? blockTasks[sourceBlock] || [] : unblockedTasks).map((t) => t.id).filter((id) => id !== taskId);
    reorderTasks(sourceList);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalTime = filteredTasks
    .filter((t) => !t.completed)
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const completedCount = filteredTasks.filter((t) => t.completed).length;

  return (
    <>
      <div className="min-h-screen bg-[var(--bg)]">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-[var(--bg)]/80 backdrop-blur-xl border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--primary)] flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <h1 className="text-lg font-bold">StudyFlow</h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {totalRemainingSeconds > 0 && (
                  <span className="text-xs text-[var(--text-secondary)] mr-2">
                    Remaining {formatSeconds(totalRemainingSeconds)}
                  </span>
                )}
                <button
                  onClick={startFocusAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
                  title="Focus on all tasks"
                >
                  <Play className="w-4 h-4" />
                  Focus
                </button>

                {/* Filter */}
                <FilterPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  courses={data.courses}
                  tags={data.tags}
                  onCreateTag={createTag}
                />

                {/* View toggle */}
                <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1">
                  <button
                    onClick={() => setView("tasks")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      view === "tasks"
                        ? "bg-[var(--primary)] text-white"
                        : "hover:bg-[var(--bg-hover)]"
                    )}
                  >
                    <ListTodo className="w-4 h-4" />
                    Tasks
                  </button>
                  <button
                    onClick={() => setView("calendar")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      view === "calendar"
                        ? "bg-[var(--primary)] text-white"
                        : "hover:bg-[var(--bg-hover)]"
                    )}
                  >
                    <Calendar className="w-4 h-4" />
                    Calendar
                  </button>
                </div>

                {/* Sync */}
                <button
                  onClick={handleSync}
                  disabled={syncing || !data.config}
                  className="p-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
                  title="Sync with Canvas"
                >
                  {syncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>

                {/* Settings */}
                <Link
                  href="/setup"
                  className="p-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-6 text-sm text-[var(--text-secondary)]">
            <span>
              <strong className="text-[var(--text)]">
                {filteredTasks.length}
              </strong>{" "}
              tasks
            </span>
            <span>
              <strong className="text-[var(--success)]">{completedCount}</strong>{" "}
              done
            </span>
            <span>
              ~<strong className="text-[var(--text)]">{totalTime}</strong> min
              remaining
            </span>
            {data.lastSynced && (
              <span className="text-xs text-[var(--text-muted)]">
                Synced {new Date(data.lastSynced).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          {data.tasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20 space-y-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-accent)] flex items-center justify-center mx-auto">
                <BookOpen className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
              <h2 className="text-xl font-semibold">No tasks yet</h2>
              <p className="text-[var(--text-secondary)] max-w-sm mx-auto">
                Set up your Canvas connection and sync your assignments, or add a task manually to get started.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/setup"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white font-medium text-sm hover:bg-[var(--primary-hover)] transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Setup Canvas
                </Link>

                <div className="w-full sm:w-auto sm:min-w-[360px] max-w-lg flex items-center gap-2">
                  <input
                    type="text"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    onKeyDown={handleQuickTaskOnlyKeyDown}
                    placeholder="Add a task... (Ctrl+Enter to edit)"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] placeholder:text-[var(--text-muted)]"
                  />
                  <button
                    onClick={() => handleQuickAddTask()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Task
                  </button>
                </div>
              </div>
            </motion.div>
          ) : view === "calendar" ? (
            <CalendarView
              tasks={filteredTasks}
              tags={data.tags}
              courseColors={courseColors}
              onToggleComplete={completeTask}
              onPlayTask={startFocusTask}
            />
          ) : (
            <>
              {/* Quick-add bar */}
              <div className="flex items-center gap-2 mb-6">
                <input
                  type="text"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  onKeyDown={handleQuickKeyDown}
                  placeholder="Add a task... (Ctrl+Enter to edit, Shift+Enter for block)"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] placeholder:text-[var(--text-muted)]"
                />
                <div className="relative" ref={addDropdownRef}>
                  <button
                    onClick={() => {
                      if (quickTitle.trim()) {
                        handleQuickAddTask();
                      } else {
                        setShowAddDropdown((s) => !s);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm hover:bg-[var(--bg-hover)] transition-colors"
                    title="Add task or block"
                  >
                    <Plus className="w-4 h-4" />
                    <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>
                  {showAddDropdown && (
                    <div className="absolute right-0 top-full mt-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-lg z-10 w-44 py-1">
                      <button
                        onClick={() => handleQuickAddTask()}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Task
                        <kbd className="ml-auto text-[10px] text-[var(--text-muted)]">Enter</kbd>
                      </button>
                      <button
                        onClick={handleQuickAddBlock}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        New Block
                        <kbd className="ml-auto text-[10px] text-[var(--text-muted)]">⇧Enter</kbd>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="space-y-6">
                  {/* Task blocks */}
                  {data.blocks.map((block) => (
                    <TaskBlockComponent
                      key={block.id}
                      block={block}
                      tasks={blockTasks[block.id] || []}
                      tags={data.tags}
                      courses={data.courses}
                      courseColors={courseColors}
                      onPlayBlock={() => startFocusBlock(block.id)}
                      onToggleComplete={completeTask}
                      onPlayTask={startFocusTask}
                      onUpdateTask={updateTask}
                      onUpdateBlock={(updates) => updateBlock(block.id, updates)}
                      onDeleteBlock={() => deleteBlock(block.id)}
                      onAddTag={addTagToTask}
                      onRemoveTag={removeTagFromTask}
                      onBulkUpdateTasks={(updates) => {
                        (blockTasks[block.id] || []).forEach((task) => {
                          updateTask(task.id, updates);
                        });
                      }}
                      onEditTask={(taskId) => setEditingTaskId(taskId)}
                      onDeleteTask={(taskId) => deleteTask(taskId)}
                      selectedTaskIds={selectedTaskIds}
                      onSelectTask={handleTaskSelect}
                    />
                  ))}

                  {/* New block button */}
                  <button
                    onClick={() => {
                      const name = `Block ${data.blocks.length + 1}`;
                      createBlock(name, BLOCK_COLORS[data.blocks.length % BLOCK_COLORS.length]);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                  >
                    <Layers className="w-4 h-4" />
                    New Block
                  </button>

                  {/* Unblocked tasks */}
                  <DroppableUnblocked>
                    {data.blocks.length > 0 && unblockedTasks.length > 0 && (
                      <h3 className="text-sm font-semibold text-[var(--text-secondary)] px-1 mb-2">
                        Unsorted Tasks
                      </h3>
                    )}
                    {unblockedTasks.length > 0 ? (
                      <SortableContext items={unblockedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {unblockedTasks.map((task) => (
                            <SortableTaskCard key={task.id} task={task}>
                              <TaskCard
                                task={task}
                                tags={data.tags}
                                courseColor={
                                  task.courseId
                                    ? courseColors[task.courseId]
                                    : undefined
                                }
                                onToggleComplete={() => completeTask(task.id)}
                                onPlay={() => startFocusTask(task.id)}
                                onUpdate={(updates) => updateTask(task.id, updates)}
                                onAddTag={(tagId) => addTagToTask(task.id, tagId)}
                                onRemoveTag={(tagId) => removeTagFromTask(task.id, tagId)}
                                onEdit={() => setEditingTaskId(task.id)}
                                onDelete={() => deleteTask(task.id)}
                                isSelected={selectedTaskIds.has(task.id)}
                                onSelect={(e) => handleTaskSelect(task.id, e)}
                              />
                            </SortableTaskCard>
                          ))}
                        </div>
                      </SortableContext>
                    ) : data.blocks.length > 0 ? (
                      <p className="text-xs text-[var(--text-muted)] text-center py-2">
                        Drop tasks here to unsort them
                      </p>
                    ) : null}
                  </DroppableUnblocked>
                </div>

                <DragOverlay>
                  {draggedId ? (
                    <div className="drag-overlay">
                      <TaskCard
                        task={data.tasks.find((t) => t.id === draggedId)!}
                        tags={data.tags}
                        onToggleComplete={() => {}}
                        onPlay={() => {}}
                        onUpdate={() => {}}
                        onAddTag={() => {}}
                        onRemoveTag={() => {}}
                        isDragging
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </>
          )}
        </div>
      </div>

      {/* Bulk edit panel — fixed in left margin when tasks are selected */}
      <AnimatePresence>
        {selectedTaskIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className="fixed left-4 top-1/2 -translate-y-1/2 z-50 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl p-3 flex flex-col gap-2 w-44"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {selectedTaskIds.size} selected
              </span>
              <button
                onClick={clearSelection}
                className="p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={bulkComplete}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-[var(--bg-hover)] transition-colors w-full text-left"
            >
              <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
              Complete all
            </button>

            <button
              onClick={bulkDelete}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-red-50 text-[var(--danger)] transition-colors w-full text-left"
            >
              <Trash2 className="w-4 h-4" />
              Delete all
            </button>

            <div className="border-t border-[var(--border)] pt-2 mt-1">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5 px-1">Set priority</p>
              <div className="flex flex-col gap-1">
                {([null, "low", "medium", "high", "urgent"] as StudyTask["priority"][]).map((p) => (
                  <button
                    key={String(p)}
                    onClick={() => bulkSetPriority(p)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-hover)] transition-colors text-left"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: p === null ? "#cbd5e1" : p === "low" ? "#94a3b8" : p === "medium" ? "#f59e0b" : p === "high" ? "#f97316" : "#ef4444",
                      }}
                    />
                    {p === null ? "None" : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task edit modal */}
      <AnimatePresence>
        {editingTaskId && (() => {
          const editTask = data.tasks.find((t) => t.id === editingTaskId);
          if (!editTask) return null;
          return (
            <TaskEditModal
              key={editingTaskId}
              task={editTask}
              tags={data.tags}
              courses={data.courses}
              onCreateCourse={(name, code, color) => createCourse(name, code, color)}
              onUpdate={(updates) => updateTask(editingTaskId, updates)}
              onAddTag={(tagId) => addTagToTask(editingTaskId, tagId)}
              onRemoveTag={(tagId) => removeTagFromTask(editingTaskId, tagId)}
              onCreateTag={createTag}
              onClose={() => {
                if (creatingTaskId === editingTaskId) setCreatingTaskId(null);
                setEditingTaskId(null);
              }}
              onDelete={
                creatingTaskId === editingTaskId
                  ? undefined
                  : () => {
                      deleteTask(editingTaskId);
                      setEditingTaskId(null);
                    }
              }
            />
          );
        })()}
      </AnimatePresence>

      {/* Focus mode overlay */}
      <AnimatePresence>
        {focusTasks && (
          <FocusMode
            tasks={focusTasks}
            currentIndex={focusIndex}
            defaultTimerMinutes={data.settings.defaultTimerMinutes}
            extraTimeMinutes={data.settings.extraTimeMinutes}
            onComplete={(taskId) => {
              updateTask(taskId, { secondsRemaining: 0 });
              completeTask(taskId);
            }}
            onSkip={() => {}}
            onSaveRemaining={(taskId, secs) => updateTask(taskId, { secondsRemaining: secs })}
            onClose={() => setFocusTasks(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
