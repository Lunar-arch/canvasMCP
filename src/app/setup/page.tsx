"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/hooks/useAppData";
import {
  MacroStep,
  WaitType,
  MacroIfConditionType,
  Macro,
  FieldMapping,
  MacroCredential,
  MacroSchedule,
  Course,
  Assignment,
  CanvasSyncOptions,
} from "@/types";
import { v4 as uuid } from "uuid";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Play,
  Save,
  MousePointer,
  Type,
  Globe,
  Clock,
  Keyboard,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Timer,
  Settings,
  Zap,
  List,
  Map,
  Calendar,
  Key,
  Terminal,
  Video,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Square,
  Layers,
  RefreshCw,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Types ────────────────────────────────────────────────────────────────────

type MacroTab = "steps" | "record" | "mappings" | "schedule" | "credentials" | "run";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_OPTIONS: {
  value: MacroStep["action"];
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "if", label: "If Block", icon: Zap },
  { value: "navigate", label: "Navigate", icon: Globe },
  { value: "fill", label: "Fill Input", icon: Type },
  { value: "click", label: "Click", icon: MousePointer },
  { value: "press", label: "Press Key", icon: Keyboard },
  { value: "wait", label: "Wait", icon: Clock },
  { value: "newTab", label: "New Tab", icon: ExternalLink },
  { value: "switchTab", label: "Switch Tab", icon: Layers },
];

const WAIT_TYPE_OPTIONS: { value: WaitType; label: string }[] = [
  { value: "url", label: "Wait for URL" },
  { value: "selector", label: "Wait for Element" },
  { value: "navigation", label: "Wait for Page Load" },
  { value: "duration", label: "Wait (fixed time)" },
];

const IF_CONDITION_OPTIONS: { value: MacroIfConditionType; label: string }[] = [
  { value: "always", label: "Always" },
  { value: "urlIncludes", label: "Current URL includes" },
  { value: "urlMatches", label: "Current URL matches pattern" },
  { value: "elementExists", label: "Element exists" },
  { value: "elementNotExists", label: "Element does not exist" },
  { value: "elementTextContains", label: "Element text contains" },
  { value: "elementTextEquals", label: "Element text equals" },
];

const TASK_FIELDS: { value: FieldMapping["taskField"]; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "description", label: "Description" },
  { value: "dueAt", label: "Due Date" },
  { value: "htmlUrl", label: "Link URL" },
  { value: "courseName", label: "Course / Category" },
  { value: "estimatedMinutes", label: "Estimated Minutes" },
  { value: "custom", label: "Custom Field" },
];

const CANVAS_DEFAULT_STEPS = (): MacroStep[] => [
  { id: uuid(), action: "navigate", url: "{{portalUrl}}", label: "Go to login portal" },
  { id: uuid(), action: "fill", selector: "#username", value: "{{username}}", label: "Enter username" },
  { id: uuid(), action: "fill", selector: "#password", value: "{{password}}", label: "Enter password" },
  { id: uuid(), action: "click", selector: "button[type='submit']", label: "Click login button" },
  { id: uuid(), action: "wait", waitType: "navigation", label: "Wait for page to load" },
];

const CANVAS_DEFAULT_CREDS = (): MacroCredential[] => [
  { id: uuid(), key: "username", label: "Username / Email", value: "", isSecret: false },
  { id: uuid(), key: "password", label: "Password", value: "", isSecret: true },
  { id: uuid(), key: "portalUrl", label: "Login Portal URL", value: "", isSecret: false },
];

// ─── Input helper ─────────────────────────────────────────────────────────────

function Input({
  value,
  onChange,
  placeholder,
  mono,
  className = "",
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  className?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${mono ? "font-mono text-xs" : ""} ${className}`}
    />
  );
}

// ─── SortableStep ─────────────────────────────────────────────────────────────

function SortableStep({
  step,
  index,
  updateStep,
  removeStep,
  selected,
  onToggleSelected,
}: {
  step: MacroStep;
  index: number;
  updateStep: (id: string, u: Partial<MacroStep>) => void;
  removeStep: (id: string) => void;
  selected: boolean;
  onToggleSelected: (id: string, checked: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const [labelValue, setLabelValue] = useState(step.label);

  useEffect(() => {
    setLabelValue(step.label);
  }, [step.id, step.label]);

  const commitLabel = () => {
    if (labelValue !== step.label) {
      updateStep(step.id, { label: labelValue });
    }
  };

  const meta = ACTION_OPTIONS.find((a) => a.value === step.action);
  const Icon = meta?.icon || Globe;
  const ifConditionType = step.ifConditionType || "urlIncludes";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 p-3 rounded-xl border bg-[var(--bg-card)] group ${
        step.action === "if"
          ? "border-[var(--primary)]/50"
          : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-center gap-1.5 pt-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggleSelected(step.id, e.target.checked)}
          className="w-3.5 h-3.5"
        />
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 opacity-30 group-hover:opacity-70 transition-opacity"
          tabIndex={-1}
        >
          <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        </button>
        <span className="text-xs font-mono text-[var(--text-muted)] w-4 text-right">
          {index + 1}
        </span>
      </div>

      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg)] border border-[var(--border)] text-xs shrink-0">
            <Icon className="w-3 h-3 text-[var(--text-muted)]" />
            <select
              value={step.action}
              onChange={(e) => updateStep(step.id, { action: e.target.value as MacroStep["action"] })}
              className="bg-transparent outline-none text-xs cursor-pointer"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setLabelValue(step.label);
                (e.target as HTMLInputElement).blur();
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder="Step label"
            className="flex-1 min-w-0 text-sm font-medium bg-transparent border-b border-transparent focus:border-[var(--primary)] focus:outline-none leading-tight pb-0.5 transition-colors text-[var(--text)] placeholder:text-[var(--text-muted)]"
          />
          <button
            onClick={() => removeStep(step.id)}
            className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950 text-[var(--text-muted)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {step.action === "if" && (
            <div className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[var(--text-muted)]">If</span>
                <select
                  value={ifConditionType}
                  onChange={(e) =>
                    updateStep(step.id, {
                      ifConditionType: e.target.value as MacroIfConditionType,
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  {IF_CONDITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {(ifConditionType === "urlIncludes" || ifConditionType === "urlMatches") && (
                <Input
                  value={step.ifTarget || ""}
                  onChange={(v) => updateStep(step.id, { ifTarget: v })}
                  placeholder={
                    ifConditionType === "urlIncludes"
                      ? "URL fragment (e.g. instructure.com)"
                      : "URL pattern (e.g. **/dashboard**)"
                  }
                  mono
                  className="w-full"
                />
              )}

              {(ifConditionType === "elementExists" ||
                ifConditionType === "elementNotExists" ||
                ifConditionType === "elementTextContains" ||
                ifConditionType === "elementTextEquals") && (
                <Input
                  value={step.ifTarget || ""}
                  onChange={(v) => updateStep(step.id, { ifTarget: v })}
                  placeholder="CSS selector (e.g. .dashboard-title)"
                  mono
                  className="w-full"
                />
              )}

              {(ifConditionType === "elementTextContains" ||
                ifConditionType === "elementTextEquals") && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    value={step.ifValue || ""}
                    onChange={(v) => updateStep(step.id, { ifValue: v })}
                    placeholder="Text to compare"
                    className="flex-1 min-w-[180px]"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(step.ifCaseSensitive)}
                      onChange={(e) =>
                        updateStep(step.id, { ifCaseSensitive: e.target.checked })
                      }
                    />
                    Case sensitive
                  </label>
                </div>
              )}
            </div>
          )}

          {(step.action === "fill" || step.action === "click" || step.action === "press") && (
            <Input
              value={step.selector || ""}
              onChange={(v) => updateStep(step.id, { selector: v })}
              placeholder="CSS selector (e.g. #username)"
              mono
              className="flex-1 min-w-[180px]"
            />
          )}
          {step.action === "fill" && (
            <Input
              value={step.value || ""}
              onChange={(v) => updateStep(step.id, { value: v })}
              placeholder="Value (use {{username}}, {{password}}, etc.)"
              mono
              className="flex-1 min-w-[180px]"
            />
          )}
          {(step.action === "navigate" || step.action === "newTab") && (
            <Input
              value={step.url || ""}
              onChange={(v) => updateStep(step.id, { url: v })}
              placeholder="URL (use {{portalUrl}} for credentials)"
              mono
              className="flex-1 min-w-[240px]"
            />
          )}
          {step.action === "switchTab" && (
            <Input
              value={step.tabUrl || ""}
              onChange={(v) => updateStep(step.id, { tabUrl: v })}
              placeholder="URL pattern to match (e.g. **/dashboard**)"
              mono
              className="flex-1 min-w-[240px]"
            />
          )}
          {step.action === "press" && (
            <Input
              value={step.key || ""}
              onChange={(v) => updateStep(step.id, { key: v })}
              placeholder="Key (e.g. Enter, Tab)"
              mono
              className="w-32"
            />
          )}
          {step.action === "wait" && (
            <div className="flex items-center gap-2 flex-wrap w-full">
              <select
                value={step.waitType || "navigation"}
                onChange={(e) => updateStep(step.id, { waitType: e.target.value as WaitType })}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                {WAIT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {step.waitType === "url" && (
                <Input
                  value={step.waitUrl || ""}
                  onChange={(v) => updateStep(step.id, { waitUrl: v })}
                  placeholder="URL pattern (e.g. **/dashboard**)"
                  mono
                  className="flex-1 min-w-[200px]"
                />
              )}
              {step.waitType === "selector" && (
                <Input
                  value={step.waitSelector || ""}
                  onChange={(v) => updateStep(step.id, { waitSelector: v })}
                  placeholder="CSS selector to wait for"
                  mono
                  className="flex-1 min-w-[200px]"
                />
              )}
              {step.waitType === "duration" && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={step.waitTime || 1000}
                    onChange={(e) => updateStep(step.id, { waitTime: Number(e.target.value) })}
                    min={100}
                    step={100}
                    className="w-24 px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                  <span className="text-xs text-[var(--text-muted)]">ms</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepDropZone({ id, label }: { id: string; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-dashed px-3 py-2 text-xs transition-colors ${
        isOver
          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
          : "border-[var(--border)] text-[var(--text-muted)]"
      }`}
    >
      {label}
    </div>
  );
}

