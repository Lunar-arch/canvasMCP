"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/hooks/useAppData";
import { MacroStep, CanvasConfig, WaitType } from "@/types";
import { v4 as uuid } from "uuid";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Play,
  BookOpen,
  Save,
  MousePointer,
  Type,
  Globe,
  Clock,
  Keyboard,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Timer,
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

const ACTION_OPTIONS: {
  value: MacroStep["action"];
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    value: "navigate",
    label: "Navigate",
    icon: Globe,
    description: "Go to a URL",
  },
  {
    value: "fill",
    label: "Fill Input",
    icon: Type,
    description: "Type text into a field",
  },
  {
    value: "click",
    label: "Click",
    icon: MousePointer,
    description: "Click an element",
  },
  {
    value: "press",
    label: "Press Key",
    icon: Keyboard,
    description: "Press a keyboard key",
  },
  {
    value: "wait",
    label: "Wait",
    icon: Clock,
    description: "Wait for URL, element, navigation, or a duration",
  },
];

const WAIT_TYPE_OPTIONS: { value: WaitType; label: string; description: string }[] = [
  { value: "url", label: "Wait for URL", description: "Wait until the page URL matches a pattern" },
  { value: "selector", label: "Wait for Element", description: "Wait until a CSS selector appears" },
  { value: "navigation", label: "Wait for Page Load", description: "Wait until the page finishes loading" },
  { value: "duration", label: "Wait (fixed time)", description: "Pause for a set number of milliseconds" },
];

const DEFAULT_STEPS: MacroStep[] = [
  {
    id: uuid(),
    action: "navigate",
    url: "{{portalUrl}}",
    label: "Go to login portal",
  },
  {
    id: uuid(),
    action: "fill",
    selector: "#username",
    value: "{{username}}",
    label: "Enter username",
  },
  {
    id: uuid(),
    action: "fill",
    selector: "#password",
    value: "{{password}}",
    label: "Enter password",
  },
  {
    id: uuid(),
    action: "click",
    selector: "button[type='submit']",
    label: "Click login button",
  },
  {
    id: uuid(),
    action: "wait",
    waitType: "navigation",
    label: "Wait for page to load",
  },
];

