/** @jsxImportSource react */
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  FolderPlus,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";

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
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of props.tasks) {
      if (t.category) set.add(t.category.toLowerCase());
    }
    return ["all", ...Array.from(set)];
  }, [props.tasks]);

  const filteredTasks = useMemo(() => {
    return props.tasks.filter((t) => {
      const matchSearch =
        !search ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());
      const matchCat =
        selectedCategory === "all" ||
        (t.category && t.category.toLowerCase() === selectedCategory);
      return matchSearch && matchCat;
    });
  }, [props.tasks, search, selectedCategory]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-dls-sidebar">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-dls-border px-3.5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-7/10 text-indigo-11">
            <Shield size={14} />
          </div>
          <span className="text-[13px] font-semibold text-dls-text">
            CTF Challenges
          </span>
          <span className="rounded-full bg-gray-3 px-1.5 py-0.5 text-[11px] font-medium text-gray-11">
            {props.tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={props.onRefresh}
            disabled={props.loading}
            className="flex h-7 w-7 items-center justify-center rounded-md text-dls-secondary transition-colors hover:bg-dls-hover hover:text-dls-text disabled:opacity-50"
            title="Refresh challenges"
          >
            <RefreshCw size={13} className={props.loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={props.onOpenImport}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-indigo-7/15 px-2 text-[12px] font-medium text-indigo-11 transition-colors hover:bg-indigo-7/25"
            title="Import CTF challenge folder"
          >
            <FolderPlus size={13} />
            <span>Import</span>
          </button>
        </div>
      </div>

      {/* Search & Category filter */}
      <div className="shrink-0 space-y-2 border-b border-dls-border p-2.5">
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-10"
          />
          <input
            type="text"
            placeholder="Search challenges..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-dls-border bg-dls-surface py-1.5 pl-8 pr-2.5 text-[12px] text-dls-text placeholder:text-gray-10 focus:outline-none focus:ring-1 focus:ring-indigo-7"
          />
        </div>

        {categories.length > 2 ? (
          <div className="flex flex-wrap gap-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase transition-colors ${
                  selectedCategory === cat
                    ? "bg-gray-4 text-gray-12"
                    : "text-gray-10 hover:bg-gray-2 hover:text-gray-12"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Challenge list */}
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5 space-y-1">
        {filteredTasks.length === 0 ? (
          <div className="px-3 py-8 text-center text-[12px] text-dls-secondary">
            No CTF challenges found.
          </div>
        ) : (
          filteredTasks.map((t) => {
            const isSelected = props.selectedTaskId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => props.onSelectTask(t)}
                className={`w-full rounded-xl p-2.5 text-left transition-all ${
                  isSelected
                    ? "bg-indigo-7/10 border border-indigo-7/30 shadow-sm"
                    : "border border-transparent hover:bg-dls-hover hover:border-dls-border"
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-dls-text">
                        {t.title}
                      </span>
                      {t.isCustom ? (
                        <span className="rounded bg-sky-7/15 px-1 py-0.2 text-[10px] font-medium text-sky-11 uppercase">
                          Custom
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-dls-secondary font-mono">
                      {t.id} · Port {t.backendPort}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded bg-gray-3/80 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-11">
                      {t.category || "web"}
                    </span>
                    {t.solved ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-11"
                        title="Solved"
                      >
                        <CheckCircle2 size={11} />
                        Solved
                      </span>
                    ) : t.hasTrace ? (
                      <span className="text-[10px] text-dls-secondary">
                        Trace ready
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
