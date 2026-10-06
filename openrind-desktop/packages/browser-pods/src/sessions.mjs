import { randomBytes, randomUUID } from 'node:crypto';
import { PodError, canonical, deadline, digest, requireThat, sameOwner, validateOwner } from './contracts.mjs';

export class BrowserSessions {
  constructor({ registry, runtime, prepareAttachment, clock = Date.now, createTimeoutMs = 60_000,
    stopTimeoutMs = 1800, ownerLimit = 2, brokerLimit = 8, cleanupRetryMs = 1000 }) {
    this.registry = registry; this.runtime = runtime; this.prepareAttachment = prepareAttachment;
    this.clock = clock; this.createTimeoutMs = createTimeoutMs; this.stopTimeoutMs = stopTimeoutMs;
    this.ownerLimit = ownerLimit; this.brokerLimit = brokerLimit; this.generation = randomUUID();
    this.allocations = new Map(); this.cleanup = new Map(); this.streams = new Map();
    this.transfers = new Map();
    this.stopWaiters = new Map(); this.cleanupRetryMs = cleanupRetryMs; this.lastPrune = 0;
    this.ready = false;
  }

  async recover() {
    // A broker restart ends old generations. It never resumes old attachment URLs.
    const oldSessions = this.registry.active();
    for (const old of oldSessions) {
      this.revoke(old.id, 'BROKER_RESTART');
    }
    await Promise.all(oldSessions.map(old => this.reconcile(old.id, { force: true })));
    // Pending creates remain revoked and counted. They must not stop unrelated
    // owners from using the remaining quota after a broker restart.
    this.ready = true;
  }

  owned(owner, id) {
    const session = this.registry.get(id);
    requireThat(session && sameOwner(session, owner), 'SESSION_NOT_FOUND', 404);
    return session;
  }

