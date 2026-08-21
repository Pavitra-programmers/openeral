import { describe, expect, it } from 'vitest';
import { isTransientConnectionError } from './embedded.js';

describe('external PostgreSQL connection retries', () => {
  it('retries an OpenShell SSH-relay disconnect during FUSE initialization', () => {
    expect(isTransientConnectionError(new Error('Connection terminated unexpectedly'))).toBe(true);
  });

  it('does not hide a non-transient database error', () => {
    expect(isTransientConnectionError(new Error('password authentication failed'))).toBe(false);
  });
});