/** @jsxImportSource react */
import { useState } from "react";
import { Folder, FolderOpen, Loader2, Shield, X } from "lucide-react";

import {
  inputClass,
  inputLabelClass,
  modalBodyClass,
  modalFooterClass,
  modalHeaderButtonClass,
  modalHeaderClass,
  modalOverlayClass,
  modalShellClass,
  modalSubtitleClass,
  modalTitleClass,
} from "../workspace/modal-styles";

export type ImportTaskModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (task: any) => void;
};

export function ImportTaskModal(props: ImportTaskModalProps) {
  const [folderPath, setFolderPath] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("web");
  const [backendPort, setBackendPort] = useState(8080);
  const [flag, setFlag] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!props.open) return null;

  const handleBrowseFolder = async () => {
    setError(null);
    try {
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (!invoke) return;
      const res = await invoke("ctfSelectFolder");
      if (res && !res.canceled && res.path) {
        setFolderPath(res.path);
        if (!name) {
          const folderName = res.path.split(/[\\/]/).pop() || "";
          setName(folderName);
        }
      }
    } catch (err: any) {
      setError(err?.message || "Failed to select folder.");
    }
  };

  const handleImportAndBuild = async () => {
    if (!folderPath) {
      setError("Please select a challenge folder.");
      return;
    }
    setError(null);
    setBusy(true);
    setStatusMessage("Importing challenge configuration...");

    try {
      const invoke = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.invokeDesktop;
      if (!invoke) throw new Error("Desktop bridge unavailable");

      const imported = await invoke("ctfImportTask", {
        folderPath,
        name: name || undefined,
        category,
        backendPort,
        flag: flag || undefined,
        description: description || undefined,
      });

      setStatusMessage("Building Dockerfile for environment...");

      // Listen for build status
      const unsubscribe = (window as any).__OPENRIND_DESKTOP_ELECTRON__?.ctf?.onStatus?.(
        (data: any) => {
          if (data?.message) setStatusMessage(data.message);
        }
      );

      try {
        await invoke("ctfBuildImage", imported.id);
      } finally {
        unsubscribe?.();
      }

      props.onSuccess(imported);
      props.onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to import task.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={modalOverlayClass}>
      <div className={`${modalShellClass} max-w-[560px]`}>
        {/* Header */}
        <div className={modalHeaderClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-7/10 text-indigo-11">
              <Shield size={20} />
            </div>
            <div>
              <h2 className={modalTitleClass}>Import CTF Challenge</h2>
              <div className={modalSubtitleClass}>
                Load a challenge folder, auto-build its Docker environment, and register for CTF agent solving.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            disabled={busy}
            className={modalHeaderButtonClass}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={`${modalBodyClass} space-y-4`}>
          {error ? (
            <div className="rounded-xl border border-red-7/30 bg-red-7/10 p-3 text-[13px] text-red-11">
              {error}
            </div>
          ) : null}

          {/* Folder Path */}
          <div>
            <label className={`mb-1.5 block ${inputLabelClass}`}>Challenge Folder</label>
            <div className="flex gap-2">
              <input
                className={`${inputClass} flex-1 font-mono text-[12px]`}
                placeholder="C:\Users\...\ctf-challenge"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-dls-border bg-dls-hover px-3.5 text-[13px] font-medium text-dls-text transition-colors hover:bg-gray-4 disabled:opacity-50"
              >
                <FolderOpen size={15} />
                <span>Browse</span>
              </button>
            </div>
            <div className="mt-1 text-[11px] text-dls-secondary">
              Select a folder containing challenge files, <code>challenge.json</code>, or <code>DESCRIPTION.md</code>.
            </div>
          </div>

          {/* Name & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`mb-1.5 block ${inputLabelClass}`}>Challenge Name</label>
              <input
                className={inputClass}
                placeholder="my-challenge"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label className={`mb-1.5 block ${inputLabelClass}`}>Category</label>
              <select
                className={inputClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={busy}
              >
                <option value="web">Web</option>
                <option value="pwn">Pwn</option>
                <option value="crypto">Crypto</option>
                <option value="rev">Reverse</option>
                <option value="forensics">Forensics</option>
                <option value="misc">Misc</option>
              </select>
            </div>
          </div>

          {/* Port & Flag */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`mb-1.5 block ${inputLabelClass}`}>Target Port</label>
              <input
                type="number"
                className={inputClass}
                value={backendPort}
                onChange={(e) => setBackendPort(Number(e.target.value) || 8080)}
                disabled={busy}
              />
            </div>
            <div>
              <label className={`mb-1.5 block ${inputLabelClass}`}>Expected Flag (Optional)</label>
              <input
                className={inputClass}
                placeholder="CTF{flag_here}"
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={`mb-1.5 block ${inputLabelClass}`}>Prompt / Description</label>
            <textarea
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="All materials needed to solve the challenge are on this website..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
          </div>

          {busy && statusMessage ? (
            <div className="flex items-center gap-2 rounded-xl bg-indigo-7/10 p-3 text-[12px] text-indigo-11">
              <Loader2 size={15} className="animate-spin shrink-0" />
              <span className="truncate">{statusMessage}</span>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className={`${modalFooterClass} flex justify-end gap-2`}>
          <button
            type="button"
            onClick={props.onClose}
            disabled={busy}
            className="rounded-xl border border-dls-border px-4 py-2 text-[13px] font-medium text-dls-secondary hover:bg-dls-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImportAndBuild}
            disabled={busy || !folderPath}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-9 px-4 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-indigo-10 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            <span>{busy ? "Building & Importing..." : "Import & Build"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
