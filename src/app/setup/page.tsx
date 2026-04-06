"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/hooks/useAppData";
import {
  MacroStep,
  WaitType,
  Macro,
  FieldMapping,
  MacroCredential,
  MacroSchedule,
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
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
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
}: {
  step: MacroStep;
  index: number;
  updateStep: (id: string, u: Partial<MacroStep>) => void;
  removeStep: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const meta = ACTION_OPTIONS.find((a) => a.value === step.action);
  const Icon = meta?.icon || Globe;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] group"
    >
      <div className="flex items-center gap-1.5 pt-1.5">
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
            value={step.label}
            onChange={(e) => updateStep(step.id, { label: e.target.value })}
            placeholder="Step label"
            className="flex-1 min-w-0 text-sm bg-transparent outline-none text-[var(--text)]"
          />
          <button
            onClick={() => removeStep(step.id)}
            className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950 text-[var(--text-muted)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
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

  const updateStep = (id: string, u: Partial<MacroStep>) => {
    onUpdate({ steps: macro.steps.map((s) => (s.id === id ? { ...s, ...u } : s)) });
  };
  const removeStep = (id: string) => {
    onUpdate({ steps: macro.steps.filter((s) => s.id !== id) });
  };
  const addStep = () => {
    onUpdate({
      steps: [
        ...macro.steps,
        { id: uuid(), action: "click", selector: "", label: "New step" },
      ],
    });
  };
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = macro.steps.findIndex((s) => s.id === active.id);
    const newIndex = macro.steps.findIndex((s) => s.id === over.id);
    onUpdate({ steps: arrayMove(macro.steps, oldIndex, newIndex) });
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          {macro.steps.length} step{macro.steps.length !== 1 ? "s" : ""}
          {" · "}Use <code className="text-xs bg-[var(--bg-card)] border border-[var(--border)] px-1 py-0.5 rounded">{"{{key}}"}</code> to reference credentials.
        </p>
        <button
          onClick={onGoToRecord}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-card)] transition-colors"
        >
          <Video className="w-3.5 h-3.5" />
          Record
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={macro.steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {macro.steps.map((step, i) => (
              <SortableStep
                key={step.id}
                step={step}
                index={i}
                updateStep={updateStep}
                removeStep={removeStep}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={addStep}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--bg-card)] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Step
      </button>
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
  const { syncFromCanvas, saveConfig } = useAppData();
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [logs, setLogs] = useState<{ level: string; msg: string; time: string }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const log = (msg: string, level = "info") => {
    setLogs((prev) => [
      ...prev,
      { level, msg, time: new Date().toLocaleTimeString() },
    ]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const getCred = (key: string) =>
    macro.credentials.find((c) => c.key === key)?.value || "";

  const run = async () => {
    setStatus("running");
    setLogs([]);
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
      saveConfig({ username, password, portalUrl, schoolName, macroSteps: macro.steps });

      log("Launching browser automation...");
      try {
        const res = await fetch("/api/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, portalUrl, schoolName, macroSteps: macro.steps }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          log("Error: " + (err.error || res.statusText), "error");
          setStatus("error");
          onUpdate({ lastRun: new Date().toISOString(), lastRunStatus: "error" });
          return;
        }

        const data = await res.json();
        const { courses = [], assignments = [] } = data;
        log(`Fetched ${courses.length} courses, ${assignments.length} assignments`);
        syncFromCanvas(courses, assignments);
        log("Tasks synced successfully ✓", "success");
        setStatus("success");
        onUpdate({ lastRun: new Date().toISOString(), lastRunStatus: "success" });
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
          logs.map((l, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-gray-600 shrink-0">{l.time}</span>
              <span className={
                l.level === "error" ? "text-red-400" :
                l.level === "success" ? "text-green-400" :
                l.level === "warn" ? "text-yellow-400" :
                "text-gray-300"
              }>{l.msg}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
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
