"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useFilteredTasks } from "@/hooks/useFilteredTasks";
import { CanvasSyncOptions, FilterState, StudyTask, ViewMode } from "@/types";
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
  ChevronUp,
  Trash2,
  CheckCircle2,
  X,
  Layers,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
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
import { CustomSelect } from "@/components/ui/CustomSelect";

function SortableTaskCard({
  task,
  children,
  showStackPreview = false,
  stackCount = 1,
}: {
  task: StudyTask;
  children: React.ReactNode;
  showStackPreview?: boolean;
  stackCount?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} className="relative" {...attributes} {...listeners}>
      {showStackPreview && isDragging && stackCount > 1 && (
        <>
          <div className="absolute inset-0 translate-x-2 translate-y-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] opacity-75 pointer-events-none" />
          {stackCount > 2 && (
            <div className="absolute inset-0 translate-x-4 translate-y-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] opacity-50 pointer-events-none" />
          )}
        </>
      )}
      <div className="relative">
        {children}
        {showStackPreview && isDragging && stackCount > 1 && (
          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center shadow-sm z-10 pointer-events-none">
            {stackCount}
          </div>
        )}
      </div>
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
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [multiDragIds, setMultiDragIds] = useState<Set<string> | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);

  // Quick-add input state
  const [quickTitle, setQuickTitle] = useState("");
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);

  // Bulk edit local state
  const [bulkEstimateValue, setBulkEstimateValue] = useState("");
  const [bulkDateValue, setBulkDateValue] = useState("");
  const [bulkDescription, setBulkDescription] = useState("");
  const [showBulkDatePicker, setShowBulkDatePicker] = useState(false);
  const [bulkCourseValue, setBulkCourseValue] = useState("");
  const [bulkMoveBlockValue, setBulkMoveBlockValue] = useState("");

  // Selection state
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkPanelCollapsed, setBulkPanelCollapsed] = useState(true);

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

  const activeDragTask = useMemo(
    () => (draggedId ? data.tasks.find((t) => t.id === draggedId) || null : null),
    [draggedId, data.tasks]
  );

  const blockDropPreview = useMemo(() => {
    if (!activeDragTask || !dragOverId) return null;

    let targetBlockId: string | undefined;
    let insertIndex = 0;

    if (dragOverId.startsWith("block-")) {
      targetBlockId = dragOverId.replace("block-", "");
      const destinationIds = (blockTasks[targetBlockId] || [])
        .map((t) => t.id)
        .filter((id) => id !== activeDragTask.id);
      insertIndex = destinationIds.length;
    } else {
      const overTask = data.tasks.find((t) => t.id === dragOverId);
      if (!overTask?.blockId) return null;
      targetBlockId = overTask.blockId;
      const destinationIds = (blockTasks[targetBlockId] || [])
        .map((t) => t.id)
        .filter((id) => id !== activeDragTask.id);
      const overIndex = destinationIds.indexOf(dragOverId);
      insertIndex = overIndex === -1 ? destinationIds.length : overIndex;
    }

    if (!targetBlockId || activeDragTask.blockId === targetBlockId) return null;

    return {
      blockId: targetBlockId,
      index: insertIndex,
      count: multiDragIds && multiDragIds.size > 1 ? multiDragIds.size : 1,
    };
  }, [activeDragTask, dragOverId, data.tasks, blockTasks, multiDragIds]);

  // All visible tasks in display order (blocks first, then unblocked)
  const allVisibleTasks = useMemo(() => {
    const fromBlocks = data.blocks.flatMap((b) => blockTasks[b.id] || []);
    return [...fromBlocks, ...unblockedTasks];
  }, [data.blocks, blockTasks, unblockedTasks]);

  const bulkCourseOptions = useMemo(
    () => data.courses.map((c) => ({ value: String(c.id), label: c.name, color: c.color })),
    [data.courses]
  );

  const bulkBlockOptions = useMemo(
    () => [
      { value: "none", label: "Unsorted" },
      ...data.blocks.map((b) => ({ value: b.id, label: b.name, color: b.color })),
    ],
    [data.blocks]
  );

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
        const syncOptions: CanvasSyncOptions = data.config?.syncOptions || {
          trackedCourseIds: data.settings.canvasTrackedCourseIds || [],
          onlyAddFromDate: data.settings.canvasOnlyAddFromDate || null,
          excludeNoDueDateTasks: data.settings.canvasSkipNoDueDateTasks || false,
          reviewNoDueDateTasks: data.settings.canvasReviewNoDueDateTasks || false,
          approvedNoDueAssignmentIds: [],
        };
        syncFromCanvas(result.courses, result.assignments, syncOptions);
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

  const bulkSetCourse = (courseId: number, courseName: string) => {
    selectedTaskIds.forEach((id) => updateTask(id, { courseId, courseName }));
  };

  const bulkAddTag = (tagId: string) => {
    selectedTaskIds.forEach((id) => {
      const task = data.tasks.find((t) => t.id === id);
      if (task && !task.tags.includes(tagId)) addTagToTask(id, tagId);
    });
  };

  const bulkRemoveTag = (tagId: string) => {
    selectedTaskIds.forEach((id) => removeTagFromTask(id, tagId));
  };

  const bulkSetEstimate = (minutes: number) => {
    selectedTaskIds.forEach((id) => updateTask(id, { estimatedMinutes: minutes }));
  };

  const bulkSetDueDate = (dueAt: string | null) => {
    selectedTaskIds.forEach((id) => updateTask(id, { dueAt }));
  };

  const bulkSetDescription = (description: string) => {
    selectedTaskIds.forEach((id) => updateTask(id, { description }));
  };

  const bulkMoveToBlock = (blockId: string | undefined) => {
    selectedTaskIds.forEach((id) => moveTaskToBlock(id, blockId));
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    setDraggedId(activeId);
    setDragOverId(null);
    if (selectedTaskIds.has(activeId) && selectedTaskIds.size > 1) {
      setMultiDragIds(new Set(selectedTaskIds));
    } else {
      setMultiDragIds(null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    setDragOverId(event.over ? String(event.over.id) : null);
  };

  const handleDragCancel = () => {
    setDraggedId(null);
    setDragOverId(null);
    setMultiDragIds(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedId(null);
    setDragOverId(null);
    const { active, over } = event;
    if (!over) { setMultiDragIds(null); return; }

    const taskId = active.id as string;
    const activeTask = data.tasks.find((t) => t.id === taskId);
    if (!activeTask) { setMultiDragIds(null); return; }

    const overId = String(over.id);

    // Determine destination block
    let destBlockId: string | undefined;
    if (overId.startsWith("block-")) {
      destBlockId = overId.replace("block-", "");
    } else if (overId === "unblocked") {
      destBlockId = undefined;
    } else {
      const destTask = data.tasks.find((t) => t.id === overId);
      if (destTask) destBlockId = destTask.blockId;
    }

    // Multi-drag: move all selected tasks to destination block preserving relative order
    if (multiDragIds && multiDragIds.size > 1) {
      const orderedIds = allVisibleTasks.filter((t) => multiDragIds.has(t.id)).map((t) => t.id);
      orderedIds.forEach((id) => moveTaskToBlock(id, destBlockId));
      setMultiDragIds(null);
      return;
    }

    if (active.id === over.id) return;

    if (overId.startsWith("block-")) {
      moveTaskToBlock(taskId, destBlockId);
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
    .reduce((sum, t) => sum + Math.max(0, t.estimatedMinutes || 0), 0);
  const completedCount = filteredTasks.filter((t) => t.completed).length;

  return (
    <>
      <div className="min-h-screen bg-[var(--bg)]">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-[var(--bg)]/80 backdrop-blur-xl border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-16 gap-2">
              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <Link
                  href="/"
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--primary)] flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <h1 className="hidden sm:block text-lg font-bold">StudyFlow</h1>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-3 min-w-0">
                {totalRemainingSeconds > 0 && (
                  <span className="hidden md:inline text-xs text-[var(--text-secondary)]">
                    {formatSeconds(totalRemainingSeconds)} left
                  </span>
                )}
                <button
                  onClick={startFocusAll}
                  className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors shrink-0"
                  title="Focus on all tasks"
                >
                  <Play className="w-4 h-4" />
                  <span className="hidden sm:inline">Focus</span>
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
                <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 shrink-0">
                  <button
                    onClick={() => setView("tasks")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      view === "tasks"
                        ? "bg-[var(--primary)] text-white"
                        : "hover:bg-[var(--bg-hover)]"
                    )}
                  >
                    <ListTodo className="w-4 h-4" />
                    <span className="hidden sm:inline">Tasks</span>
                  </button>
                  <button
                    onClick={() => setView("calendar")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      view === "calendar"
                        ? "bg-[var(--primary)] text-white"
                        : "hover:bg-[var(--bg-hover)]"
                    )}
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="hidden sm:inline">Calendar</span>
                  </button>
                </div>

                {/* Sync */}
                <button
                  onClick={handleSync}
                  disabled={syncing || !data.config}
                  className="p-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50 shrink-0"
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
                  className="p-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
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
            {totalTime > 0 ? (
              <span>
                ~<strong className="text-[var(--text)]">{totalTime}</strong> min
                remaining
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">No estimated time</span>
            )}
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
            <div className="max-w-2xl mx-auto">
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
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
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
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <div className="space-y-6 min-w-96">
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
                      onCreateTag={createTag}
                      onBulkUpdateTasks={(updates) => {
                        (blockTasks[block.id] || []).forEach((t) => updateTask(t.id, updates));
                      }}
                      onEditTask={(taskId) => setEditingTaskId(taskId)}
                      onDeleteTask={(taskId) => deleteTask(taskId)}
                      selectedTaskIds={selectedTaskIds}
                      onSelectTask={handleTaskSelect}
                      draggedTaskId={draggedId}
                      multiDragCount={multiDragIds?.size ?? 0}
                      dropPreviewIndex={blockDropPreview?.blockId === block.id ? blockDropPreview.index : null}
                      dropPreviewCount={blockDropPreview?.blockId === block.id ? blockDropPreview.count : 1}
                    />
                  ))}

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
                            <SortableTaskCard
                              key={task.id}
                              task={task}
                              showStackPreview={multiDragIds ? multiDragIds.size > 1 && draggedId === task.id : false}
                              stackCount={multiDragIds?.size ?? 0}
                            >
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
                  {draggedId && data.tasks.find((t) => t.id === draggedId) ? (
                    <div className="relative">
                      {/* Shadow cards for multi-drag stack effect */}
                      {multiDragIds && multiDragIds.size > 1 && (
                        <>
                          <div className="absolute inset-0 translate-x-2 translate-y-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] opacity-75 pointer-events-none" />
                          {multiDragIds.size > 2 && (
                            <div className="absolute inset-0 translate-x-4 translate-y-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] opacity-50 pointer-events-none" />
                          )}
                        </>
                      )}
                      <div className="relative">
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
                        {multiDragIds && multiDragIds.size > 1 && (
                          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center shadow-sm z-10">
                            {multiDragIds.size}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          )}
        </div>
      </div>

      {/* Bulk edit panel — bottom bar with upward dropdown */}
      <AnimatePresence>
        {selectedTaskIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 z-50 flex flex-col items-center md:items-start"
          >
            {/* Expanded dropdown (opens upward) */}
            <AnimatePresence>
              {!bulkPanelCollapsed && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  className="mb-2 w-72 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl p-3 flex flex-col gap-0 max-h-[60vh] overflow-y-auto"
                >
                  {/* Quick actions */}
                  <button onClick={bulkComplete} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-[var(--bg-hover)] transition-colors w-full text-left">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                    <span className="text-xs">Complete all</span>
                  </button>
                  <button onClick={bulkDelete} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-red-50 text-[var(--danger)] transition-colors w-full text-left">
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs">Delete all</span>
                  </button>

                  {/* Priority */}
                  <div className="border-t border-[var(--border)] mt-2 pt-2">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Priority</p>
                    <div className="flex items-center gap-1.5">
                      {([null, "low", "medium", "high", "urgent"] as StudyTask["priority"][]).map((p) => (
                        <button
                          key={String(p)}
                          onClick={() => bulkSetPriority(p)}
                          title={p === null ? "None" : p.charAt(0).toUpperCase() + p.slice(1)}
                          className="w-5 h-5 rounded-full border-2 border-transparent hover:scale-110 transition-transform shrink-0"
                          style={{
                            backgroundColor: p === null ? "#cbd5e1" : p === "low" ? "#94a3b8" : p === "medium" ? "#f59e0b" : p === "high" ? "#f97316" : "#ef4444",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Est. duration */}
                  <div className="border-t border-[var(--border)] mt-2 pt-2">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Est. duration</p>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        placeholder="—"
                        value={bulkEstimateValue}
                        onChange={(e) => setBulkEstimateValue(e.target.value)}
                        onBlur={() => {
                          const val = parseInt(bulkEstimateValue);
                          if (!Number.isNaN(val) && val >= 0) {
                            bulkSetEstimate(val);
                            setBulkEstimateValue("");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                      />
                      <span className="text-xs text-[var(--text-muted)] shrink-0">min</span>
                    </div>
                  </div>

                  {/* Due date */}
                  <div className="border-t border-[var(--border)] mt-2 pt-2">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Due date</p>
                    {!showBulkDatePicker ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => setShowBulkDatePicker(true)}
                          className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--bg-hover)] transition-colors text-left text-[var(--text-muted)] truncate"
                        >
                          {bulkDateValue ? new Date(bulkDateValue).toLocaleDateString() : "Set date..."}
                        </button>
                        <button
                          onClick={() => { bulkSetDueDate(null); setBulkDateValue(""); }}
                          className="text-xs px-1.5 py-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)]"
                          title="Clear"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <input
                          type="datetime-local"
                          value={bulkDateValue}
                          onChange={(e) => setBulkDateValue(e.target.value)}
                          autoFocus
                          className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => { if (bulkDateValue) bulkSetDueDate(new Date(bulkDateValue).toISOString()); setShowBulkDatePicker(false); }}
                            className="flex-1 text-xs px-2 py-1 rounded-lg bg-[var(--primary)] text-white"
                          >
                            Apply
                          </button>
                          <button onClick={() => setShowBulkDatePicker(false)} className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">✕</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Course */}
                  {data.courses.length > 0 && (
                    <div className="border-t border-[var(--border)] mt-2 pt-2">
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Course</p>
                      <CustomSelect
                        value={bulkCourseValue}
                        onChange={(val) => {
                          setBulkCourseValue("");
                          const courseId = parseInt(val);
                          if (!courseId) return;
                          const course = data.courses.find((c) => c.id === courseId);
                          if (course) bulkSetCourse(course.id, course.name);
                        }}
                        options={bulkCourseOptions}
                        placeholder="Set course..."
                      />
                    </div>
                  )}

                  {/* Tags */}
                  {data.tags.length > 0 && (
                    <div className="border-t border-[var(--border)] mt-2 pt-2">
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Tags</p>
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {data.tags.map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => bulkAddTag(tag.id)}
                            title={`Add "${tag.name}" to all`}
                            className="text-[10px] px-1.5 py-0.5 rounded text-white hover:opacity-75 transition-opacity"
                            style={{ backgroundColor: tag.color }}
                          >
                            + {tag.name}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {data.tags.map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => bulkRemoveTag(tag.id)}
                            title={`Remove "${tag.name}" from all`}
                            className="text-[10px] px-1.5 py-0.5 rounded border hover:opacity-75 transition-opacity"
                            style={{ borderColor: tag.color, color: tag.color }}
                          >
                            − {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Move to block */}
                  {data.blocks.length > 0 && (
                    <div className="border-t border-[var(--border)] mt-2 pt-2">
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Move to block</p>
                      <CustomSelect
                        value={bulkMoveBlockValue}
                        onChange={(val) => {
                          setBulkMoveBlockValue("");
                          bulkMoveToBlock(val === "none" ? undefined : val || undefined);
                        }}
                        options={bulkBlockOptions}
                        placeholder="Move to..."
                      />
                    </div>
                  )}

                  {/* Description */}
                  <div className="border-t border-[var(--border)] mt-2 pt-2">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Description</p>
                    <textarea
                      rows={2}
                      placeholder="Set description..."
                      value={bulkDescription}
                      onChange={(e) => setBulkDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          if (bulkDescription.trim()) { bulkSetDescription(bulkDescription.trim()); setBulkDescription(""); }
                        }
                      }}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-none"
                    />
                    <button
                      onClick={() => { if (bulkDescription.trim()) { bulkSetDescription(bulkDescription.trim()); setBulkDescription(""); } }}
                      disabled={!bulkDescription.trim()}
                      className="w-full mt-1 text-xs px-2 py-1.5 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-40"
                    >
                      Apply to all
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom bar */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)] select-none">
                {selectedTaskIds.size} selected
              </span>
              <button
                onClick={() => setBulkPanelCollapsed((c) => !c)}
                className="p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)] cursor-pointer"
                title={bulkPanelCollapsed ? "Expand" : "Collapse"}
              >
                {bulkPanelCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={clearSelection}
                className="p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)] cursor-pointer"
                title="Clear selection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
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
