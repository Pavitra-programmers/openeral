import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  datasourceHashForMarker,
  initMarkerMatches,
  type InitMarkerOptions,
  writeInitMarker,
} from './init-marker.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeMarkerOptions(workspaceId = 'marker-ws'): InitMarkerOptions {
  const dir = mkdtempSync(join(tmpdir(), 'openeral-init-marker-'));
  tempDirs.push(dir);
  return {
    env: Object.create(null) as NodeJS.ProcessEnv,
    workspaceId,
    dataDir: join(dir, 'data'),
    dbUrlFile: join(dir, 'database-url'),
    markerPath: join(dir, 'init.done'),
  };
}

describe('init marker', () => {
  it('matches a marker written for the same workspace and datasource', () => {
    const opts = makeMarkerOptions();
    writeFileSync(opts.dbUrlFile!, 'postgresql://user:pass@example.com/db');
    writeInitMarker(opts);

    expect(initMarkerMatches(opts)).toBe(true);
  });

  it('does not match when the workspace changes', () => {
    const opts = makeMarkerOptions('first-workspace');
    writeInitMarker(opts);

    expect(initMarkerMatches({ ...opts, workspaceId: 'second-workspace' })).toBe(false);
  });

  it('does not match when the datasource changes', () => {
    const opts = makeMarkerOptions();
    writeFileSync(opts.dbUrlFile!, 'postgresql://user:pass@example.com/first');
    writeInitMarker(opts);

    writeFileSync(opts.dbUrlFile!, 'postgresql://user:pass@example.com/second');
    expect(initMarkerMatches(opts)).toBe(false);
  });

  it('does not match a corrupt marker', () => {
    const opts = makeMarkerOptions();
    writeFileSync(opts.markerPath!, '{not-json');

    expect(initMarkerMatches(opts)).toBe(false);
  });

  it('does not match a missing marker', () => {
    expect(initMarkerMatches(makeMarkerOptions())).toBe(false);
  });

  it('uses the same datasource hash for explicit databaseUrl and stored db-url file', () => {
    const opts = makeMarkerOptions();
    const databaseUrl = 'postgresql://user:pass@example.com/same';
    writeFileSync(opts.dbUrlFile!, databaseUrl);

    expect(datasourceHashForMarker(opts)).toBe(datasourceHashForMarker({
      ...opts,
      databaseUrl,
    }));
  });
});
