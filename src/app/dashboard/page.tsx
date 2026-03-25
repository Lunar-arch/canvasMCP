"use client";

import { useState, useMemo, useCallback } from "react";
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
  const [newBlockName, setNewBlockName] = useState("");
  const [showNewBlock, setShowNewBlock] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);

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

  // Tasks organized by block
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

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setDraggedId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    if (!over) return;
    const activeTask = data.tasks.find((t) => t.id === taskId);
    if (active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeTask) return;

    // Dropped onto a block container (empty area)
    if (overId.startsWith("block-")) {
      const blockId = overId.replace("block-", "");
      moveTaskToBlock(taskId, blockId);
      return;
    }

    // Dropped to unblocked container
    if (overId === "unblocked") {
      moveTaskToBlock(taskId, undefined);
      return;
    }

    // Dropped onto another task => possible reordering or cross-block insert
    const destTask = data.tasks.find((t) => t.id === overId);
    if (!destTask) return;

    const sourceBlock = activeTask.blockId;
    const destBlock = destTask.blockId;

    // Reorder within same block (including both undefined)
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

    // Move across blocks: place before destTask in destination list
    const destList = (destBlock ? blockTasks[destBlock] || [] : unblockedTasks).map((t) => t.id).filter((id) => id !== taskId);
    const insertIndex = destList.indexOf(overId);
    const nextDest = [...destList];
    nextDest.splice(insertIndex === -1 ? nextDest.length : insertIndex, 0, taskId);

    // Update block assignment then reorder destination and source
    moveTaskToBlock(taskId, destBlock);
    reorderTasks(nextDest);

    // Reorder source list (remove the moved task)
    const sourceList = (sourceBlock ? blockTasks[sourceBlock] || [] : unblockedTasks).map((t) => t.id).filter((id) => id !== taskId);
    reorderTasks(sourceList);
  };

  const handleCreateBlock = () => {
    if (newBlockName.trim()) {
      createBlock(
        newBlockName.trim(),
        BLOCK_COLORS[data.blocks.length % BLOCK_COLORS.length]
      );
      setNewBlockName("");
      setShowNewBlock(false);
    }
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
                {/* Play all button */}
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
                <button
                  onClick={() => {
                    const t = createTask({ title: "New Task" });
                    // mark as freshly created so modal can behave accordingly
                    setCreatingTaskId(t.id);
                    // schedule opening the editor to allow state to update
                    setTimeout(() => setEditingTaskId(t.id), 0);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] text-sm hover:bg-[var(--bg-hover)] transition-colors"
                  title="Create task"
                >
                  <Plus className="w-4 h-4" />
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
                Set up your Canvas connection and sync your assignments to get started.
              </p>
              <Link
                href="/setup"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white font-medium text-sm hover:bg-[var(--primary-hover)] transition-colors"
              >
                <Settings className="w-4 h-4" />
                Setup Canvas
              </Link>
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
                    courseColors={courseColors}
                    onPlayBlock={() => startFocusBlock(block.id)}
                    onToggleComplete={completeTask}
                    onPlayTask={startFocusTask}
                    onUpdateTask={updateTask}
                    onUpdateBlock={(updates) => updateBlock(block.id, updates)}
                    onDeleteBlock={() => deleteBlock(block.id)}
                    onAddTag={addTagToTask}
                    onRemoveTag={removeTagFromTask}
                    onEditTask={(taskId) => setEditingTaskId(taskId)}
                  />
                ))}

                {/* New block button */}
                {!showNewBlock ? (
                  <button
                    onClick={() => setShowNewBlock(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Block
                  </button>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-2xl border-2 border-dashed border-[var(--primary)] bg-[var(--primary-light)]">
                    <input
                      type="text"
                      value={newBlockName}
                      onChange={(e) => setNewBlockName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateBlock();
                        if (e.key === "Escape") setShowNewBlock(false);
                      }}
                      placeholder="Block name..."
                      className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                      autoFocus
                    />
                    <button
                      onClick={handleCreateBlock}
                      className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-hover)]"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowNewBlock(false)}
                      className="px-3 py-2 rounded-lg text-sm hover:bg-[var(--bg-hover)]"
                    >
                      Cancel
                    </button>
                  </div>
                )}

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
                              onUpdate={(updates) =>
                                updateTask(task.id, updates)
                              }
                              onAddTag={(tagId) => addTagToTask(task.id, tagId)}
                              onRemoveTag={(tagId) =>
                                removeTagFromTask(task.id, tagId)
                              }
                              onEdit={() => setEditingTaskId(task.id)}
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
          )}
        </div>
      </div>

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
              // clear saved remaining time then mark complete
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