function SortableStep({
  step,
  index,
  updateStep,
  removeStep,
}: {
  step: MacroStep;
  index: number;
  updateStep: (id: string, updates: Partial<MacroStep>) => void;
  removeStep: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const actionMeta = ACTION_OPTIONS.find((a) => a.value === step.action);
  const Icon = actionMeta?.icon || Globe;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] group"
    >
      <div className="flex items-center gap-2 pt-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-0.5"
          tabIndex={-1}
        >
          <GripVertical className="w-4 h-4 text-[var(--text-muted)] opacity-50 group-hover:opacity-100 transition-opacity" />
        </button>
        <span className="text-xs font-mono text-[var(--text-muted)] w-5 text-right">
          {index + 1}
        </span>
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border)] text-xs">
            <Icon className="w-3 h-3" />
            <select
              value={step.action}
              onChange={(e) =>
                updateStep(step.id, {
                  action: e.target.value as MacroStep["action"],
                })
              }
              className="bg-transparent outline-none text-xs cursor-pointer"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={step.label}
            onChange={(e) =>
              updateStep(step.id, { label: e.target.value })
            }
            placeholder="Step label"
            className="flex-1 text-sm bg-transparent outline-none"
          />
          <button
            onClick={() => removeStep(step.id)}
            className="p-1 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(step.action === "fill" ||
            step.action === "click" ||
            step.action === "press") && (
            <input
              type="text"
              value={step.selector || ""}
              onChange={(e) =>
                updateStep(step.id, { selector: e.target.value })
              }
              placeholder="CSS selector (e.g. #username)"
              className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          )}
          {step.action === "fill" && (
            <input
              type="text"
              value={step.value || ""}
              onChange={(e) =>
                updateStep(step.id, { value: e.target.value })
              }
              placeholder="Value (use {{username}} or {{password}})"
              className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          )}
          {step.action === "navigate" && (
            <input
              type="text"
              value={step.url || ""}
              onChange={(e) =>
                updateStep(step.id, { url: e.target.value })
              }
              placeholder="URL (use {{portalUrl}} for your login URL)"
              className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          )}
          {step.action === "press" && (
            <input
              type="text"
              value={step.key || ""}
              onChange={(e) =>
                updateStep(step.id, { key: e.target.value })
              }
              placeholder="Key (e.g. Enter, Tab)"
              className="w-32 px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          )}
          {step.action === "wait" && (
            <div className="flex items-center gap-2 flex-wrap w-full">
              <select
                value={step.waitType || "navigation"}
                onChange={(e) =>
                  updateStep(step.id, {
                    waitType: e.target.value as WaitType,
                  })
                }
                className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                {WAIT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {step.waitType === "url" && (
                <input
                  type="text"
                  value={step.waitUrl || ""}
                  onChange={(e) =>
                    updateStep(step.id, { waitUrl: e.target.value })
                  }
                  placeholder="URL pattern (e.g. **/dashboard** or https://...)"
                  className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              )}
              {step.waitType === "selector" && (
                <input
                  type="text"
                  value={step.waitSelector || ""}
                  onChange={(e) =>
                    updateStep(step.id, { waitSelector: e.target.value })
                  }
                  placeholder="CSS selector to wait for (e.g. #main-content)"
                  className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              )}
              {step.waitType === "duration" && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={step.waitTime || 2000}
                    onChange={(e) =>
                      updateStep(step.id, {
                        waitTime: parseInt(e.target.value) || 2000,
                      })
                    }
                    className="w-20 px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                  <span className="text-xs text-[var(--text-muted)]">ms</span>
                </div>
              )}
              {(step.waitType === "url" || step.waitType === "selector" || step.waitType === "navigation") && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[var(--text-muted)]">timeout:</span>
                  <input
                    type="number"
                    value={step.waitTime || 30000}
                    onChange={(e) =>
                      updateStep(step.id, {
                        waitTime: parseInt(e.target.value) || 30000,
                      })
                    }
                    className="w-20 px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
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

export default function SetupPage() {
  const router = useRouter();
  const { data, saveConfig, syncFromCanvas, updateSettings, createCourse } = useAppData();

  const [username, setUsername] = useState(data.config?.username || "");
  const [password, setPassword] = useState(data.config?.password || "");
  const [portalUrl, setPortalUrl] = useState(data.config?.portalUrl || "");
  const [schoolName, setSchoolName] = useState(data.config?.schoolName || "");
  const [steps, setSteps] = useState<MacroStep[]>(
    data.config?.macroSteps || DEFAULT_STEPS
  );
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [notionDbName, setNotionDbName] = useState("");
  // If the OAuth callback stored tokens in localStorage, capture them and persist
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('notion_oauth') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        // persist tokens into app settings
        if (parsed && parsed.access_token) {
          updateSettings({ notion: { ...data.settings.notion, accessToken: parsed.access_token, refreshToken: parsed.refresh_token, workspaceName: parsed.workspace_name } });
        }
        localStorage.removeItem('notion_oauth');
      }
    } catch (e) {
      // ignore
    }
    // listen for popup message
    const handler = (ev: MessageEvent) => {
      if (ev.data?.type === 'notion_oauth' && ev.data.data) {
        const d = ev.data.data;
        updateSettings({ notion: { ...data.settings.notion, accessToken: d.access_token, refreshToken: d.refresh_token, workspaceName: d.workspace_name } });
      }
    };
    window.addEventListener('message', handler, false);
    return () => window.removeEventListener('message', handler as any);
  }, []);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseColor, setNewCourseColor] = useState<string>("#6366f1");

  const addStep = (action: MacroStep["action"]) => {
    const step: MacroStep = {
      id: uuid(),
      action,
      label: ACTION_OPTIONS.find((a) => a.value === action)?.label || action,
      selector: action !== "navigate" && action !== "wait" ? "" : undefined,
      value: action === "fill" ? "" : undefined,
      url: action === "navigate" ? "" : undefined,
      key: action === "press" ? "Enter" : undefined,
      waitTime: action === "wait" ? 2000 : undefined,
      waitType: action === "wait" ? "navigation" : undefined,
      waitUrl: undefined,
      waitSelector: undefined,
    };
    setSteps([...steps, step]);
  };

  const updateStep = (id: string, updates: Partial<MacroStep>) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleStepDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      setSteps(arrayMove(steps, oldIndex, newIndex));
    }
  };

  const handleSave = () => {
    const config: CanvasConfig = {
      username,
      password,
      portalUrl,
      schoolName,
      macroSteps: steps.map((s) => ({
        ...s,
        url: s.url?.replace("{{portalUrl}}", portalUrl),
      })),
    };
    saveConfig(config);
    setSyncResult({ success: true, message: "Configuration saved!" });
    setTimeout(() => setSyncResult(null), 2000);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    handleSave();

    try {
      const config: CanvasConfig = {
        username,
        password,
        portalUrl,
        schoolName,
        macroSteps: steps.map((s) => ({
          ...s,
          url: s.url?.replace("{{portalUrl}}", portalUrl),
        })),
      };

      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Sync failed");
      }

      // Actually store the synced data so it shows on the dashboard
      syncFromCanvas(result.courses, result.assignments);

      setSyncResult({
        success: true,
        message: `Synced ${result.courses.length} courses and ${result.assignments.length} assignments!`,
      });
    } catch (err: unknown) {
      setSyncResult({
        success: false,
        message: err instanceof Error ? err.message : "Sync failed",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Canvas Setup</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Configure your login and sync assignments
            </p>
          </div>
        </div>

        {/* Credentials */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold">Credentials</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                School Name
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g. myschool"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] text-sm"
              />
              <p className="text-xs text-[var(--text-muted)]" suppressHydrationWarning>
                Used in: {schoolName || "school"}.instructure.com
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Portal Login URL
              </label>
              <input
                type="url"
                value={portalUrl}
                onChange={(e) => setPortalUrl(e.target.value)}
                placeholder="https://login.myschool.edu"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your username"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] text-sm"
              />
            </div>
          </div>
        </motion.section>

        {/* Macro Editor */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Login Macro</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Define steps to log into your school portal and reach Canvas
              </p>
            </div>
          </div>

          <div className="text-xs bg-[var(--primary-light)] text-[var(--primary)] rounded-lg p-3 space-y-1">
            <p className="font-medium">Available variables:</p>
            <p>
              <code className="bg-white/50 px-1 rounded">{"{{username}}"}</code>{" "}
              <code className="bg-white/50 px-1 rounded">{"{{password}}"}</code>{" "}
              <code className="bg-white/50 px-1 rounded">
                {"{{portalUrl}}"}
              </code>
            </p>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleStepDragEnd}
          >
            <SortableContext
              items={steps.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {/* Notion integration */}
                <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Notion Calendar Sync</h3>
                      <p className="text-xs text-[var(--text-muted)]">Connect a Notion database to sync events to Notion.</p>
                    </div>
                    <div>
                      {!data.settings.notion?.accessToken ? (
                        <a
                          href="/api/notion/auth"
                          className="px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-sm"
                        >
                          Connect to Notion
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">Connected to {data.settings.notion?.workspaceName || "Notion"}</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Database name to find/create"
                      value={notionDbName}
                      onChange={(e) => setNotionDbName(e.target.value)}
                      className="col-span-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm"
                    />
                    <button
                      onClick={async () => {
                        if (!notionDbName) return;
                        // call provision endpoint
                        const token = data.settings.notion?.accessToken;
                        if (!token) {
                          alert("Connect Notion first");
                          return;
                        }
                        const res = await fetch("/api/notion/provision", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ accessToken: token, dbName: notionDbName }),
                        });
                        const json = await res.json();
                        if (res.ok && json.databaseId) {
                          updateSettings({ notion: { ...data.settings.notion, databaseId: json.databaseId } });
                          alert("Database connected: " + json.databaseId);
                        } else {
                          alert("Provision failed: " + (json.error?.message || json.error || JSON.stringify(json)));
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-sm"
                    >
                      Find / Connect
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const token = data.settings.notion?.accessToken;
                        const db = data.settings.notion?.databaseId;
                        if (!token || !db) return alert("Provide database and connect Notion first");
                        // Build simple events from tasks and sync
                        const events = data.tasks.slice(0, 10).map((t) => ({
                          title: t.title,
                          startISO: t.dueAt || new Date().toISOString(),
                          endISO: t.dueAt || new Date(new Date().getTime() + (t.estimatedMinutes||25)*60000).toISOString(),
                          description: t.description || undefined,
                        }));
                        const res = await fetch("/api/notion/sync", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ accessToken: token, databaseId: db, events }),
                        });
                        const json = await res.json();
                        if (res.ok) alert("Synced " + (json.created?.length || 0) + " items");
                        else alert("Sync failed: " + (json.error?.message || json.error || JSON.stringify(json)));
                      }}
                      className="px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-sm"
                    >
                      Sync Now
                    </button>
                    <div className="text-xs text-[var(--text-muted)]">After connecting and provisioning, add this database to your Notion Calendar app manually.</div>
                  </div>
                </div>
                  {/* Create custom course */}
                  <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Course name"
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] focus:outline-none text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Code"
                        value={newCourseCode}
                        onChange={(e) => setNewCourseCode(e.target.value)}
                        className="w-32 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] focus:outline-none text-sm"
                      />
                      <input
                        type="color"
                        value={newCourseColor}
                        onChange={(e) => setNewCourseColor(e.target.value)}
                        className="w-12 h-10 p-0 border-0 bg-transparent"
                      />
                      <button
                        onClick={() => {
                          if (!newCourseName.trim()) return;
                          createCourse(newCourseName.trim(), newCourseCode.trim() || undefined, newCourseColor);
                          setNewCourseName("");
                          setNewCourseCode("");
                        }}
                        className="px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-sm"
                      >
                        Create
                      </button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">You can create local courses not linked to Canvas. They will appear in task course selectors.</p>
                  </div>
                {steps.map((step, index) => (
                  <SortableStep
                    key={step.id}
                    step={step}
                    index={index}
                    updateStep={updateStep}
                    removeStep={removeStep}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add step dropdown */}
          <div className="relative group/add">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
              <Plus className="w-4 h-4" />
              Add Step
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-lg opacity-0 invisible group-hover/add:opacity-100 group-hover/add:visible transition-all z-10">
              {ACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => addStep(opt.value)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--bg-hover)] first:rounded-t-xl last:rounded-b-xl transition-colors"
                >
                  <opt.icon className="w-4 h-4 text-[var(--text-secondary)]" />
                  <div className="text-left">
                    <p className="font-medium">{opt.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {opt.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Focus Timer Settings */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold">Focus Timer Settings</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Default Timer (minutes)
              </label>
              <input
                type="number"
                value={data.settings.defaultTimerMinutes}
                onChange={(e) =>
                  updateSettings({
                    defaultTimerMinutes: parseInt(e.target.value) || 25,
                  })
                }
                min={1}
                max={120}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] text-sm"
              />
              <p className="text-xs text-[var(--text-muted)]">
                Used when a task has no estimated time set
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Extra Time Increment (minutes)
              </label>
              <input
                type="number"
                value={data.settings.extraTimeMinutes}
                onChange={(e) =>
                  updateSettings({
                    extraTimeMinutes: parseInt(e.target.value) || 5,
                  })
                }
                min={1}
                max={30}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] text-sm"
              />
              <p className="text-xs text-[var(--text-muted)]">
                Added when you tap &quot;Not done → + time&quot;
              </p>
            </div>
          </div>
        </motion.section>

        {/* Course Sync Settings */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold">Course Sync</h2>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">Choose which courses should be synced from Canvas. Toggle to exclude courses from future syncs.</p>

          <div className="space-y-2">
            {data.courses.length === 0 && (
              <p className="text-xs text-[var(--text-muted)]">No courses available. Run a sync to fetch courses.</p>
            )}
            {data.courses.map((c) => {
              const excluded = (data.settings.excludedCourseIds || []).includes(c.id);
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{c.course_code}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!excluded}
                        onChange={() => {
                          const current = data.settings.excludedCourseIds || [];
                          const next = current.includes(c.id)
                            ? current.filter((id) => id !== c.id)
                            : [...current, c.id];
                          updateSettings({ excludedCourseIds: next });
                        }}
                      />
                      <span className="text-xs">Sync</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] font-medium text-sm hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Config
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || !schoolName || !portalUrl}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white font-medium text-sm hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {syncing ? "Syncing..." : "Save & Sync"}
          </button>
        </div>

        {/* Sync result */}
        <AnimatePresence>
          {syncResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex items-center gap-3 p-4 rounded-xl border ${
                syncResult.success
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {syncResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <p className="text-sm">{syncResult.message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
