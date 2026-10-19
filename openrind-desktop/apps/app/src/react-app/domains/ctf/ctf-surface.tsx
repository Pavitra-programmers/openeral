/** @jsxImportSource react */
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Cpu,
  Download,
  Eye,
  FileCode,
  Globe,
  Loader2,
  Play,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
} from "lucide-react";

import type { CtfTask } from "./ctf-task-sidebar";

const PRESET_MODELS = [
  { id: "openai/gpt-4o", label: "OpenAI GPT-4o" },
  { id: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini" },
  { id: "anthropic/claude-3-7-sonnet", label: "Claude 3.7 Sonnet" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek V3" },
  { id: "custom", label: "Custom Model..." },
];

export type CtfStep = {
  number: number;
  totalSteps?: number;
  thought: string;
  tool: string;
  action: {
    action?: string;
    selector?: string;
    value?: string;
    flag?: string;
  };
  observation: string;
  durationMs?: number;
};

export type CtfSurfaceProps = {
  task: CtfTask | null;
  onRefreshTasks?: () => void;
};

export function CtfSurface(props: CtfSurfaceProps) {
  const { task } = props;

  const [selectedModelPreset, setSelectedModelPreset] = useState("openai/gpt-4o");
  const [customModelText, setCustomModelText] = useState("");
  const [maxSteps, setMaxSteps] = useState(50);

  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [steps, setSteps] = useState<CtfStep[]>([]);
  const [solvedFlag, setSolvedFlag] = useState<string | null>(null);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "raw" | "harbor">("timeline");
  const [rawTrajectory, setRawTrajectory] = useState<any | null>(null);
  const [harborBusy, setHarborBusy] = useState(false);
  const [harborSuccess, setHarborSuccess] = useState<string | null>(null);

  const stepsEndRef = useRef<HTMLDivElement | null>(null);

  const activeModel =
    selectedModelPreset === "custom" && customModelText.trim()
      ? customModelText.trim()
      : selectedModelPreset;

  // Load existing trace when task changes
  useEffect(() => {
    if (!task) return;
    setSteps([]);
    setSolvedFlag(null);
    setIsSolved(false);
    setRawTrajectory(null);
    setHarborSuccess(null);
    setStatusMessage(null);

    const loadTrace = async () => {
      try {
        const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
        if (!invoke) return;
        const trace = await invoke("ctfGetTrace", task.id);
        if (trace) {
          setRawTrajectory(trace);
          if (Array.isArray(trace.steps)) {
            setSteps(trace.steps);
          }
          if (trace.judge?.accepted || trace.solved) {
            setIsSolved(true);
            setSolvedFlag(trace.judge?.submission || task.flag || "pseudopods_are_da_bomb");
          }
        }
      } catch {}
    };

    void loadTrace();
  }, [task?.id]);

  // Subscribe to real-time events from main process
  useEffect(() => {
    const electron = (window as any).__OPENRIND_DESKTOP_ELECTRON__;
    if (!electron?.ctf) return;

    const unsubStep = electron.ctf.onStep?.((step: CtfStep) => {
      setSteps((prev) => [...prev, step]);
      stepsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    const unsubStatus = electron.ctf.onStatus?.((data: any) => {
      if (data?.message) setStatusMessage(data.message);
    });

    const unsubComplete = electron.ctf.onComplete?.((res: any) => {
      setIsRunning(false);
      if (res?.solved) {
        setIsSolved(true);
        setSolvedFlag(res.flag);
      }
      if (res?.trajectory) {
        setRawTrajectory(res.trajectory);
      }
      props.onRefreshTasks?.();
    });

    return () => {
      unsubStep?.();
      unsubStatus?.();
      unsubComplete?.();
    };
  }, [props.onRefreshTasks]);

  const handleRunTask = async () => {
    if (!task || isRunning) return;
    setIsRunning(true);
    setSteps([]);
    setSolvedFlag(null);
    setIsSolved(false);
    setHarborSuccess(null);
    setStatusMessage("Starting CTF Agent run...");

    try {
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (!invoke) throw new Error("Desktop bridge unavailable");

      await invoke("ctfRunTask", {
        taskId: task.id,
        model: activeModel,
        maxSteps,
      });
    } catch (err: any) {
      setStatusMessage(`Execution error: ${err?.message || String(err)}`);
      setIsRunning(false);
    }
  };

  const handleStopTask = async () => {
    try {
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (invoke) await invoke("ctfStopTask");
    } catch {}
    setIsRunning(false);
    setStatusMessage("Run stopped by user.");
  };

  const handleCopyFlag = () => {
    if (!solvedFlag) return;
    navigator.clipboard.writeText(solvedFlag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportHarbor = async () => {
    if (!task) return;
    setHarborBusy(true);
    setHarborSuccess(null);
    try {
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (!invoke) throw new Error("Desktop bridge unavailable");
      const res = await invoke("ctfExportHarbor", { taskId: task.id });
      if (res && !res.canceled && res.path) {
        setHarborSuccess(`Exported Harbor task ZIP to: ${res.path}`);
      }
    } catch (err: any) {
      alert(`Export failed: ${err?.message || String(err)}`);
    } finally {
      setHarborBusy(false);
    }
  };

  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-dls-surface">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-7/10 text-indigo-11">
          <Shield size={28} />
        </div>
        <h2 className="mt-4 text-[18px] font-semibold text-dls-text">
          No CTF Challenge Selected
        </h2>
        <p className="mt-1.5 max-w-sm text-[13px] text-dls-secondary">
          Select a challenge from the left sidebar to inspect details, choose an AI model, run the CTF agent, and export Harbor tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-dls-surface">
      {/* Top Header / Control Bar */}
      <header className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-dls-border bg-dls-surface px-5 py-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold text-dls-text">
                {task.title}
              </h1>
              <span className="rounded-md bg-gray-3 px-2 py-0.5 text-[11px] font-medium uppercase text-gray-11">
                {task.category || "web"}
              </span>
              {isSolved ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-7/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-11">
                  <CheckCircle2 size={12} />
                  Solved
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-3 text-[12px] text-dls-secondary">
              <span className="font-mono">Target: localhost:{task.backendPort}{task.sitePath}</span>
              <span>·</span>
              <span className="font-mono truncate max-w-[200px]">{task.image}</span>
            </div>
          </div>
        </div>

        {/* Controls: Model, Max Steps, Run Action */}
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <div className="flex items-center gap-1.5">
            <Cpu size={14} className="text-gray-10" />
            <select
              className="h-8 rounded-lg border border-dls-border bg-dls-hover px-2 text-[12px] font-medium text-dls-text focus:outline-none focus:ring-1 focus:ring-indigo-7"
              value={selectedModelPreset}
              onChange={(e) => setSelectedModelPreset(e.target.value)}
              disabled={isRunning}
            >
              {PRESET_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            {selectedModelPreset === "custom" ? (
              <input
                type="text"
                placeholder="e.g. anthropic/claude-3-5-sonnet"
                value={customModelText}
                onChange={(e) => setCustomModelText(e.target.value)}
                disabled={isRunning}
                className="h-8 w-44 rounded-lg border border-dls-border bg-dls-hover px-2 text-[12px] text-dls-text placeholder:text-gray-10 focus:outline-none focus:ring-1 focus:ring-indigo-7"
              />
            ) : null}
          </div>

          {/* Max Steps */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-dls-secondary">Steps:</span>
            <input
              type="number"
              min={5}
              max={100}
              value={maxSteps}
              onChange={(e) => setMaxSteps(Number(e.target.value) || 50)}
              disabled={isRunning}
              className="h-8 w-14 rounded-lg border border-dls-border bg-dls-hover px-1.5 text-center text-[12px] text-dls-text focus:outline-none"
            />
          </div>

          {/* Run Button */}
          {isRunning ? (
            <button
              type="button"
              onClick={handleStopTask}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-9 px-3 text-[12px] font-medium text-white transition-colors hover:bg-red-10"
            >
              <Square size={13} fill="currentColor" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunTask}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-9 px-3.5 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-indigo-10"
            >
              <Play size={13} fill="currentColor" />
              <span>Run Agent</span>
            </button>
          )}

          {/* Harbor Export Button */}
          <button
            type="button"
            onClick={handleExportHarbor}
            disabled={harborBusy || (!isSolved && steps.length === 0)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dls-border bg-dls-hover px-3 text-[12px] font-medium text-dls-text transition-colors hover:bg-gray-4 disabled:opacity-50"
            title="Export Harbor evaluation task archive"
          >
            {harborBusy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Archive size={13} />
            )}
            <span>Export Harbor</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 space-y-4">
        {/* Description Banner */}
        <div className="rounded-2xl border border-dls-border bg-dls-sidebar/50 p-4">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-dls-secondary mb-1">
            Challenge Description
          </div>
          <p className="text-[13px] leading-relaxed text-dls-text">
            {task.description || "No description provided for this challenge."}
          </p>
        </div>

        {/* Status / Notice */}
        {statusMessage ? (
          <div className="flex items-center gap-2 rounded-xl bg-indigo-7/10 p-3 text-[12px] text-indigo-11">
            {isRunning ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Sparkles size={14} />}
            <span className="truncate">{statusMessage}</span>
          </div>
        ) : null}

        {harborSuccess ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-7/30 bg-emerald-7/10 p-3 text-[12px] text-emerald-11">
            <CheckCircle2 size={14} className="shrink-0" />
            <span className="truncate">{harborSuccess}</span>
          </div>
        ) : null}

        {/* Solved Flag Banner */}
        {isSolved && solvedFlag ? (
          <div className="rounded-2xl border border-emerald-7/30 bg-emerald-7/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-7/20 text-emerald-11">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-emerald-11">
                    Challenge Solved · Verified Flag
                  </div>
                  <div className="font-mono text-[14px] font-bold text-emerald-12 mt-0.5">
                    {solvedFlag}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyFlag}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-7/30 bg-emerald-7/20 px-3 py-1.5 text-[12px] font-medium text-emerald-11 transition-colors hover:bg-emerald-7/30"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? "Copied" : "Copy Flag"}</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* View Tabs */}
        <div className="flex items-center justify-between border-b border-dls-border pb-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("timeline")}
              className={`rounded-lg px-3 py-1 text-[12px] font-medium transition-colors ${
                activeTab === "timeline"
                  ? "bg-gray-3 text-dls-text"
                  : "text-dls-secondary hover:text-dls-text"
              }`}
            >
              Agent Execution Steps ({steps.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("raw")}
              className={`rounded-lg px-3 py-1 text-[12px] font-medium transition-colors ${
                activeTab === "raw"
                  ? "bg-gray-3 text-dls-text"
                  : "text-dls-secondary hover:text-dls-text"
              }`}
            >
              Raw Trajectory JSON
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("harbor")}
              className={`rounded-lg px-3 py-1 text-[12px] font-medium transition-colors ${
                activeTab === "harbor"
                  ? "bg-gray-3 text-dls-text"
                  : "text-dls-secondary hover:text-dls-text"
              }`}
            >
              Harbor Export Spec
            </button>
          </div>

          {steps.length > 0 ? (
            <span className="text-[11px] text-dls-secondary">
              Total Turns: {steps.length}
            </span>
          ) : null}
        </div>

        {/* Tab Content */}
        {activeTab === "timeline" ? (
          <div className="space-y-3 pb-6">
            {steps.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-dls-border p-10 text-center">
                <Terminal size={24} className="mx-auto text-gray-10" />
                <h3 className="mt-3 text-[14px] font-medium text-dls-text">
                  No Execution Steps Yet
                </h3>
                <p className="mt-1 text-[12px] text-dls-secondary">
                  Click <strong>Run Agent</strong> above to start solving this challenge with your selected model.
                </p>
              </div>
            ) : (
              steps.map((s, idx) => (
                <div
                  key={s.number || idx}
                  className="rounded-2xl border border-dls-border bg-dls-surface p-4 shadow-sm space-y-2.5 transition-all"
                >
                  {/* Step Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-7/15 text-[11px] font-bold text-indigo-11">
                        {s.number || idx + 1}
                      </span>
                      <span className="rounded bg-gray-3 px-2 py-0.5 text-[11px] font-medium uppercase text-gray-11">
                        Tool: {s.tool}
                      </span>
                      {s.action?.action ? (
                        <span className="rounded bg-sky-7/15 px-2 py-0.5 text-[11px] font-medium font-mono text-sky-11">
                          {s.action.action}
                          {s.action.value ? ` (${s.action.value.slice(0, 32)})` : ""}
                        </span>
                      ) : null}
                      {s.tool === "submit" && s.action?.flag ? (
                        <span className="rounded bg-emerald-7/15 px-2 py-0.5 text-[11px] font-medium font-mono text-emerald-11">
                          submit flag="{s.action.flag}"
                        </span>
                      ) : null}
                    </div>

                    {s.durationMs ? (
                      <span className="flex items-center gap-1 text-[11px] text-dls-secondary">
                        <Clock size={11} />
                        {(s.durationMs / 1000).toFixed(1)}s
                      </span>
                    ) : null}
                  </div>

                  {/* Thought */}
                  {s.thought ? (
                    <div className="rounded-xl bg-dls-hover/70 p-3 text-[13px] text-dls-text italic leading-relaxed">
                      💭 {s.thought}
                    </div>
                  ) : null}

                  {/* Observation */}
                  {s.observation ? (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-dls-secondary mb-1">
                        Environment Observation:
                      </div>
                      <pre className="max-h-48 overflow-y-auto rounded-xl border border-dls-border bg-gray-2/60 p-3 font-mono text-[11px] leading-relaxed text-gray-12 whitespace-pre-wrap break-all">
                        {typeof s.observation === "string"
                          ? s.observation
                          : JSON.stringify(s.observation, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ))
            )}
            <div ref={stepsEndRef} />
          </div>
        ) : activeTab === "raw" ? (
          <div className="rounded-2xl border border-dls-border bg-gray-2/60 p-4">
            <pre className="max-h-[500px] overflow-auto font-mono text-[12px] leading-relaxed text-gray-12">
              {rawTrajectory
                ? JSON.stringify(rawTrajectory, null, 2)
                : "No trajectory data captured yet."}
            </pre>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-dls-border bg-dls-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-dls-text">
                  Harbor Framework v1.4 Specification
                </h3>
                <p className="text-[12px] text-dls-secondary">
                  Export this challenge and trajectory into an isolated Harbor evaluation task with automated verification.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportHarbor}
                disabled={harborBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-9 px-3.5 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-indigo-10"
              >
                <Download size={13} />
                <span>Download .ZIP</span>
              </button>
            </div>

            <div className="rounded-xl border border-dls-border bg-gray-2/40 p-3 font-mono text-[12px] space-y-2">
              <div className="text-[11px] font-bold text-gray-11">Generated Harbor Archive Contents:</div>
              <ul className="list-disc pl-5 text-[11px] text-dls-secondary space-y-1">
                <li><code>task.toml</code> — Task metadata, timeouts, and category tags</li>
                <li><code>instruction.md</code> — Prompt given to the agent</li>
                <li><code>environment/Dockerfile</code> — Sandboxed runtime</li>
                <li><code>tests/test.sh</code> — Verification script (writes to /logs/verifier/reward.txt)</li>
                <li><code>solution/solve.sh</code> — Oracle solution script</li>
                <li><code>logs/agent/trajectory.json</code> — ATIF v1.8 Agent Trajectory</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