// ─── StepsTab ─────────────────────────────────────────────────────────────────

function StepsTab({
  macro,
  onUpdate,
  onGoToRecord,
}: {
  macro: Macro;
  onUpdate: (updates: Partial<Macro>) => void;
  onGoToRecord: () => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedStepIds((prev) => {
      const next = new Set<string>();
      const valid = new Set(macro.steps.map((s) => s.id));
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      return next;
    });
  }, [macro.steps]);

  const stepById = useMemo(() => {
    const map = new globalThis.Map<string, MacroStep>();
    macro.steps.forEach((s) => map.set(s.id, s));
    return map;
  }, [macro.steps]);

  const childrenByParent = useMemo(() => {
    const map = new globalThis.Map<string | null, MacroStep[]>();
    macro.steps.forEach((s) => {
      const key = s.parentIfId || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [macro.steps]);

  const getChildren = useCallback(
    (parentIfId: string | null) => childrenByParent.get(parentIfId) || [],
    [childrenByParent]
  );

  const updateStep = (id: string, u: Partial<MacroStep>) => {
    onUpdate({ steps: macro.steps.map((s) => (s.id === id ? { ...s, ...u } : s)) });
  };

  const collectStepAndDescendants = useCallback(
    (id: string, ids: Set<string>) => {
      ids.add(id);
      getChildren(id).forEach((child) => collectStepAndDescendants(child.id, ids));
    },
    [getChildren]
  );

  const removeStep = (id: string) => {
    const ids = new Set<string>();
    collectStepAndDescendants(id, ids);
    onUpdate({ steps: macro.steps.filter((s) => !ids.has(s.id)) });
    setSelectedStepIds((prev) => {
      const next = new Set(prev);
      ids.forEach((removeId) => next.delete(removeId));
      return next;
    });
  };

  const addStep = (parentIfId: string | null = null, action: MacroStep["action"] = "click") => {
    const baseStep: MacroStep =
      action === "if"
        ? {
            id: uuid(),
            action: "if",
            ifConditionType: "urlIncludes",
            ifTarget: "",
            label: "If block",
          }
        : {
            id: uuid(),
            action,
            selector: action === "click" || action === "fill" || action === "press" ? "" : undefined,
            label: "New step",
          };

    onUpdate({
      steps: [
        ...macro.steps,
        {
          ...baseStep,
          parentIfId: parentIfId || undefined,
        },
      ],
    });
  };

  const onToggleSelected = (id: string, checked: boolean) => {
    setSelectedStepIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const isInvalidMove = useCallback(
    (dragIds: string[], destinationParentId: string | null) => {
      if (!destinationParentId) return false;

      let current: string | null = destinationParentId;
      while (current) {
        if (dragIds.includes(current)) return true;
        current = stepById.get(current)?.parentIfId || null;
      }

      return false;
    },
    [stepById]
  );

  const onDragStart = (_e: DragStartEvent) => {
    // no-op, kept for future visual drag state
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;

    const activeId = String(active.id);
    const activeStep = stepById.get(activeId);
    if (!activeStep) return;

    const sourceParentId = activeStep.parentIfId || null;
    const sourceSiblings = getChildren(sourceParentId);

    let dragIds = selectedStepIds.has(activeId) ? Array.from(selectedStepIds) : [activeId];
    dragIds = dragIds.filter(
      (id) => (stepById.get(id)?.parentIfId || null) === sourceParentId
    );
    if (dragIds.length === 0) dragIds = [activeId];

    const movingSteps = sourceSiblings.filter((s) => dragIds.includes(s.id));
    if (movingSteps.length === 0) return;

    const overId = String(over.id);
    let destinationParentId: string | null = null;
    let destinationBeforeId: string | null = null;

    if (overId === "drop-root") {
      destinationParentId = null;
    } else if (overId.startsWith("drop-")) {
      destinationParentId = overId.replace("drop-", "") || null;
    } else {
      const overStep = stepById.get(overId);
      if (!overStep) return;

      if (overStep.action === "if" && overStep.id !== activeId) {
        destinationParentId = overStep.id;
      } else {
        destinationParentId = overStep.parentIfId || null;
        destinationBeforeId = overStep.id;
      }
    }

    if (isInvalidMove(dragIds, destinationParentId)) return;

    const groups = new globalThis.Map<string | null, MacroStep[]>();
    childrenByParent.forEach((items, parentId) => {
      groups.set(parentId, [...items]);
    });

    groups.forEach((items, parentId) => {
      groups.set(parentId, items.filter((item) => !dragIds.includes(item.id)));
    });

    const moved = movingSteps.map((s) => ({
      ...s,
      parentIfId: destinationParentId || undefined,
    }));

    const destList = [...(groups.get(destinationParentId) || [])];
    let insertIndex = destList.length;
    if (destinationBeforeId) {
      const idx = destList.findIndex((s) => s.id === destinationBeforeId);
      insertIndex = idx === -1 ? destList.length : idx;
    }
    destList.splice(insertIndex, 0, ...moved);
    groups.set(destinationParentId, destList);

    const flatten = (parentId: string | null): MacroStep[] => {
      const items = groups.get(parentId) || [];
      const output: MacroStep[] = [];
      items.forEach((item) => {
        output.push(item);
        output.push(...flatten(item.id));
      });
      return output;
    };

    const nextSteps = flatten(null);
    const seen = new Set(nextSteps.map((s) => s.id));
    macro.steps.forEach((s) => {
      if (!seen.has(s.id)) nextSteps.push(s);
    });

    onUpdate({ steps: nextSteps });
  };

  const renderStepList = (parentIfId: string | null): ReactNode => {
    const list = getChildren(parentIfId);

    return (
      <SortableContext items={list.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {list.map((step, i) => (
            <div key={step.id} className={step.action === "if" ? "rounded-xl bg-[var(--primary)]/5 p-2" : ""}>
              <SortableStep
                step={step}
                index={i}
                updateStep={updateStep}
                removeStep={removeStep}
                selected={selectedStepIds.has(step.id)}
                onToggleSelected={onToggleSelected}
              />

              {step.action === "if" && (
                <div className="mt-2 ml-6 pl-3 border-l border-dashed border-[var(--primary)]/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                      Then
                    </span>
                    <button
                      onClick={() => addStep(step.id)}
                      className="text-[11px] px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--bg-card)] transition-colors"
                    >
                      Add inside
                    </button>
                  </div>
                  {renderStepList(step.id)}
                </div>
              )}
            </div>
          ))}

          <StepDropZone
            id={parentIfId ? `drop-${parentIfId}` : "drop-root"}
            label={
              parentIfId
                ? "Drop step(s) here to place inside this block"
                : "Drop step(s) here to place at top level"
            }
          />
        </div>
      </SortableContext>
    );
  };

  return (
    <div className="space-y-3 p-4">
      {macro.sourceType === "canvas" && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 space-y-2">
          <p className="text-sm font-medium">Canvas login flow</p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-[var(--text-muted)]">
            <li>Only automate the path from your school portal to your Canvas dashboard.</li>
            <li>After login, we open a separate tab in the same browser session and reuse your session cookies to fetch courses and assignments.</li>
            <li>When syncing is done, the automation browser session is closed.</li>
            <li>Credentials are stored in localStorage on your device and are only sent to this app&apos;s <code className="text-[11px] px-1 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]">/api/canvas</code> route when you run the macro.</li>
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">
          {macro.steps.length} step{macro.steps.length !== 1 ? "s" : ""}
          {" · "}Use <code className="text-xs bg-[var(--bg-card)] border border-[var(--border)] px-1 py-0.5 rounded">{"{{key}}"}</code> to reference credentials.
          {" · "}Tick multiple steps and drag one selected step to move them together.
        </p>
        <button
          onClick={onGoToRecord}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-card)] transition-colors shrink-0"
        >
          <Video className="w-3.5 h-3.5" />
          Record
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {renderStepList(null)}
      </DndContext>

      <div className="flex items-center gap-2">
        <button
          onClick={() => addStep()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--bg-card)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Step
        </button>
        <button
          onClick={() => addStep(null, "if")}
          className="px-3 py-2.5 rounded-xl border border-[var(--border)] text-sm hover:bg-[var(--bg-card)] transition-colors"
        >
          Add If Block
        </button>
      </div>
    </div>
  );
}

// ─── RecordTab ────────────────────────────────────────────────────────────────

function RecordTab({ onAddSteps }: { onAddSteps: (steps: MacroStep[]) => void }) {
  const [startUrl, setStartUrl] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [recorded, setRecorded] = useState<MacroStep[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const normalizeUrl = (u: string) =>
    /^https?:\/\//i.test(u) ? u : `https://${u}`;

  const proxyUrl = (u: string) =>
    `/api/proxy?url=${encodeURIComponent(u)}`;

  const handleStart = () => {
    if (!startUrl) return;
    const initialUrl = normalizeUrl(startUrl.trim());
    setRecorded([
      {
        id: uuid(),
        action: "navigate",
        url: initialUrl,
        label: `Navigate to ${initialUrl}`,
      },
    ]);
    setCurrentUrl(initialUrl);
    setIsRecording(true);
  };

  const handleStop = () => {
    setIsRecording(false);
  };

  const handleAdd = () => {
    if (recorded.length === 0) return;
    onAddSteps(recorded);
    setRecorded([]);
    setIsRecording(false);
  };

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!isRecording) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "urlChange") {
        setCurrentUrl(data.url);
      } else if (data.type === "record" && data.step) {
        setRecorded((prev) => [...prev, { ...data.step, id: uuid() }]);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isRecording]);

  return (
    <div className="flex flex-col h-full">
      {/* URL bar */}
      <div className="p-4 border-b border-[var(--border)] space-y-3">
        <div className="flex gap-2">
          <input
            type="url"
            value={startUrl}
            onChange={(e) => setStartUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isRecording && handleStart()}
            placeholder="https://your-login-portal.com"
            className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] font-mono"
            disabled={isRecording}
          />
          {!isRecording ? (
            <button
              onClick={handleStart}
              disabled={!startUrl}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <Video className="w-4 h-4" />
              Start
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}
        </div>

        {isRecording && (
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-red-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Recording — interact with the page below
            </span>
            <span className="text-[var(--text-muted)] font-mono truncate max-w-[300px]">
              {currentUrl}
            </span>
          </div>
        )}
      </div>

      {/* Split: iframe + step log */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Iframe */}
        <div className="flex-1 bg-[var(--bg-card)] relative">
          {isRecording ? (
            <iframe
              ref={iframeRef}
              src={proxyUrl(startUrl)}
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-pointer-lock"
              title="Recording browser"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)]">
              <Video className="w-10 h-10 opacity-30" />
              <p className="text-sm">Enter a URL above and click Start to begin recording</p>
              <p className="text-xs opacity-60 max-w-sm text-center">
                Clicks, form fills, and navigation will be captured automatically.
                Note: some sites block iframes — use the Steps tab to add steps manually if recording doesn&apos;t work.
              </p>
            </div>
          )}
        </div>

        {/* Recorded steps log */}
        <div className="w-72 border-l border-[var(--border)] flex flex-col shrink-0">
          <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Captured ({recorded.length})
            </span>
            {recorded.length > 0 && (
              <button
                onClick={() => setRecorded([])}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {recorded.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] p-2 text-center">
                No actions yet
              </p>
            ) : (
              recorded.map((step, i) => {
                const meta = ACTION_OPTIONS.find((a) => a.value === step.action);
                const Icon = meta?.icon || Globe;
                return (
                  <div
                    key={step.id}
                    className="flex items-start gap-2 p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-xs"
                  >
                    <span className="text-[var(--text-muted)] w-4 shrink-0">{i + 1}</span>
                    <Icon className="w-3 h-3 mt-0.5 shrink-0 text-[var(--text-muted)]" />
                    <span className="text-[var(--text)] truncate">{step.label}</span>
                  </div>
                );
              })
            )}
          </div>
          {recorded.length > 0 && (
            <div className="p-3 border-t border-[var(--border)]">
              <button
                onClick={handleAdd}
                className="w-full py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
              >
                Add {recorded.length} step{recorded.length !== 1 ? "s" : ""} to macro
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FieldMappingsTab ─────────────────────────────────────────────────────────

function FieldMappingsTab({
  macro,
  onUpdate,
}: {
  macro: Macro;
  onUpdate: (updates: Partial<Macro>) => void;
}) {
  const add = () =>
    onUpdate({
      fieldMappings: [
        ...macro.fieldMappings,
        {
          id: uuid(),
          selector: "",
          attribute: "textContent",
          taskField: "title",
          isRepeating: false,
        },
      ],
    });

  const update = (id: string, u: Partial<FieldMapping>) =>
    onUpdate({
      fieldMappings: macro.fieldMappings.map((m) => (m.id === id ? { ...m, ...u } : m)),
    });

  const remove = (id: string) =>
    onUpdate({ fieldMappings: macro.fieldMappings.filter((m) => m.id !== id) });

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        Map CSS selectors on the target page to task fields. Enable &quot;Repeating&quot; to create one task per matched element.
      </p>

      {macro.fieldMappings.length === 0 ? (
        <div className="py-10 text-center text-[var(--text-muted)]">
          <Map className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No field mappings yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {macro.fieldMappings.map((m) => (
            <div
              key={m.id}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-2"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  value={m.selector}
                  onChange={(v) => update(m.id, { selector: v })}
                  placeholder="CSS selector (e.g. .assignment-title)"
                  mono
                  className="flex-1 min-w-[180px]"
                />
                <select
                  value={m.attribute}
                  onChange={(e) => update(m.id, { attribute: e.target.value as FieldMapping["attribute"] })}
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs focus:outline-none"
                >
                  {(["textContent", "href", "value", "innerHTML", "src"] as const).map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                <select
                  value={m.taskField}
                  onChange={(e) => update(m.id, { taskField: e.target.value as FieldMapping["taskField"] })}
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs focus:outline-none"
                >
                  {TASK_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => remove(m.id)}
                  className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-4">
                {m.taskField === "custom" && (
                  <Input
                    value={m.customFieldName || ""}
                    onChange={(v) => update(m.id, { customFieldName: v })}
                    placeholder="Custom field name"
                    className="w-40"
                  />
                )}
                <Input
                  value={m.transform || ""}
                  onChange={(v) => update(m.id, { transform: v })}
                  placeholder="Regex transform: /pattern/replacement/"
                  mono
                  className="flex-1 min-w-[180px]"
                />
                <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={m.isRepeating}
                    onChange={(e) => update(m.id, { isRepeating: e.target.checked })}
                    className="rounded"
                  />
                  Repeating
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={add}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--bg-card)] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Mapping
      </button>
    </div>
  );
}

// ─── ScheduleTab ──────────────────────────────────────────────────────────────

function ScheduleTab({
  macro,
  onUpdate,
}: {
  macro: Macro;
  onUpdate: (updates: Partial<Macro>) => void;
}) {
  const s = macro.schedule;
  const set = (u: Partial<MacroSchedule>) =>
    onUpdate({ schedule: { ...s, ...u } });

  const options: { value: MacroSchedule["type"]; label: string; desc: string }[] = [
    { value: "manual", label: "Manual", desc: "Only run when you click Run" },
    { value: "immediate", label: "On Save", desc: "Run immediately whenever you save" },
    { value: "hourly", label: "Hourly", desc: "Sync once per hour" },
    { value: "daily", label: "Daily", desc: "Run once per day at a set time" },
    { value: "weekly", label: "Weekly", desc: "Run once per week on a set day" },
  ];

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              s.type === o.value
                ? "border-[var(--primary)] bg-[var(--primary)]/5"
                : "border-[var(--border)] hover:bg-[var(--bg-card)]"
            }`}
          >
            <input
              type="radio"
              name="schedule"
              value={o.value}
              checked={s.type === o.value}
              onChange={() => set({ type: o.value })}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium text-[var(--text)]">{o.label}</div>
              <div className="text-xs text-[var(--text-muted)]">{o.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {(s.type === "daily" || s.type === "weekly") && (
        <div className="flex items-center gap-3 pt-2">
          {s.type === "weekly" && (
            <select
              value={s.dayOfWeek ?? 1}
              onChange={(e) => set({ dayOfWeek: Number(e.target.value) })}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {days.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="time"
              value={s.time || "08:00"}
              onChange={(e) => set({ time: e.target.value })}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CredentialsTab ───────────────────────────────────────────────────────────

function CredentialsTab({
  macro,
  onUpdate,
}: {
  macro: Macro;
  onUpdate: (updates: Partial<Macro>) => void;
}) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const add = () =>
    onUpdate({
      credentials: [
        ...macro.credentials,
        { id: uuid(), key: "", label: "New credential", value: "", isSecret: false },
      ],
    });

  const update = (id: string, u: Partial<MacroCredential>) =>
    onUpdate({
      credentials: macro.credentials.map((c) => (c.id === id ? { ...c, ...u } : c)),
    });

  const remove = (id: string) =>
    onUpdate({ credentials: macro.credentials.filter((c) => c.id !== id) });

  const toggle = (id: string) =>
    setRevealed((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        Credentials are referenced in steps as{" "}
        <code className="text-xs bg-[var(--bg-card)] border border-[var(--border)] px-1 py-0.5 rounded">
          {"{{key}}"}
        </code>
        . All values are stored in localStorage only.
      </p>

      {macro.credentials.length === 0 ? (
        <div className="py-10 text-center text-[var(--text-muted)]">
          <Key className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No credentials yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {macro.credentials.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex-wrap"
            >
              <Input
                value={c.key}
                onChange={(v) => update(c.id, { key: v })}
                placeholder="key"
                mono
                className="w-28"
              />
              <Input
                value={c.label}
                onChange={(v) => update(c.id, { label: v })}
                placeholder="Label"
                className="w-40"
              />
              <div className="flex-1 min-w-[150px] relative">
                <input
                  type={c.isSecret && !revealed.has(c.id) ? "password" : "text"}
                  value={c.value}
                  onChange={(e) => update(c.id, { value: e.target.value })}
                  placeholder="Value"
                  className="w-full px-2.5 py-1.5 pr-8 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                {c.isSecret && (
                  <button
                    onClick={() => toggle(c.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                    tabIndex={-1}
                  >
                    {revealed.has(c.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <label className="flex items-center gap-1 text-xs text-[var(--text-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={c.isSecret}
                  onChange={(e) => update(c.id, { isSecret: e.target.checked })}
                  className="rounded"
                />
                Secret
              </label>
              <button
                onClick={() => remove(c.id)}
                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={add}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--bg-card)] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Credential
      </button>
    </div>
  );
}

// ─── RunTab ───────────────────────────────────────────────────────────────────

function RunTab({
  macro,
  onUpdate,
}: {
  macro: Macro;
  onUpdate: (updates: Partial<Macro>) => void;
}) {
  const { data, syncFromCanvas, saveConfig } = useAppData();
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  type CanvasRunDebugStep = {
    stepNumber: number;
    action: MacroStep["action"];
    label: string;
    status: "success" | "error";
    detail?: string;
    url?: string;
    error?: string;
    screenshotDataUrl?: string;
  };
  type RunLogEntry = {
    id: string;
    level: "info" | "success" | "warn" | "error";
    msg: string;
    time: string;
    debugStep?: CanvasRunDebugStep;
  };

  const [logs, setLogs] = useState<RunLogEntry[]>([]);
  const [expandedDebugLogs, setExpandedDebugLogs] = useState<Set<string>>(new Set());
  const [pendingImport, setPendingImport] = useState<{
    courses: Course[];
    assignments: Assignment[];
  } | null>(null);
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [showNoDueReview, setShowNoDueReview] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<number>>(new Set());
  const [onlyAddFromDate, setOnlyAddFromDate] = useState("");
  const [skipNoDueDateTasks, setSkipNoDueDateTasks] = useState(false);
  const [reviewNoDueDateTasks, setReviewNoDueDateTasks] = useState(false);
  const [selectedNoDueAssignmentIds, setSelectedNoDueAssignmentIds] = useState<Set<number>>(new Set());
  const logsEndRef = useRef<HTMLDivElement>(null);

  const log = (msg: string, level: RunLogEntry["level"] = "info") => {
    setLogs((prev) => [
      ...prev,
      { id: uuid(), level, msg, time: new Date().toLocaleTimeString() },
    ]);
  };

  const parseDebugSteps = (value: unknown): CanvasRunDebugStep[] => {
    if (!Array.isArray(value)) return [];

    return value
      .filter((raw): raw is Record<string, unknown> => typeof raw === "object" && raw !== null)
      .filter((raw) => typeof raw.stepNumber === "number" && typeof raw.action === "string")
      .map((raw) => ({
        stepNumber: raw.stepNumber as number,
        action: raw.action as MacroStep["action"],
        label: typeof raw.label === "string" ? raw.label : "",
        status: raw.status === "error" ? "error" : "success",
        detail: typeof raw.detail === "string" ? raw.detail : undefined,
        url: typeof raw.url === "string" ? raw.url : undefined,
        error: typeof raw.error === "string" ? raw.error : undefined,
        screenshotDataUrl:
          typeof raw.screenshotDataUrl === "string"
            ? raw.screenshotDataUrl
            : undefined,
      }));
  };

  const appendDebugSteps = (steps: CanvasRunDebugStep[]) => {
    if (steps.length === 0) return;
    const debugLogs: RunLogEntry[] = steps.map((step): RunLogEntry => ({
      id: uuid(),
      level: step.status === "error" ? "error" : "info",
      msg: `${
        step.detail || step.label || step.action
      }${step.screenshotDataUrl ? " · screenshot captured" : ""}`,
      time: new Date().toLocaleTimeString(),
      debugStep: step,
    }));
    setLogs((prev) => [
      ...prev,
      ...debugLogs,
    ]);
  };

  const toggleDebugLog = (id: string) => {
    setExpandedDebugLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const existingAssignmentIds = useMemo(
    () =>
      new Set(
        data.tasks
          .filter((t) => t.assignmentId !== undefined)
          .map((t) => t.assignmentId as number)
      ),
    [data.tasks]
  );

  const trackedAssignmentCount = useMemo(() => {
    if (!pendingImport) return 0;
    return pendingImport.assignments.filter((a) => selectedCourseIds.has(a.course_id)).length;
  }, [pendingImport, selectedCourseIds]);

  const noDueCandidates = useMemo(() => {
    if (!pendingImport) return [];
    return pendingImport.assignments.filter(
      (a) =>
        selectedCourseIds.has(a.course_id) &&
        !a.due_at &&
        !existingAssignmentIds.has(a.id)
    );
  }, [pendingImport, selectedCourseIds, existingAssignmentIds]);

  const getCred = (key: string) =>
    macro.credentials.find((c) => c.key === key)?.value || "";

  const closeImportFlow = () => {
    setPendingImport(null);
    setShowImportOptions(false);
    setShowNoDueReview(false);
    setSelectedNoDueAssignmentIds(new Set());
  };

  const initializeImportFlow = (courses: Course[], assignments: Assignment[]) => {
    const validTracked = (data.settings.canvasTrackedCourseIds || []).filter((id) =>
      courses.some((c) => c.id === id)
    );
    const initialTracked = validTracked.length > 0 ? validTracked : courses.map((c) => c.id);

    setSelectedCourseIds(new Set(initialTracked));
    setOnlyAddFromDate(data.settings.canvasOnlyAddFromDate || "");

    const skipNoDue = Boolean(data.settings.canvasSkipNoDueDateTasks);
    setSkipNoDueDateTasks(skipNoDue);
    setReviewNoDueDateTasks(
      skipNoDue ? false : Boolean(data.settings.canvasReviewNoDueDateTasks)
    );

    setSelectedNoDueAssignmentIds(new Set());
    setPendingImport({ courses, assignments });
    setShowImportOptions(true);
    setShowNoDueReview(false);
    setStatus("idle");
    log("Review tracked courses and import options before adding tasks.");
  };

  const finalizeImport = () => {
    if (!pendingImport) return;

    const trackedCourseIds = Array.from(selectedCourseIds);
    const syncOptions: CanvasSyncOptions = {
      trackedCourseIds,
      onlyAddFromDate: onlyAddFromDate || null,
      excludeNoDueDateTasks: skipNoDueDateTasks,
      reviewNoDueDateTasks: reviewNoDueDateTasks && !skipNoDueDateTasks,
      approvedNoDueAssignmentIds:
        reviewNoDueDateTasks && !skipNoDueDateTasks
          ? Array.from(selectedNoDueAssignmentIds)
          : undefined,
    };

    const username = getCred("username");
    const password = getCred("password");
    const portalUrl = getCred("portalUrl");
    const schoolName = macro.schoolName || "";

    saveConfig({
      username,
      password,
      portalUrl,
      schoolName,
      macroSteps: macro.steps,
      syncOptions,
    });

    setStatus("running");
    log(
      `Importing from ${trackedCourseIds.length} tracked course${
        trackedCourseIds.length === 1 ? "" : "s"
      }...`
    );

    syncFromCanvas(pendingImport.courses, pendingImport.assignments, syncOptions);

    log("Tasks synced successfully ✓", "success");
    setStatus("success");
    onUpdate({ lastRun: new Date().toISOString(), lastRunStatus: "success" });
    closeImportFlow();
  };

  const continueFromImportOptions = () => {
    if (!pendingImport) return;

    if (reviewNoDueDateTasks && !skipNoDueDateTasks) {
      if (noDueCandidates.length > 0) {
        setSelectedNoDueAssignmentIds(new Set(noDueCandidates.map((a) => a.id)));
        setShowImportOptions(false);
        setShowNoDueReview(true);
        return;
      }
      log("No no-due-date tasks found to review in tracked courses.");
    }

    finalizeImport();
  };

  const cancelImportFlow = () => {
    closeImportFlow();
    setStatus("idle");
    log("Import cancelled.", "warn");
  };

  const toggleCourseSelection = (courseId: number) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const toggleNoDueAssignmentSelection = (assignmentId: number) => {
    setSelectedNoDueAssignmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  };

  const run = async () => {
    setStatus("running");
    setLogs([]);
    setExpandedDebugLogs(new Set());
    closeImportFlow();
    log("Starting macro: " + macro.name);

    if (macro.sourceType === "canvas") {
      const username = getCred("username");
      const password = getCred("password");
      const portalUrl = getCred("portalUrl");
      const schoolName = macro.schoolName || "";

      if (!username || !password || !portalUrl || !schoolName) {
        log("Missing credentials. Fill in username, password, portalUrl, and set schoolName in the macro name or description.", "error");
        setStatus("error");
        onUpdate({ lastRun: new Date().toISOString(), lastRunStatus: "error" });
        return;
      }

      // Save config for backwards compatibility
      saveConfig({
        username,
        password,
        portalUrl,
        schoolName,
        macroSteps: macro.steps,
        syncOptions: data.config?.syncOptions,
      });

      try {
        const res = await fetch("/api/canvas?stream=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, portalUrl, schoolName, macroSteps: macro.steps }),
        });

        if (!res.ok || !res.body) {
          const payload = (await res
            .json()
            .catch(() => ({ error: "Unknown error" }))) as Record<string, unknown>;
          const debugSteps = parseDebugSteps(payload.debugSteps);
          appendDebugSteps(debugSteps);
          log(
            "Error: " +
              (typeof payload.error === "string" ? payload.error : res.statusText),
            "error"
          );
          setStatus("error");
          onUpdate({ lastRun: new Date().toISOString(), lastRunStatus: "error" });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let resultPayload: Record<string, unknown> | null = null;
        let streamErrored = false;

        const processStreamLine = (line: string) => {
          if (!line.trim()) return;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line) as Record<string, unknown>;
          } catch {
            return;
          }

          const type = typeof event.type === "string" ? event.type : "";

          if (type === "log") {
            log(
              typeof event.msg === "string" ? event.msg : "…",
              event.level === "error" || event.level === "success" || event.level === "warn"
                ? event.level
                : "info"
            );
            return;
          }

          if (type === "debugStep") {
            appendDebugSteps(parseDebugSteps([event.step]));
            return;
          }

          if (type === "error") {
            appendDebugSteps(parseDebugSteps(event.debugSteps));
            log(
              "Error: " +
                (typeof event.error === "string" ? event.error : "Unknown error"),
              "error"
            );
            streamErrored = true;
            return;
          }

          if (type === "result") {
            resultPayload =
              typeof event.payload === "object" && event.payload !== null
                ? (event.payload as Record<string, unknown>)
                : null;
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            processStreamLine(line);
            newlineIndex = buffer.indexOf("\n");
          }
        }

        if (buffer.trim()) {
          processStreamLine(buffer);
        }

        const payload = resultPayload as Record<string, unknown> | null;

        if (streamErrored || !payload) {
          setStatus("error");
          onUpdate({ lastRun: new Date().toISOString(), lastRunStatus: "error" });
          return;
        }

        if (typeof payload.engine === "string") {
          log(`Automation engine: ${payload.engine}`);
        }
        const courses: Course[] = Array.isArray(payload.courses)
          ? payload.courses
          : [];
        const assignments: Assignment[] = Array.isArray(payload.assignments)
          ? payload.assignments
          : [];
        log(`Fetched ${courses.length} courses, ${assignments.length} assignments`);
        initializeImportFlow(courses, assignments);
      } catch (err) {
        log(`Network error: ${err}`, "error");
        setStatus("error");
        onUpdate({ lastRun: new Date().toISOString(), lastRunStatus: "error" });
      }
    } else {
      log("Generic macro execution coming soon.", "warn");
      log("For now, only Canvas source-type macros support automated syncing.");
      setStatus("idle");
    }
  };

  return (
    <>
      <div className="flex flex-col h-full p-4 gap-4">
        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-sm font-medium ${
              status === "success" ? "text-green-500" :
              status === "error" ? "text-red-500" :
              status === "running" ? "text-[var(--primary)]" :
              "text-[var(--text-muted)]"
            }`}>
              {status === "running" && <Loader2 className="w-4 h-4 animate-spin" />}
              {status === "success" && <CheckCircle2 className="w-4 h-4" />}
              {status === "error" && <AlertCircle className="w-4 h-4" />}
              {status === "idle" && <Terminal className="w-4 h-4" />}
              {status === "idle" ? "Ready" :
               status === "running" ? "Running…" :
               status === "success" ? "Success" : "Failed"}
            </div>
            {macro.lastRun && (
              <span className="text-xs text-[var(--text-muted)]">
                Last run: {new Date(macro.lastRun).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={run}
              disabled={status === "running"}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {status === "running" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Run Now
            </button>
          </div>
        </div>

        {/* Console */}
        <div className="flex-1 rounded-xl border border-[var(--border)] bg-gray-950 overflow-y-auto font-mono text-xs p-3 space-y-1 min-h-[200px]">
          {logs.length === 0 ? (
            <span className="text-gray-500">Waiting to run…</span>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="space-y-1">
                <div className="flex gap-2 items-start">
                  <span className="text-gray-600 shrink-0">{l.time}</span>
                  {l.debugStep ? (
                    <button
                      onClick={() => toggleDebugLog(l.id)}
                      className="flex items-center gap-1.5 min-w-0 text-left"
                    >
                      <ChevronRight
                        className={`w-3 h-3 shrink-0 transition-transform ${
                          expandedDebugLogs.has(l.id) ? "rotate-90" : ""
                        } ${l.debugStep.status === "error" ? "text-red-400" : "text-gray-400"}`}
                      />
                      <span
                        className={
                          l.level === "error"
                            ? "text-red-400"
                            : l.level === "success"
                            ? "text-green-400"
                            : l.level === "warn"
                            ? "text-yellow-400"
                            : "text-gray-300"
                        }
                      >
                        {l.msg}
                        {l.debugStep.screenshotDataUrl ? " (screenshot)" : ""}
                      </span>
                    </button>
                  ) : (
                    <span
                      className={
                        l.level === "error"
                          ? "text-red-400"
                          : l.level === "success"
                          ? "text-green-400"
                          : l.level === "warn"
                          ? "text-yellow-400"
                          : "text-gray-300"
                      }
                    >
                      {l.msg}
                    </span>
                  )}
                </div>

                {l.debugStep && expandedDebugLogs.has(l.id) && (
                  <div className="ml-[4.5rem] rounded-lg border border-gray-800 bg-gray-900/70 p-2 space-y-2 text-[11px]">
                    <div className="text-gray-300">Action: {l.debugStep.action}</div>
                    {l.debugStep.detail && (
                      <div className="text-gray-300">Detail: {l.debugStep.detail}</div>
                    )}
                    {l.debugStep.url && (
                      <div className="text-gray-400 break-all">URL: {l.debugStep.url}</div>
                    )}
                    {l.debugStep.error && (
                      <div className="text-red-400 break-all">Error: {l.debugStep.error}</div>
                    )}
                    {l.debugStep.screenshotDataUrl && (
                      <img
                        src={l.debugStep.screenshotDataUrl}
                        alt={`Step ${l.debugStep.stepNumber} screenshot`}
                        className="w-full max-h-80 object-contain rounded-md border border-gray-700 bg-black"
                      />
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      <AnimatePresence>
        {showImportOptions && pendingImport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-2xl bg-[var(--bg)] border border-[var(--border)] rounded-2xl shadow-2xl p-5 space-y-4"
            >
              <div>
                <h3 className="text-lg font-semibold">Import Tasks</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Choose tracked courses and import rules before tasks are added.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Tracked Courses
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() =>
                        setSelectedCourseIds(new Set(pendingImport.courses.map((c) => c.id)))
                      }
                      className="text-[var(--primary)] hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      onClick={() => setSelectedCourseIds(new Set())}
                      className="text-[var(--text-muted)] hover:underline"
                    >
                      Deselect all
                    </button>
                  </div>
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {pendingImport.courses.map((course) => (
                    <label
                      key={course.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-card)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.has(course.id)}
                        onChange={() => toggleCourseSelection(course.id)}
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: course.color || "#6366f1" }}
                      />
                      <span className="text-sm text-[var(--text)]">{course.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Import Rules (new tasks only)
                </p>

                <label className="space-y-1 block">
                  <span className="text-sm">Only add tasks due on or after</span>
                  <input
                    type="date"
                    value={onlyAddFromDate}
                    onChange={(e) => setOnlyAddFromDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={skipNoDueDateTasks}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSkipNoDueDateTasks(checked);
                      if (checked) setReviewNoDueDateTasks(false);
                    }}
                  />
                  Do not add tasks with no due date
                </label>

                <label
                  className={`flex items-center gap-2 text-sm ${
                    skipNoDueDateTasks ? "text-[var(--text-muted)]" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={reviewNoDueDateTasks}
                    disabled={skipNoDueDateTasks}
                    onChange={(e) => setReviewNoDueDateTasks(e.target.checked)}
                  />
                  Review no due date tasks before adding
                </label>
              </div>

              <div className="text-xs text-[var(--text-muted)]">
                {trackedAssignmentCount} assignment{trackedAssignmentCount === 1 ? "" : "s"} in tracked courses
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={cancelImportFlow}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--bg-card)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={continueFromImportOptions}
                  className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {reviewNoDueDateTasks && !skipNoDueDateTasks && noDueCandidates.length > 0
                    ? "Review No Due Tasks"
                    : "Import Tasks"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNoDueReview && pendingImport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-2xl bg-[var(--bg)] border border-[var(--border)] rounded-2xl shadow-2xl p-5 space-y-4"
            >
              <div>
                <h3 className="text-lg font-semibold">Review No Due Date Tasks</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Select the no due date tasks you want to add from tracked courses.
                </p>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">
                  {noDueCandidates.length} no due date task{noDueCandidates.length === 1 ? "" : "s"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setSelectedNoDueAssignmentIds(new Set(noDueCandidates.map((a) => a.id)))
                    }
                    className="text-[var(--primary)] hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setSelectedNoDueAssignmentIds(new Set())}
                    className="text-[var(--text-muted)] hover:underline"
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--border)] p-2 space-y-1">
                {noDueCandidates.map((assignment) => (
                  <label
                    key={assignment.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-card)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedNoDueAssignmentIds.has(assignment.id)}
                      onChange={() => toggleNoDueAssignmentSelection(assignment.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text)] truncate">{assignment.name}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {assignment.course_name || `Course ${assignment.course_id}`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowNoDueReview(false);
                    setShowImportOptions(true);
                  }}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--bg-card)] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={finalizeImport}
                  className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Import Selected
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── MacroEditor ──────────────────────────────────────────────────────────────

const TAB_ITEMS: { id: MacroTab; label: string; icon: React.ElementType }[] = [
  { id: "steps", label: "Steps", icon: List },
  { id: "record", label: "Record", icon: Video },
  { id: "mappings", label: "Mappings", icon: Map },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "credentials", label: "Credentials", icon: Key },
  { id: "run", label: "Run", icon: Terminal },
];

function MacroEditor({
  macro,
  onUpdate,
  onDelete,
}: {
  macro: Macro;
  onUpdate: (id: string, u: Partial<Macro>) => void;
  onDelete: (id: string) => void;
}) {
  const [tab, setTab] = useState<MacroTab>("steps");
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(macro.name);

  const update = useCallback(
    (u: Partial<Macro>) => onUpdate(macro.id, u),
    [macro.id, onUpdate]
  );

  const saveName = () => {
    if (nameVal.trim()) update({ name: nameVal.trim() });
    else setNameVal(macro.name);
    setEditingName(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-[var(--border)] space-y-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                autoFocus
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameVal(macro.name); setEditingName(false); } }}
                className="text-lg font-semibold w-full bg-transparent border-b border-[var(--primary)] outline-none pb-0.5"
              />
            ) : (
              <button
                onClick={() => { setNameVal(macro.name); setEditingName(true); }}
                className="text-lg font-semibold text-left hover:text-[var(--primary)] transition-colors truncate block w-full"
              >
                {macro.name}
              </button>
            )}
            {macro.description && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{macro.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
              macro.sourceType === "canvas"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
            }`}>
              {macro.sourceType}
            </span>
            <button
              onClick={() => update({ enabled: !macro.enabled })}
              className={`transition-colors ${macro.enabled ? "text-green-500" : "text-[var(--text-muted)]"}`}
              title={macro.enabled ? "Enabled" : "Disabled"}
            >
              {macro.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            </button>
            <button
              onClick={() => { if (confirm(`Delete "${macro.name}"?`)) onDelete(macro.id); }}
              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 overflow-x-auto">
          {TAB_ITEMS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-card)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "steps" && (
          <StepsTab macro={macro} onUpdate={update} onGoToRecord={() => setTab("record")} />
        )}
        {tab === "record" && (
          <div className="h-full flex flex-col" style={{ minHeight: "500px" }}>
            <RecordTab
              onAddSteps={(steps) =>
                update({ steps: [...macro.steps, ...steps] })
              }
            />
          </div>
        )}
        {tab === "mappings" && (
          <FieldMappingsTab macro={macro} onUpdate={update} />
        )}
        {tab === "schedule" && (
          <ScheduleTab macro={macro} onUpdate={update} />
        )}
        {tab === "credentials" && (
          <CredentialsTab macro={macro} onUpdate={update} />
        )}
        {tab === "run" && (
          <div className="h-full flex flex-col" style={{ minHeight: "400px" }}>
            <RunTab macro={macro} onUpdate={update} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SettingsPanel ────────────────────────────────────────────────────────────

function SettingsPanel() {
  const { data, updateSettings } = useAppData();
  const s = data.settings;
  const [saved, setSaved] = useState(false);

  const save = (u: Parameters<typeof updateSettings>[0]) => {
    updateSettings(u);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="p-6 max-w-xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Settings</h2>
        <p className="text-sm text-[var(--text-muted)]">App-wide preferences</p>
      </div>

      {/* Timer */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Timer className="w-4 h-4 text-[var(--primary)]" />
          Focus Timer
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Default session (min)</span>
            <input
              type="number"
              value={s.defaultTimerMinutes}
              onChange={(e) => save({ defaultTimerMinutes: Number(e.target.value) })}
              min={1}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Extra time buffer (min)</span>
            <input
              type="number"
              value={s.extraTimeMinutes}
              onChange={(e) => save({ extraTimeMinutes: Number(e.target.value) })}
              min={0}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
        </div>
      </section>

      {/* Theme */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Appearance</h3>
        <div className="flex gap-2">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => save({ theme: t })}
              className={`flex-1 py-2 rounded-lg border text-sm capitalize transition-colors ${
                s.theme === t
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-card)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {saved && (
        <div className="flex items-center gap-2 text-sm text-green-500">
          <CheckCircle2 className="w-4 h-4" />
          Saved
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  macros,
  selectedId,
  onSelect,
  onCreate,
  onSettings,
  settingsActive,
}: {
  macros: Macro[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onSettings: () => void;
  settingsActive: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] px-2 pb-1">
          Macros
        </p>
        {macros.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] px-2 py-3">
            No macros yet. Create one to get started.
          </p>
        )}
        {macros.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
              selectedId === m.id && !settingsActive
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--text)] hover:bg-[var(--bg-card)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                m.lastRunStatus === "success" ? "bg-green-400" :
                m.lastRunStatus === "error" ? "bg-red-400" :
                m.enabled ? "bg-[var(--text-muted)]" : "bg-transparent border border-[var(--text-muted)]"
              }`} />
              <span className="font-medium text-sm truncate">{m.name}</span>
            </div>
            <div className={`flex items-center gap-2 mt-0.5 text-xs ${
              selectedId === m.id && !settingsActive ? "text-white/60" : "text-[var(--text-muted)]"
            }`}>
              <span className="capitalize">{m.sourceType}</span>
              {m.lastRun && (
                <>
                  <span>·</span>
                  <span>{new Date(m.lastRun).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </button>
        ))}

        <div className="pt-2">
          <button
            onClick={onCreate}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-card)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Macro
          </button>
        </div>
      </div>

      <div className="p-3 border-t border-[var(--border)]">
        <button
          onClick={onSettings}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
            settingsActive
              ? "bg-[var(--primary)] text-white"
              : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-card)]"
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </div>
  );
}

// ─── New Macro Modal ──────────────────────────────────────────────────────────

function NewMacroModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (m: Partial<Macro>) => void;
}) {
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"canvas" | "generic">("canvas");
  const [schoolName, setSchoolName] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      sourceType,
      schoolName: sourceType === "canvas" ? schoolName.trim() : undefined,
      steps: sourceType === "canvas" ? CANVAS_DEFAULT_STEPS() : [],
      credentials: sourceType === "canvas" ? CANVAS_DEFAULT_CREDS() : [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">New Macro</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm text-[var(--text-muted)]">Name</span>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. Canvas Login, My School Portal"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>

          <div className="space-y-1">
            <span className="text-sm text-[var(--text-muted)]">Source Type</span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {([
                { v: "canvas", label: "Canvas LMS", desc: "Syncs Canvas assignments" },
                { v: "generic", label: "Generic", desc: "Custom automation" },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  onClick={() => setSourceType(o.v)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    sourceType === o.v
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--border)] hover:bg-[var(--bg-card)]"
                  }`}
                >
                  <div className="text-sm font-medium">{o.label}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {sourceType === "canvas" && (
            <label className="block space-y-1">
              <span className="text-sm text-[var(--text-muted)]">School subdomain</span>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="yourschool"
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] font-mono"
                />
                <span className="text-sm text-[var(--text-muted)]">.instructure.com</span>
              </div>
            </label>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Create
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── SetupPage ────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const { data, isLoaded, createMacro, updateMacro, deleteMacro } = useAppData();
  const macros = data.macros || [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [mobileTab, setMobileTab] = useState<"sidebar" | "editor">("sidebar");

  const selected = macros.find((m) => m.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setShowSettings(false);
    setMobileTab("editor");
  };

  const handleCreate = (input: Partial<Macro>) => {
    const m = createMacro(input);
    handleSelect(m.id);
  };

  const handleUpdate = useCallback(
    (id: string, u: Partial<Macro>) => updateMacro(id, u),
    [updateMacro]
  );

  const handleDelete = (id: string) => {
    deleteMacro(id);
    if (selectedId === id) {
      setSelectedId(null);
      setMobileTab("sidebar");
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      {/* Mobile tab bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 flex border-b border-[var(--border)] bg-[var(--bg)]">
        {(["sidebar", "editor"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
              mobileTab === t
                ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            {t === "sidebar" ? "Macros" : "Editor"}
          </button>
        ))}
      </div>

      {/* Sidebar */}
      <aside
        className={`w-72 shrink-0 border-r border-[var(--border)] bg-[var(--bg)]
          lg:flex flex-col
          fixed lg:static top-0 bottom-0 left-0 z-10
          ${mobileTab === "sidebar" ? "flex pt-12 lg:pt-0" : "hidden lg:flex"}`}
      >
        <Sidebar
          macros={macros}
          selectedId={selectedId}
          onSelect={handleSelect}
          onCreate={() => setShowNewModal(true)}
          onSettings={() => { setShowSettings(true); setSelectedId(null); setMobileTab("editor"); }}
          settingsActive={showSettings}
        />
      </aside>

      {/* Main content */}
      <main
        className={`flex-1 overflow-hidden flex flex-col
          ${mobileTab === "editor" ? "flex pt-12 lg:pt-0" : "hidden lg:flex"}`}
      >
        {showSettings ? (
          <div className="flex-1 overflow-y-auto">
            <SettingsPanel />
          </div>
        ) : selected ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <MacroEditor
              key={selected.id}
              macro={selected}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[var(--text-muted)] p-8">
            <Zap className="w-12 h-12 opacity-20" />
            <div className="text-center">
              <p className="text-base font-medium text-[var(--text)] mb-1">No macro selected</p>
              <p className="text-sm">
                Choose a macro from the sidebar, or{" "}
                <button
                  onClick={() => setShowNewModal(true)}
                  className="text-[var(--primary)] hover:underline"
                >
                  create a new one
                </button>
                .
              </p>
            </div>
          </div>
        )}
      </main>

      {/* New Macro Modal */}
      <AnimatePresence>
        {showNewModal && (
          <NewMacroModal
            onClose={() => setShowNewModal(false)}
            onCreate={handleCreate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
