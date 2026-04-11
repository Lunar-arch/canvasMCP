"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Timer,
  Globe,
  Zap,
  Database,
  Sun,
  Moon,
  ExternalLink,
  CheckCircle2,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  RefreshCw,
  User,
} from "lucide-react";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { TaskRule, RuleCondition, RuleAction } from "@/types";
import { v4 as uuid } from "uuid";
import { clearData } from "@/lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsTab = "general" | "canvas" | "automation" | "data";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Timer },
  { id: "canvas", label: "Canvas", icon: Globe },
  { id: "automation", label: "Automation", icon: Zap },
  { id: "data", label: "Data", icon: Database },
];

// ─── Save indicator ───────────────────────────────────────────────────────────

function useSaveIndicator() {
  const [saved, setSaved] = useState(false);
  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  return { saved, flash };
}

// ─── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab() {
  const { data, updateSettings } = useAppData();
  const s = data.settings;
  const { saved, flash } = useSaveIndicator();

  const save = (u: Parameters<typeof updateSettings>[0]) => {
    updateSettings(u);
    flash();
  };

  return (
    <div className="space-y-8 max-w-xl">
      {/* Timer */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Timer className="w-4 h-4 text-[var(--primary)]" />
            Focus Timer
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Default durations used in the Pomodoro focus mode.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Default session (min)</span>
            <input
              type="number"
              value={s.defaultTimerMinutes}
              onChange={(e) => save({ defaultTimerMinutes: Math.max(1, Number(e.target.value)) })}
              min={1}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Extra time buffer (min)</span>
            <input
              type="number"
              value={s.extraTimeMinutes}
              onChange={(e) => save({ extraTimeMinutes: Math.max(0, Number(e.target.value)) })}
              min={0}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
        </div>
      </section>

      {/* Appearance */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Appearance</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Choose your preferred color scheme.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: "light", label: "Light", icon: Sun },
            { value: "dark", label: "Dark", icon: Moon },
          ] as const).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => save({ theme: value })}
              className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${
                s.theme === value
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-card)]"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">{label}</span>
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

// ─── Canvas Tab ───────────────────────────────────────────────────────────────

