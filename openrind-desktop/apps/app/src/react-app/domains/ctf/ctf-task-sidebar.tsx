/** @jsxImportSource react */
import { useEffect, useMemo, useState } from "react";
import { Check, FolderOpen, Loader2, Plus, RefreshCw, X } from "lucide-react";

export type CtfTask = {
  id: string;
  title: string;
  description: string;
  category: string;
  backendPort: number;
  sitePath: string;
  image: string;
  flag?: string;
  hasTrace?: boolean;
  solved?: boolean;
  isCustom?: boolean;
  folderPath?: string;
  traceSummary?: {
    stepsCount: number;
    model: string | null;
    startedAt: string | null;
  } | null;
};

export type CtfTaskSidebarProps = {
  tasks: CtfTask[];
  selectedTaskId: string | null;
  onSelectTask: (task: CtfTask) => void;
  onOpenImport: () => void;
  onRefresh: () => void;
  loading?: boolean;
};

export function CtfTaskSidebar(props: CtfTaskSidebarProps) {
  const [search, setSearch] = useState("");
  const [activeDir, setActiveDir] = useState<string | null>(null);
  const [changingDir, setChangingDir] = useState(false);

  // Fetch current active directory on mount
  useEffect(() => {
    const loadDir = async () => {
      try {
        const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
        if (!invoke) return;
        const res = await invoke("ctfGetActiveDirectory");
        if (res?.path) setActiveDir(res.path);
        else setActiveDir(null);
      } catch {}
    };
    void loadDir();
  }, []);

  const handleChangeDirectory = async () => {
    try {
      setChangingDir(true);
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (!invoke) return;
      const folderRes = await invoke("ctfSelectFolder");
      if (folderRes && !folderRes.canceled && folderRes.path) {
        await invoke("ctfSetActiveDirectory", folderRes.path);
        setActiveDir(folderRes.path);
        props.onRefresh();
      }
    } catch {} finally {
      setChangingDir(false);
    }
  };

  const handleResetDirectory = async () => {
    try {
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (!invoke) return;
      await invoke("ctfSetActiveDirectory", null);
      setActiveDir(null);
      props.onRefresh();
    } catch {}
  };

  const filteredTasks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return props.tasks;
    return props.tasks.filter((t) => {
      return (
        t.title.toLowerCase().includes(needle) ||
        t.id.toLowerCase().includes(needle) ||
        (t.category && t.category.toLowerCase().includes(needle))
      );
    });
  }, [props.tasks, search]);

  const dirDisplayName = useMemo(() => {
    if (!activeDir) return "Default";
    const parts = activeDir.replace(/[\\/]+$/, "").split(/[\\/]/);
    return parts[parts.length - 1] || activeDir;
  }, [activeDir]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-dls-sidebar text-dls-text">
      {/* Workspace Directory Selector */}
      <div className="border-b border-dls-border px-3 py-2 bg-dls-hover/30">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-10 font-normal">Directory:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleChangeDirectory}
              disabled={changingDir}
              className="text-gray-11 hover:text-gray-12 underline transition-colors"
              title={activeDir || "Default built-in tasks"}
            >
              {dirDisplayName}
            </button>
            {activeDir ? (
              <button
                type="button"
                onClick={handleResetDirectory}
                className="text-gray-9 hover:text-gray-11 transition-colors ml-1"
                title="Reset to default directory"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-3 py-2.5 border-b border-dls-border">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-gray-12">
            Challenges
          </span>
          <span className="text-[11px] text-gray-10">
            ({props.tasks.length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={props.onRefresh}
            disabled={props.loading}
            className="flex h-6 w-6 items-center justify-center rounded text-gray-10 transition-colors hover:bg-gray-2 hover:text-gray-12 disabled:opacity-50"
            title="Refresh challenge list"
          >
            <RefreshCw size={12} className={props.loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={props.onOpenImport}
            className="rounded px-2 py-0.5 text-[11px] font-medium text-gray-11 hover:bg-gray-2 hover:text-gray-12 transition-colors"
          >
            + Import
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="px-2.5 py-2 border-b border-dls-border">
        <input
          type="text"
          placeholder="Filter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-dls-border bg-dls-surface px-2.5 py-1 text-[12px] text-dls-text placeholder:text-gray-9 focus:outline-none focus:border-gray-8"
        />
      </div>

      {/* Challenge List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-1 space-y-0.5">
        {filteredTasks.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-gray-10">
            No challenges found.
          </div>
        ) : (
          filteredTasks.map((t) => {
            const isSelected = props.selectedTaskId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => props.onSelectTask(t)}
                className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
                  isSelected
                    ? "bg-gray-3 text-gray-12 font-medium"
                    : "text-gray-10 hover:bg-gray-1/70 hover:text-gray-11 font-normal"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] leading-snug">
                    {t.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-gray-9 uppercase tracking-wider">
                    {t.category || "web"}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-9">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      t.solved
                        ? "bg-emerald-9"
                        : t.isCustom
                          ? "bg-blue-9"
                          : "bg-gray-7"
                    }`}
                  />
                  <span className="truncate">
                    {t.solved ? "Solved" : t.isCustom ? "Custom" : "Ready"}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