  async create(inputOwner, options, { requestId, signal } = {}) {
    const owner = validateOwner(inputOwner);
    requireThat(this.ready, 'BROKER_NOT_READY');
    requireThat(owner.providers.includes(options.provider), 'PROVIDER_DENIED', 403);
    signal?.throwIfAborted();
    requireThat(requestId === undefined || /^[A-Za-z0-9_-]{1,128}$/.test(requestId), 'INVALID_REQUEST_ID');
    const hash = digest(canonical(options));
    const record = this.registry.transaction(() => {
      const previous = requestId && this.registry.request(owner, requestId);
      if (previous) {
        requireThat(previous.requestHash === hash, 'REQUEST_ID_CONFLICT', 409);
        requireThat(previous.state === 'Ready' && this.isLive(previous), 'CREATE_OUTCOME_UNKNOWN', 409);
        return { previous };
      }
      const counted = this.registry.counts(owner.id);
      requireThat(counted.total < this.brokerLimit && counted.owner < this.ownerLimit,
        'CAPACITY_EXHAUSTED', 429);
      const now = this.clock();
      const id = randomUUID();
      // OpenShell routable names have a 19-character limit. Keep the full ID in labels.
      const session = { id, name: `br-${randomBytes(8).toString('hex')}`, ownerId: owner.id, ownerGeneration: owner.generation,
        workspaceId: owner.workspaceId, brokerGeneration: this.generation, options,
        state: 'Creating', createdAt: now, expiresAt: now + options.effective.lifetimeMs,
        idleExpiresAt: null, attachment: randomBytes(32).toString('base64url'),
        requestId: requestId ?? null, requestHash: hash, handle: null,
        accessRevokedAt: null, browserStoppedAt: null, resourceDeletedAt: null };
      this.registry.put(session);
      this.registry.audit('create-intent', id);
      return { session };
    });
    if (record.previous) return record.previous;
    const session = record.session;
    const controller = new AbortController();
    const cancel = () => { controller.abort(); this.revoke(session.id, 'CREATE_CANCELLED'); };
    signal?.addEventListener('abort', cancel, { once: true });
    let timer;
    const abandoned = new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new PodError('CREATE_CANCELLED', 504)), { once: true });
      timer = setTimeout(cancel, this.createTimeoutMs);
    });
    const allocation = (async () => {
      try {
        // The persisted name/intent survives cancellation before a handle arrives.
        const handle = await Promise.resolve().then(() => this.runtime.provision(session, controller.signal,
          allocated => this.registry.update(session.id, s => { s.handle = allocated; })));
        this.registry.update(session.id, s => { s.handle = handle; });
        controller.signal.throwIfAborted();
        requireThat(this.isLive(this.registry.get(session.id)), 'SESSION_REVOKED', 410);
        this.registry.update(session.id, s => { s.state = 'Attaching'; });
        await this.prepareAttachment(owner, this.registry.get(session.id), controller.signal);
        controller.signal.throwIfAborted();
        const ready = this.registry.update(session.id, s => {
          requireThat(this.isLive(s), 'SESSION_REVOKED', 410);
          s.state = 'Ready'; s.idleExpiresAt = Math.min(s.expiresAt, this.clock() + s.options.effective.idleMs);
        });
        this.registry.audit('ready', session.id);
        return ready;
      } catch (error) {
        this.revoke(session.id, 'CREATE_FAILED');
        throw error instanceof PodError ? error : new PodError('CREATE_FAILED');
      } finally {
        this.allocations.delete(session.id);
        if (this.registry.get(session.id).accessRevokedAt !== null) {
          void this.reconcile(session.id).catch(() => { this.ready = false; });
        }
      }
    })();
    this.allocations.set(session.id, allocation);
    try { return await Promise.race([allocation, abandoned]); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  }

  isLive(session) {
    return session && session.accessRevokedAt === null && session.brokerGeneration === this.generation &&
      session.expiresAt > this.clock() && (session.idleExpiresAt === null || session.idleExpiresAt > this.clock());
  }

  acquire(owner, attachment, close) {
    const session = this.registry.attachment(owner, attachment);
    requireThat(this.isLive(session) && ['Ready', 'Attaching'].includes(session.state), 'SESSION_NOT_FOUND', 404);
    const streams = this.streams.get(session.id) ?? new Map();
    requireThat(streams.size < 2, 'ATTACHMENT_FULL', 429);
    const connectionId = randomUUID();
    streams.set(connectionId, close); this.streams.set(session.id, streams);
    this.registry.update(session.id, s => { s.idleExpiresAt = null; });
    let released = false;
    return { session, release: () => {
      if (released) return;
      released = true;
      streams.delete(connectionId);
      if (streams.size === 0) {
        this.streams.delete(session.id);
        this.registry.update(session.id, s => { s.idleExpiresAt = Math.min(s.expiresAt, this.clock() + s.options.effective.idleMs); });
      }
    } };
  }

  revoke(id, reason) {
    const first = this.registry.get(id)?.accessRevokedAt === null;
    if (!first) return;
    this.registry.update(id, session => {
      if (session.accessRevokedAt === null) session.accessRevokedAt = this.clock();
      if (session.resourceDeletedAt === null) session.state = 'CleanupPending';
    });
    for (const close of this.streams.get(id)?.values() ?? []) { try { close(); } catch {} }
    this.streams.delete(id);
    this.transfers.get(id)?.abort();
    this.transfers.delete(id);
    this.registry.audit('revoked', id, reason);
  }

  beginTransfer(owner, id) {
    const session = this.owned(owner, id);
    requireThat(this.isLive(session) && session.state === 'Ready', 'SESSION_NOT_FOUND', 404);
    requireThat(!this.transfers.has(id), 'TRANSFER_BUSY', 429);
    const controller = new AbortController();
    this.transfers.set(id, controller);
    return { session, signal: controller.signal, release: () => {
      if (this.transfers.get(id) === controller) this.transfers.delete(id);
    } };
  }

  async stop(owner, id) {
    this.owned(owner, id);
    this.revoke(id, 'STOP_REQUEST');
    if (this.registry.get(id).browserStoppedAt !== null) return this.registry.get(id);
    const waiters = this.stopWaiters.get(id) ?? new Set();
    let completed;
    const stopped = new Promise(resolve => { completed = resolve; waiters.add(resolve); });
    this.stopWaiters.set(id, waiters);
    try {
      void this.reconcile(id, { force: true }).catch(() => { this.ready = false; });
      await deadline(stopped, this.stopTimeoutMs, 'STOP_UNCONFIRMED');
      return this.registry.get(id);
    } finally {
      waiters.delete(completed);
      if (!waiters.size) this.stopWaiters.delete(id);
    }
  }

  reconcile(id, { force = false } = {}) {
    if (this.allocations.has(id)) return Promise.resolve();
    if (this.cleanup.has(id)) return this.cleanup.get(id);
    const initial = this.registry.get(id);
    if (initial.resourceDeletedAt !== null || (!force && (initial.nextCleanupAt ?? 0) > this.clock())) return Promise.resolve();
    const task = (async () => {
      try {
        let session = this.registry.get(id);
        if (session.resourceDeletedAt !== null) return;
        if (session.browserStoppedAt === null) {
          const stopped = await this.runtime.stop(session);
          requireThat(stopped?.stopped === true, 'STOP_UNCONFIRMED');
          session = this.registry.update(id, s => {
            s.browserStoppedAt = this.clock();
            if (stopped.deleted === true) { s.resourceDeletedAt = this.clock(); s.state = 'Stopped'; s.attachment = null; }
          });
          for (const notify of this.stopWaiters.get(id) ?? []) notify();
        }
        if (session.resourceDeletedAt !== null) return;
        const result = await this.runtime.remove(session);
        requireThat(result?.deleted === true, 'CLEANUP_PENDING');
        this.registry.update(id, s => { s.resourceDeletedAt = this.clock(); s.state = 'Stopped'; s.attachment = null; });
        this.registry.audit('deleted', id);
      } catch (error) {
        const code = error instanceof PodError ? error.code : 'CLEANUP_PENDING';
        this.registry.update(id, s => {
          s.cleanupAttempts = Math.min((s.cleanupAttempts ?? 0) + 1, 32);
          s.nextCleanupAt = this.clock() + Math.min(60_000, this.cleanupRetryMs * 2 ** (s.cleanupAttempts - 1));
          s.cleanupError = code;
        });
        this.registry.audit('cleanup-pending', id, code);
      } finally { this.cleanup.delete(id); }
    })();
    this.cleanup.set(id, task);
    return task;
  }

  async revokeOwner(owner) {
    const sessions = this.registry.active().filter(s => sameOwner(s, owner));
    // Revoke every attachment before waiting for any slow native deletion.
    for (const session of sessions) this.revoke(session.id, 'OWNER_LOST');
    await Promise.all(sessions.map(session => this.reconcile(session.id)));
  }

  async sweep({ waitForCleanup = true, forceCleanup = false } = {}) {
    const pending = [];
    for (const session of this.registry.active()) {
      if (session.state === 'CleanupPending' || !this.isLive(session)) {
        if (session.accessRevokedAt === null) this.revoke(session.id, 'EXPIRED_OR_REVOKED');
        pending.push(session.id);
      }
    }
    if (this.clock() - this.lastPrune >= 60_000) {
      this.registry.prune(this.clock()); this.lastPrune = this.clock();
    }
    const cleanup = Promise.all(pending.map(id => this.reconcile(id, { force: forceCleanup })));
    if (waitForCleanup) await cleanup;
    else void cleanup.catch(() => { this.ready = false; });
  }

  async shutdown() {
    this.ready = false;
    for (const session of this.registry.active()) {
      this.revoke(session.id, 'BROKER_SHUTDOWN');
    }
    await Promise.allSettled([...this.allocations.values()]);
    await Promise.allSettled([...this.cleanup.values()]);
    // Do not leave a now-confirmable deletion queued behind a retry timer when
    // the maintenance loop has stopped. Truly uncertain outcomes stay reserved.
    await this.sweep({ forceCleanup: true });
  }
}