function CanvasTab() {
  const { data, updateSettings } = useAppData();
  const s = data.settings;
  const courses = data.courses;
  const { saved, flash } = useSaveIndicator();

  const save = (u: Parameters<typeof updateSettings>[0]) => {
    updateSettings(u);
    flash();
  };

  const toggleTracked = (courseId: number) => {
    const current = s.canvasTrackedCourseIds ?? [];
    const next = current.includes(courseId)
      ? current.filter((id) => id !== courseId)
      : [...current, courseId];
    save({ canvasTrackedCourseIds: next });
  };

  const toggleExcluded = (courseId: number) => {
    const current = s.excludedCourseIds ?? [];
    const next = current.includes(courseId)
      ? current.filter((id) => id !== courseId)
      : [...current, courseId];
    save({ excludedCourseIds: next });
  };

  const trackedIds = s.canvasTrackedCourseIds ?? [];
  const excludedIds = s.excludedCourseIds ?? [];

  return (
    <div className="space-y-8 max-w-xl">
      {/* Tracked courses */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[var(--primary)]" />
            Tracked Courses
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Courses synced when you run a Canvas macro. Unchecked courses are skipped during import.
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[var(--border)] p-6 text-center space-y-2">
            <Globe className="w-7 h-7 text-[var(--text-muted)] mx-auto opacity-40" />
            <p className="text-sm text-[var(--text-muted)]">No courses yet.</p>
            <p className="text-xs text-[var(--text-muted)]">
              Run a Canvas macro from{" "}
              <Link href="/macro" className="text-[var(--primary)] hover:underline">
                Automation
              </Link>{" "}
              to sync your courses.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
            {courses.map((course) => (
              <label
                key={course.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-card)] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={trackedIds.length === 0 || trackedIds.includes(course.id)}
                  onChange={() => toggleTracked(course.id)}
                  className="rounded"
                />
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: course.color || "#6366f1" }}
                />
                <span className="text-sm text-[var(--text)] flex-1 truncate">{course.name}</span>
                <span className="text-xs text-[var(--text-muted)] font-mono">{course.course_code}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Hidden courses */}
      {courses.length > 0 && (
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Hidden from Dashboard</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Checked courses will be hidden from the task dashboard view.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
            {courses.map((course) => (
              <label
                key={course.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-card)] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={excludedIds.includes(course.id)}
                  onChange={() => toggleExcluded(course.id)}
                  className="rounded"
                />
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: course.color || "#6366f1" }}
                />
                <span className={`text-sm flex-1 truncate ${excludedIds.includes(course.id) ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
                  {course.name}
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Import preferences */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Import Preferences</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            These defaults are pre-filled when you run a Canvas macro.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm text-[var(--text)]">Only add tasks due on or after</span>
            <input
              type="date"
              value={s.canvasOnlyAddFromDate ?? ""}
              onChange={(e) => save({ canvasOnlyAddFromDate: e.target.value || null })}
              className="block w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <p className="text-xs text-[var(--text-muted)]">Leave blank to import all tasks regardless of due date.</p>
          </label>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)] overflow-hidden">
            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors">
              <input
                type="checkbox"
                checked={!!s.canvasSkipNoDueDateTasks}
                onChange={(e) => {
                  const checked = e.target.checked;
                  save({
                    canvasSkipNoDueDateTasks: checked,
                    ...(checked ? { canvasReviewNoDueDateTasks: false } : {}),
                  });
                }}
                className="rounded"
              />
              <div>
                <span className="text-sm text-[var(--text)]">Skip tasks with no due date</span>
                <p className="text-xs text-[var(--text-muted)]">Tasks without a due date are never imported.</p>
              </div>
            </label>

            <label className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors ${s.canvasSkipNoDueDateTasks ? "opacity-50 pointer-events-none" : ""}`}>
              <input
                type="checkbox"
                checked={!!s.canvasReviewNoDueDateTasks}
                disabled={!!s.canvasSkipNoDueDateTasks}
                onChange={(e) => save({ canvasReviewNoDueDateTasks: e.target.checked })}
                className="rounded"
              />
              <div>
                <span className="text-sm text-[var(--text)]">Review no due date tasks before importing</span>
                <p className="text-xs text-[var(--text-muted)]">Shows a picker to choose which ones to add.</p>
              </div>
            </label>
          </div>
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

// ─── Rules components (Automation tab) ────────────────────────────────────────

const CONDITION_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  courseName: "Course name",
  hasDueDate: "Has due date",
  pointsPossible: "Points possible",
};

const OPERATOR_LABELS: Record<string, string> = {
  contains: "contains",
  not_contains: "does not contain",
  equals: "equals",
  not_equals: "does not equal",
  is_null: "is empty / no",
  is_not_null: "is not empty / yes",
  gt: "greater than",
  lt: "less than",
};

const ACTION_FIELD_LABELS: Record<string, string> = {
  priority: "Set priority",
  dueDateOffset: "Shift due date (days)",
  estimatedMinutes: "Set estimated minutes",
  addTag: "Add tag",
};

const PRIORITY_OPTIONS = [
  { value: "none", label: "None (clear)" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function RuleCard({
  rule,
  tags,
  onUpdate,
  onDelete,
}: {
  rule: TaskRule;
  tags: { id: string; name: string; color: string }[];
  onUpdate: (id: string, u: Partial<TaskRule>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const addCondition = () => {
    const cond: RuleCondition = { id: uuid(), field: "title", operator: "contains", value: "" };
    onUpdate(rule.id, { conditions: [...rule.conditions, cond] });
  };

  const updateCondition = (condId: string, u: Partial<RuleCondition>) => {
    onUpdate(rule.id, {
      conditions: rule.conditions.map((c) => (c.id === condId ? { ...c, ...u } : c)),
    });
  };

  const removeCondition = (condId: string) => {
    onUpdate(rule.id, { conditions: rule.conditions.filter((c) => c.id !== condId) });
  };

  const addAction = () => {
    const action: RuleAction = { id: uuid(), field: "priority", value: "high" };
    onUpdate(rule.id, { actions: [...rule.actions, action] });
  };

  const updateAction = (actId: string, u: Partial<RuleAction>) => {
    onUpdate(rule.id, {
      actions: rule.actions.map((a) => (a.id === actId ? { ...a, ...u } : a)),
    });
  };

  const removeAction = (actId: string) => {
    onUpdate(rule.id, { actions: rule.actions.filter((a) => a.id !== actId) });
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => onUpdate(rule.id, { enabled: !rule.enabled })}
          className={`transition-colors shrink-0 ${rule.enabled ? "text-green-500" : "text-[var(--text-muted)]"}`}
          title={rule.enabled ? "Enabled" : "Disabled"}
        >
          {rule.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
        </button>
        <input
          value={rule.name}
          onChange={(e) => onUpdate(rule.id, { name: e.target.value })}
          className="flex-1 text-sm font-medium bg-transparent border-none outline-none placeholder:text-[var(--text-muted)]"
          placeholder="Rule name…"
        />
        <span className="text-xs text-[var(--text-muted)]">
          {rule.conditions.length} cond · {rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          onClick={() => { if (confirm(`Delete rule "${rule.name}"?`)) onDelete(rule.id); }}
          className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950 text-[var(--text-muted)] hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-2 pt-3 text-sm">
            <span className="text-[var(--text-muted)]">Match</span>
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs">
              {(["all", "any"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => onUpdate(rule.id, { conditionLogic: v })}
                  className={`px-3 py-1 transition-colors ${
                    rule.conditionLogic === v
                      ? "bg-[var(--primary)] text-white"
                      : "hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {v === "all" ? "ALL" : "ANY"}
                </button>
              ))}
            </div>
            <span className="text-[var(--text-muted)]">conditions</span>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Conditions</p>
            {rule.conditions.map((cond) => (
              <div key={cond.id} className="flex items-center gap-2 flex-wrap">
                <CustomSelect
                  size="sm"
                  value={cond.field}
                  onChange={(v) => updateCondition(cond.id, { field: v as RuleCondition["field"] })}
                  options={Object.entries(CONDITION_FIELD_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                  className="w-36"
                />
                <CustomSelect
                  size="sm"
                  value={cond.operator}
                  onChange={(v) => updateCondition(cond.id, { operator: v as RuleCondition["operator"] })}
                  options={Object.entries(OPERATOR_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                  className="w-40"
                />
                {!["is_null", "is_not_null"].includes(cond.operator) && (
                  <input
                    value={cond.value}
                    onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                    placeholder="value…"
                    className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ring)] w-28"
                  />
                )}
                <button
                  onClick={() => removeCondition(cond.id)}
                  className="p-1 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={addCondition}
              className="flex items-center gap-1.5 text-xs text-[var(--primary)] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Add condition
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Then…</p>
            {rule.actions.map((action) => (
              <div key={action.id} className="flex items-center gap-2 flex-wrap">
                <CustomSelect
                  size="sm"
                  value={action.field}
                  onChange={(v) => updateAction(action.id, { field: v as RuleAction["field"], value: "" })}
                  options={Object.entries(ACTION_FIELD_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                  className="w-40"
                />
                {action.field === "priority" ? (
                  <CustomSelect
                    size="sm"
                    value={action.value}
                    onChange={(v) => updateAction(action.id, { value: v })}
                    options={PRIORITY_OPTIONS}
                    className="w-32"
                  />
                ) : action.field === "addTag" ? (
                  <CustomSelect
                    size="sm"
                    value={action.value}
                    onChange={(v) => updateAction(action.id, { value: v })}
                    options={[
                      { value: "", label: "— select tag —" },
                      ...tags.map((t) => ({ value: t.id, label: t.name })),
                    ]}
                    className="w-40"
                  />
                ) : (
                  <input
                    type="number"
                    value={action.value}
                    onChange={(e) => updateAction(action.id, { value: e.target.value })}
                    placeholder={action.field === "dueDateOffset" ? "days (neg = earlier)" : "minutes"}
                    className="px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ring)] w-36"
                  />
                )}
                <button
                  onClick={() => removeAction(action.id)}
                  className="p-1 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={addAction}
              className="flex items-center gap-1.5 text-xs text-[var(--primary)] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Add action
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Automation Tab ───────────────────────────────────────────────────────────

function AutomationTab() {
  const { data, createTaskRule, updateTaskRule, deleteTaskRule } = useAppData();
  const rules = data.taskRules || [];
  const macros = data.macros || [];

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Macros link */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--primary)]" />
            Macros
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Macros automate browser login and Canvas assignment sync.
          </p>
        </div>

        <Link
          href="/macro"
          className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-[var(--primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text)]">Open Macro Editor</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {macros.length === 0
                ? "No macros yet — create one to get started."
                : `${macros.length} macro${macros.length !== 1 ? "s" : ""} configured`}
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors shrink-0" />
        </Link>
      </section>

      {/* Import Rules */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--primary)]" />
            Import Rules
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Rules applied automatically to newly imported tasks. They run in order — later rules can override earlier ones.
          </p>
        </div>

        <div className="space-y-3">
          {rules.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-[var(--border)] p-8 text-center space-y-2">
              <Filter className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-40" />
              <p className="text-sm text-[var(--text-muted)]">No rules yet.</p>
              <p className="text-xs text-[var(--text-muted)]">
                Rules let you automatically set priority, due dates, tags, and more based on task criteria.
              </p>
            </div>
          )}

          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              tags={data.tags}
              onUpdate={updateTaskRule}
              onDelete={deleteTaskRule}
            />
          ))}

          <button
            onClick={() => createTaskRule({ name: "New Rule" })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)] transition-colors w-full"
          >
            <Plus className="w-4 h-4" />
            Add rule
          </button>
        </div>

        <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4 text-xs text-[var(--text-muted)] space-y-1.5">
          <p className="font-semibold text-[var(--text)]">How rules work</p>
          <p>Rules only run on <strong>newly</strong> imported tasks — tasks that don&apos;t already exist in your list. Existing tasks keep their current values.</p>
          <p>Example: &quot;If course name contains <em>Math</em>, set priority to High and estimated time to 60 min.&quot;</p>
        </div>
      </section>
    </div>
  );
}

// ─── Data Tab ─────────────────────────────────────────────────────────────────

function DataTab() {
  const { data } = useAppData();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClear = () => {
    clearData();
    router.push("/");
  };

  const taskCount = data.tasks.length;
  const courseCount = data.courses.length;
  const macroCount = data.macros.length;
  const tagCount = data.tags.length;

  return (
    <div className="space-y-8 max-w-xl">
      {/* Account */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--primary)]" />
            Account
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Cloud sync stores your data in Supabase when signed in.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          {user ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text)]">{user.email}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Signed in · cloud sync active</p>
              </div>
              <button
                onClick={() => signOut()}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Not signed in</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Data is stored locally only.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Summary */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Database className="w-4 h-4 text-[var(--primary)]" />
            Storage Summary
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            All data is stored in your browser&apos;s localStorage.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Tasks", value: taskCount },
            { label: "Courses", value: courseCount },
            { label: "Macros", value: macroCount },
            { label: "Tags", value: tagCount },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-2xl font-bold text-[var(--text)]">{value}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        {data.lastSynced && (
          <p className="text-xs text-[var(--text-muted)]">
            Last synced from Canvas: {new Date(data.lastSynced).toLocaleString()}
          </p>
        )}
      </section>

      {/* Danger zone */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-red-500 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Irreversible actions. Proceed with caution.
          </p>
        </div>

        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">Clear all local data</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Permanently removes all tasks, courses, macros, and settings from localStorage. This cannot be undone.
            </p>
          </div>
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-sm text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              Clear all data…
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Yes, clear everything
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card)] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── SettingsPage ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isLoaded } = useAppData();
  const [tab, setTab] = useState<SettingsTab>("general");

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Top bar */}
      <div className="border-b border-[var(--border)] bg-[var(--bg)] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-[var(--border)]">/</span>
          <span className="text-sm font-medium">Settings</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Manage your preferences and app configuration.</p>
        </div>

        <div className="flex gap-8">
          {/* Left nav */}
          <nav className="w-44 shrink-0 space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                  tab === id
                    ? "bg-[var(--primary)] text-white font-medium"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-card)]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
              >
                <div className="mb-5">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <activeTab.icon className="w-4 h-4 text-[var(--primary)]" />
                    {activeTab.label}
                  </h2>
                </div>
                {tab === "general" && <GeneralTab />}
                {tab === "canvas" && <CanvasTab />}
                {tab === "automation" && <AutomationTab />}
                {tab === "data" && <DataTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
