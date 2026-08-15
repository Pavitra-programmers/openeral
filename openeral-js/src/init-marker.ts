import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const INIT_MARKER_VERSION = 1;

export interface InitMarker {
  version: number;
  workspaceId: string;
  datasourceHash: string;
  completedAt: string;
}

export interface InitMarkerOptions {
  env?: NodeJS.ProcessEnv;
  workspaceId?: string;
  stateDir?: string;
  dataDir?: string;
  dbUrlFile?: string;
  markerPath?: string;
  databaseUrl?: string;
}

function envOf(opts: InitMarkerOptions): NodeJS.ProcessEnv {
  return opts.env ?? process.env;
}

export function workspaceIdForMarker(opts: InitMarkerOptions = {}): string {
  const env = envOf(opts);
  return opts.workspaceId
    || env.OPENRIND_SHELL_WORKSPACE_ID
    || env.OPENERAL_WORKSPACE_ID
    || env.WORKSPACE_ID
    || env.OPENSHELL_SANDBOX_ID
    || 'default';
}

export function stateDirForMarker(opts: InitMarkerOptions = {}): string {
  const env = envOf(opts);
  return opts.stateDir
    || env.OPENRIND_SHELL_STATE_DIR
    || env.OPENERAL_STATE_DIR
    || '/tmp/openrind-shell';
}

export function dataDirForMarker(opts: InitMarkerOptions = {}): string {
  const env = envOf(opts);
  return opts.dataDir
    || env.OPENRIND_SHELL_DATA_DIR
    || env.OPENERAL_DATA_DIR
    || '/tmp/openrind-shell/data';
}

export function dbUrlFileForMarker(opts: InitMarkerOptions = {}): string {
  const env = envOf(opts);
  return opts.dbUrlFile
    || env.OPENRIND_SHELL_DB_URL_FILE
    || env.OPENERAL_DB_URL_FILE
    || join(stateDirForMarker(opts), 'database-url');
}

export function initMarkerPath(opts: InitMarkerOptions = {}): string {
  const env = envOf(opts);
  return opts.markerPath
    || env.OPENRIND_SHELL_INIT_MARKER
    || env.OPENERAL_INIT_MARKER
    || join(stateDirForMarker(opts), 'init.done');
}

export function storedDatabaseUrlForMarker(opts: InitMarkerOptions = {}): string {
  const env = envOf(opts);
  if (opts.databaseUrl !== undefined) return opts.databaseUrl;
  if (env.DATABASE_URL) return env.DATABASE_URL;

  const dbFile = dbUrlFileForMarker(opts);
  if (!existsSync(dbFile)) return '';
  try {
    return readFileSync(dbFile, 'utf8').trim();
  } catch {
    return '';
  }
}

export function datasourceForMarker(opts: InitMarkerOptions = {}): string {
  const dbUrl = storedDatabaseUrlForMarker(opts);
  return dbUrl ? `postgres:${dbUrl}` : `pglite:${dataDirForMarker(opts)}`;
}

export function datasourceHashForMarker(opts: InitMarkerOptions = {}): string {
  return createHash('sha256').update(datasourceForMarker(opts)).digest('hex');
}

export function readInitMarker(opts: InitMarkerOptions = {}): InitMarker | null {
  const marker = initMarkerPath(opts);
  if (!existsSync(marker)) return null;
  try {
    const data = JSON.parse(readFileSync(marker, 'utf8')) as Partial<InitMarker>;
    if (!data || typeof data !== 'object') return null;
    if (typeof data.version !== 'number') return null;
    if (typeof data.workspaceId !== 'string') return null;
    if (typeof data.datasourceHash !== 'string') return null;
    if (typeof data.completedAt !== 'string') return null;
    return data as InitMarker;
  } catch {
    return null;
  }
}

export function initMarkerMatches(opts: InitMarkerOptions = {}): boolean {
  const marker = readInitMarker(opts);
  if (!marker) return false;
  return marker.version === INIT_MARKER_VERSION
    && marker.workspaceId === workspaceIdForMarker(opts)
    && marker.datasourceHash === datasourceHashForMarker(opts);
}

export function buildInitMarker(opts: InitMarkerOptions = {}): InitMarker {
  return {
    version: INIT_MARKER_VERSION,
    workspaceId: workspaceIdForMarker(opts),
    datasourceHash: datasourceHashForMarker(opts),
    completedAt: new Date().toISOString(),
  };
}

export function writeInitMarker(opts: InitMarkerOptions = {}): InitMarker {
  const marker = buildInitMarker(opts);
  const markerPath = initMarkerPath(opts);
  mkdirSync(dirname(markerPath), { recursive: true });
  writeFileSync(markerPath, JSON.stringify(marker, null, 2), { mode: 0o600 });
  return marker;
}
