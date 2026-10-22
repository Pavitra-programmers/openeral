/** @jsxImportSource react */
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Anchor,
  Archive,
  Check,
  ChevronDown,
  Copy,
  FileJson,
  Loader2,
  Play,
  Square,
  X,
} from "lucide-react";

import type { CtfTask } from "./ctf-task-sidebar";

const OPENROUTER_PRESETS = [
  { id: "minimax/minimax-m3.1-flash:free", label: "MiniMax M3.1 (Free)" },
  { id: "openrouter/free", label: "OpenRouter (Free)" },
  { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5 (Near-Free)" },
  { id: "qwen/qwen3-coder-flash", label: "Qwen Coder Flash (Near-Free)" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek V3 (Near-Free)" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet" },
  { id: "custom", label: "Custom..." },
];

const ANTHROPIC_PRESETS = [
  { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet" },
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
  { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
  { id: "custom", label: "Custom..." },
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

  const [providerType, setProviderType] = useState<"anthropic" | "openrouter">("openrouter");
  const [selectedModelPreset, setSelectedModelPreset] = useState("deepseek/deepseek-chat");
  const [customModelText, setCustomModelText] = useState("");
  const [maxSteps, setMaxSteps] = useState(50);

  const [isBuilding, setIsBuilding] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [steps, setSteps] = useState<CtfStep[]>([]);
  const [solvedFlag, setSolvedFlag] = useState<string | null>(null);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"steps" | "raw" | "harbor">("steps");
  const [rawTrajectory, setRawTrajectory] = useState<any | null>(null);
  const [harborBusy, setHarborBusy] = useState(false);
  const [harborNotice, setHarborNotice] = useState<string | null>(null);

  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [sellTracesModalOpen, setSellTracesModalOpen] = useState(false);
  const [sellTracesPreview, setSellTracesPreview] = useState<any | null>(null);
  const [scrubPii, setScrubPii] = useState(true);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const stepsEndRef = useRef<HTMLDivElement | null>(null);

  const activeModel =
    selectedModelPreset === "custom" && customModelText.trim()
      ? customModelText.trim()
      : selectedModelPreset;

  useEffect(() => {
    if (!task) return;
    setSteps([]);
    setSolvedFlag(null);
    setIsSolved(false);
    setRawTrajectory(null);
    setHarborNotice(null);
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
            setSolvedFlag(trace.judge?.submission || task.flag || "");
          }
        }
      } catch (err: any) {
        setStatusMessage(`Status: ${err?.message || String(err)}`);
      }
    };

    void loadTrace();

    const checkProvider = async () => {
      try {
        const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
        if (!invoke) return;
        const info = await invoke("ctfGetProviderInfo");
        if (info?.provider === "anthropic") {
          setProviderType("anthropic");
          setSelectedModelPreset((prev) => {
            if (prev.startsWith("claude-")) return prev;
            return "claude-3-7-sonnet-20250219";
          });
        } else {
          setProviderType("openrouter");
          setSelectedModelPreset((prev) => {
            if (prev.startsWith("claude-")) return "deepseek/deepseek-chat";
            return prev;
          });
        }
      } catch {}
    };
    void checkProvider();
  }, [task?.id]);

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
    setHarborNotice(null);
    setStatusMessage("Initializing challenge container...");

    try {
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (!invoke) throw new Error("Desktop bridge unavailable");

      await invoke("ctfRunTask", {
        taskId: task.id,
        model: activeModel,
        maxSteps,
      });
    } catch (err: any) {
      setStatusMessage(`Error: ${err?.message || String(err)}`);
      setIsRunning(false);
    }
  };

  const handleStopTask = async () => {
    try {
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (invoke) await invoke("ctfStopTask");
    } catch {}
    setIsRunning(false);
    setStatusMessage("Stopped by user.");
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    }
    if (exportDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [exportDropdownOpen]);

  const handleExportHarbor = async () => {
    if (!task) return;
    setHarborBusy(true);
    setHarborNotice(null);
    try {
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (!invoke) throw new Error("Desktop bridge unavailable");
      const res = await invoke("ctfExportHarbor", { taskId: task.id });
      if (res && !res.canceled && res.path) {
        setHarborNotice(`Saved Harbor task archive to ${res.path}`);
      }
    } catch (err: any) {
      alert(`Export failed: ${err?.message || String(err)}`);
    } finally {
      setHarborBusy(false);
    }
  };

  const handleExportTracePack = async () => {
    if (!task) return;
    setExportDropdownOpen(false);
    setExportBusy(true);
    setHarborNotice(null);
    try {
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (!invoke) throw new Error("Desktop bridge unavailable");
      const res = await invoke("ctfExportTracePack", { taskId: task.id });
      if (res && !res.canceled && res.path) {
        setHarborNotice(`Saved TracePack archive to ${res.path}`);
      }
    } catch (err: any) {
      alert(`TracePack export failed: ${err?.message || String(err)}`);
    } finally {
      setExportBusy(false);
    }
  };

  const handleOpenSellTracesModal = async () => {
    if (!task) return;
    setExportDropdownOpen(false);
    setExportBusy(true);
    try {
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (!invoke) throw new Error("Desktop bridge unavailable");
      const res = await invoke("ctfGetSellTracesPreview", { taskId: task.id });
      setSellTracesPreview(res);
      setSellTracesModalOpen(true);
    } catch (err: any) {
      alert(`Failed to prepare SellTraces projection: ${err?.message || String(err)}`);
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportSellTraces = async () => {
    if (!task) return;
    setExportBusy(true);
    try {
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (!invoke) throw new Error("Desktop bridge unavailable");
      const res = await invoke("ctfExportSellTraces", { taskId: task.id, scrubPii });
      if (res && !res.canceled && res.path) {
        setSellTracesModalOpen(false);
        setHarborNotice(`Saved SellTraces JSON to ${res.path} and report to ${res.reportPath}`);
      }
    } catch (err: any) {
      alert(`SellTraces export failed: ${err?.message || String(err)}`);
    } finally {
      setExportBusy(false);
    }
  };

  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-dls-secondary bg-dls-surface">
        <div className="text-sm font-medium text-dls-text">No challenge selected</div>
        <div className="mt-1 text-xs text-gray-10">Select a challenge from the sidebar to inspect and run.</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-dls-surface text-dls-text">
      {/* Top Header */}
      <header className="z-10 flex shrink-0 items-center justify-between border-b border-dls-border px-5 py-3 bg-dls-surface">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold text-gray-12">
              {task.title}
            </h1>
            <span className="rounded bg-gray-3 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-10">
              {task.category || "web"}
            </span>
            {isSolved ? (
              <span className="rounded-full bg-emerald-9/15 px-2 py-0.5 text-[11px] font-medium text-emerald-11">
                Solved
              </span>
            ) : null}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Model Selector */}
          <div className="flex items-center gap-1">
            <select
              className="h-8 rounded-lg border border-dls-border bg-dls-hover px-2 text-[12px] text-gray-12 focus:outline-none"
              value={selectedModelPreset}
              onChange={(e) => setSelectedModelPreset(e.target.value)}
              disabled={isRunning}
            >
              {(providerType === "anthropic" ? ANTHROPIC_PRESETS : OPENROUTER_PRESETS).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            {selectedModelPreset === "custom" ? (
              <input
                type="text"
                placeholder="Model ID..."
                value={customModelText}
                onChange={(e) => setCustomModelText(e.target.value)}
                disabled={isRunning}
                className="h-8 w-36 rounded-lg border border-dls-border bg-dls-hover px-2 text-[12px] text-gray-12 focus:outline-none"
              />
            ) : null}
          </div>

          {/* Steps */}
          <div className="flex items-center gap-1 text-[12px] text-gray-10">
            <span>Steps:</span>
            <input
              type="number"
              min={5}
              max={100}
              value={maxSteps}
              onChange={(e) => setMaxSteps(Number(e.target.value) || 50)}
              disabled={isRunning}
              className="h-8 w-12 rounded-lg border border-dls-border bg-dls-hover text-center text-[12px] text-gray-12 focus:outline-none"
            />
          </div>

          {/* Run Action */}
          {isRunning ? (
            <button
              type="button"
              onClick={handleStopTask}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-9 px-3 text-[12px] font-medium text-white transition-colors hover:bg-red-10"
            >
              <Square size={12} fill="currentColor" />
              <span>Stop</span>
            </button>
          ) : isBuilding ? (
            <button
              type="button"
              disabled
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-9/80 px-3.5 text-[12px] font-medium text-white shadow-sm cursor-wait"
            >
              <Loader2 size={12} className="animate-spin" />
              <span>Building Image...</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunTask}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-9 px-3.5 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-indigo-10"
            >
              <Play size={12} fill="currentColor" />
              <span>Run Agent</span>
            </button>
          )}

          {/* Unified Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportDropdownOpen((prev) => !prev)}
              disabled={exportBusy || harborBusy || (!isSolved && steps.length === 0)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dls-border bg-dls-hover px-3 text-[12px] font-medium text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12 disabled:opacity-40"
            >
              {exportBusy || harborBusy ? <Loader2 size={12} className="animate-spin" /> : null}
              <span>Export</span>
              <ChevronDown size={12} className="text-gray-10" />
            </button>

            {exportDropdownOpen ? (
              <div className="absolute right-0 top-full mt-1.5 w-68 rounded-[18px] border border-dls-border bg-dls-surface p-1.5 shadow-[var(--dls-shell-shadow)] z-50 text-[12px] animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={handleExportTracePack}
                  className="w-full flex items-start gap-2.5 rounded-[12px] p-2 text-left hover:bg-dls-hover transition-colors text-dls-text"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-dls-border bg-dls-hover text-indigo-11">
                    <Archive size={14} />
                  </div>
                  <div>
                    <div className="font-medium text-dls-text">TracePack (.zip)</div>
                    <div className="text-[11px] text-dls-secondary leading-tight mt-0.5">Canonical lossless archive with OTLP and artifacts</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleOpenSellTracesModal}
                  className="w-full flex items-start gap-2.5 rounded-[12px] p-2 text-left hover:bg-dls-hover transition-colors text-dls-text mt-0.5"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-dls-border bg-dls-hover text-amber-11">
                    <FileJson size={14} />
                  </div>
                  <div>
                    <div className="font-medium text-dls-text">SellTraces JSON (.json)</div>
                    <div className="text-[11px] text-dls-secondary leading-tight mt-0.5">Normalized conversation projection with audit report</div>
                  </div>
                </button>

                <div className="my-1 border-t border-dls-border/60" />

                <button
                  type="button"
                  onClick={() => {
                    setExportDropdownOpen(false);
                    void handleExportHarbor();
                  }}
                  className="w-full flex items-start gap-2.5 rounded-[12px] p-2 text-left hover:bg-dls-hover transition-colors text-dls-text"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-dls-border bg-dls-hover text-emerald-11">
                    <Anchor size={14} />
                  </div>
                  <div>
                    <div className="font-medium text-dls-text">Harbor Task (.zip)</div>
                    <div className="text-[11px] text-dls-secondary leading-tight mt-0.5">Benchmark evaluation task package</div>
                  </div>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Surface */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4 space-y-4">
        {/* Description */}
        <div className="rounded-xl border border-dls-border bg-dls-hover/30 p-3.5">
          <div className="text-[11px] font-medium text-gray-10 mb-1">
            Description
          </div>
          <div className="text-[13px] leading-relaxed text-gray-12">
            {task.description || "No description provided."}
          </div>
        </div>

        {/* Status / Notices */}
        {statusMessage ? (
          <div className="flex items-center gap-2 rounded-lg border border-dls-border bg-dls-hover px-3 py-2 text-[12px] text-gray-11">
            {isRunning ? <Loader2 size={13} className="animate-spin shrink-0 text-gray-10" /> : null}
            <span>{statusMessage}</span>
          </div>
        ) : null}

        {harborNotice ? (
          <div className="rounded-lg border border-dls-border bg-dls-hover px-3 py-2 text-[12px] text-gray-11">
            {harborNotice}
          </div>
        ) : null}

        {/* View Tabs */}
        <div className="flex items-center justify-between border-b border-dls-border pt-1 pb-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("steps")}
              className={`text-[12px] font-medium pb-1 transition-colors ${
                activeTab === "steps"
                  ? "text-gray-12 border-b-2 border-gray-12"
                  : "text-gray-10 hover:text-gray-12"
              }`}
            >
              Execution Steps ({steps.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("raw")}
              className={`text-[12px] font-medium pb-1 transition-colors ${
                activeTab === "raw"
                  ? "text-gray-12 border-b-2 border-gray-12"
                  : "text-gray-10 hover:text-gray-12"
              }`}
            >
              Raw Trajectory JSON
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("harbor")}
              className={`text-[12px] font-medium pb-1 transition-colors ${
                activeTab === "harbor"
                  ? "text-gray-12 border-b-2 border-gray-12"
                  : "text-gray-10 hover:text-gray-12"
              }`}
            >
              Harbor Specification
            </button>
          </div>

          {steps.length > 0 ? (
            <span className="text-[11px] text-gray-10">
              {steps.length} turns
            </span>
          ) : null}
        </div>

        {/* Content */}
        {activeTab === "steps" ? (
          <div className="space-y-2.5 pb-8">
            {steps.length === 0 ? (
              <div className="py-12 text-center text-[12px] text-gray-10">
                No execution steps yet. Click <strong>Run Agent</strong> to begin solving.
              </div>
            ) : (
              steps.map((s, idx) => (
                <div
                  key={s.number || idx}
                  className="rounded-xl border border-dls-border bg-dls-surface p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-10">
                        Turn {String(s.number || idx + 1).padStart(2, "0")}
                      </span>
                      <span className="rounded bg-gray-3 px-1.5 py-0.5 text-gray-11 font-mono text-[10px]">
                        {s.tool}
                      </span>
                      {s.action?.action ? (
                        <span className="font-mono text-gray-10 text-[11px]">
                          {s.action.action}
                          {s.action.value ? ` (${s.action.value.slice(0, 40)})` : ""}
                        </span>
                      ) : null}
                      {s.tool === "submit" && s.action?.flag ? (
                        <span className="font-mono text-emerald-11 text-[11px]">
                          submit flag="{s.action.flag}"
                        </span>
                      ) : null}
                    </div>

                    {s.durationMs ? (
                      <span className="font-mono text-gray-10 text-[11px]">
                        {(s.durationMs / 1000).toFixed(1)}s
                      </span>
                    ) : null}
                  </div>

                  {s.thought ? (
                    <div className="text-[12px] text-gray-11 leading-relaxed">
                      {s.thought}
                    </div>
                  ) : null}

                  {s.observation ? (
                    <div className="mt-1">
                      <pre className="max-h-40 overflow-y-auto rounded-lg border border-dls-border bg-dls-hover/40 p-2.5 font-mono text-[11px] leading-relaxed text-gray-12 whitespace-pre-wrap break-all">
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
          <div className="rounded-xl border border-dls-border bg-dls-hover/40 p-3">
            <pre className="max-h-125 overflow-auto font-mono text-[11px] leading-relaxed text-gray-12">
              {rawTrajectory
                ? JSON.stringify(rawTrajectory, null, 2)
                : "No trajectory data recorded yet."}
            </pre>
          </div>
        ) : (
          <div className="rounded-xl border border-dls-border bg-dls-hover/30 p-4 space-y-3">
            <div className="text-[13px] font-medium text-gray-12">
              Harbor v1.4 Evaluation Task
            </div>
            <p className="text-[12px] text-gray-10 leading-relaxed">
              Generates an isolated Harbor task package with task.toml, instruction.md, Dockerfile, test.sh reward verifier, solve.sh oracle solution, and ATIF v1.8 trajectory.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleExportHarbor}
                disabled={harborBusy}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dls-border bg-dls-hover px-3 text-[12px] font-medium text-gray-12 hover:bg-gray-3 transition-colors"
              >
                {harborBusy ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>Download Harbor Package (.zip)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SellTraces Export & Projection Modal */}
      {sellTracesModalOpen && sellTracesPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] border border-dls-border bg-dls-surface shadow-[var(--dls-shell-shadow)] text-dls-text">
            <div className="flex items-center justify-between border-b border-dls-border px-6 py-4.5">
              <div>
                <h3 className="text-[16px] font-semibold tracking-[-0.2px] text-dls-text">Export SellTraces Projection</h3>
                <p className="text-[12px] text-dls-secondary mt-0.5">Normalized conversation view with companion projection audit report.</p>
              </div>
              <button
                type="button"
                onClick={() => setSellTracesModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-dls-secondary hover:bg-dls-hover hover:text-dls-text transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="rounded-[18px] border border-dls-border bg-dls-hover/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-dls-text text-[13px]">Capture Integrity</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    sellTracesPreview.report?.capture_complete
                      ? "bg-emerald-9/15 text-emerald-11 border border-emerald-9/30"
                      : "bg-amber-9/15 text-amber-11 border border-amber-9/30"
                  }`}>
                    {sellTracesPreview.report?.capture_complete ? "Sealed Capture" : "Incomplete Capture"}
                  </span>
                </div>
                <div className="text-dls-secondary text-[12px]">
                  Task: <span className="text-dls-text font-medium">{task.title || task.id}</span> · Messages: <span className="font-mono text-dls-text">{sellTracesPreview.preview?.messages?.length ?? 0}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[12px] font-medium text-dls-text">Projection Contract:</div>
                <ul className="space-y-1.5 text-dls-secondary text-[12px] list-disc list-inside rounded-[18px] border border-dls-border bg-dls-surface p-3.5 leading-relaxed">
                  <li>Assistant JSON preserved verbatim as message content without synthesizing fake tool calls.</li>
                  <li>Browser CDP operations and DOM snapshots omitted from conversation view (retained in TracePack).</li>
                  <li>Companion <code className="text-indigo-11 font-mono text-[11px]">*-projection-report.json</code> written alongside export.</li>
                </ul>
              </div>

              {sellTracesPreview.piiFindings && sellTracesPreview.piiFindings.length > 0 ? (
                <div className="rounded-[18px] border border-amber-9/30 bg-amber-9/10 p-3.5 text-[12px] text-amber-12 space-y-1">
                  <div className="font-medium flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-11 shrink-0" />
                    <span>Sensitive Credentials Found:</span>
                  </div>
                  <div className="text-[11px] text-amber-11/90 font-mono">
                    {sellTracesPreview.piiFindings.map((f: any) => `${f.type}: ${f.count}`).join(", ")}
                  </div>
                </div>
              ) : null}

              <label className="flex items-start gap-2.5 cursor-pointer pt-1 select-none">
                <input
                  type="checkbox"
                  checked={scrubPii}
                  onChange={(e) => setScrubPii(e.target.checked)}
                  className="mt-0.5 rounded border-dls-border text-dls-accent focus:ring-0"
                />
                <div>
                  <div className="text-[12px] font-medium text-dls-text">Redact credentials and secrets</div>
                  <div className="text-[11px] text-dls-secondary">Masks API keys and bearer tokens in exported messages</div>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-dls-border px-6 py-4 bg-dls-surface">
              <button
                type="button"
                onClick={() => setSellTracesModalOpen(false)}
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-[13px] font-medium border border-dls-border bg-dls-surface text-dls-text hover:bg-dls-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportSellTraces}
                disabled={exportBusy}
                className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium bg-dls-accent text-white hover:bg-[var(--dls-accent-hover)] transition-colors shadow-sm disabled:opacity-50"
              >
                {exportBusy ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>Export Projection & Report</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
