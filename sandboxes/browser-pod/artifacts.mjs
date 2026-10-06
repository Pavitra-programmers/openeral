import { constants } from 'node:fs';
import { mkdir, open, opendir, rename, unlink } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import Busboy from 'busboy';
import { ZipFile } from 'yazl';

const MiB = 1024 * 1024;
export const ARTIFACT_LIMITS = Object.freeze({ file: 256 * MiB, stored: 512 * MiB, entries: 256 });
const fdPath = handle => `/proc/self/fd/${handle.fd}`;
const sameFile = (a, b) => ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'nlink'].every(key => a[key] === b[key]);
const safeName = name => typeof name === 'string' && name.length > 0 && Buffer.byteLength(name) <= 240 &&
  !/[\\/:\x00-\x1f\x7f]/.test(name) && !['.', '..'].includes(name);
export class ArtifactError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
function check(value, code, status) { if (!value) throw new ArtifactError(code, status); }
function bounded(max, onBytes = () => {}) {
  let bytes = 0;
  return new Transform({ transform(chunk, _encoding, done) {
    bytes += chunk.length;
    if (bytes > max) done(new ArtifactError('ARTIFACT_TOO_LARGE', 413));
    else { onBytes(chunk); done(null, chunk); }
  } });
}
async function directory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  return open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
}
function fileWriter(handle) {
  return new Writable({ write(chunk, _encoding, callback) {
    (async () => {
      let offset = 0;
      while (offset < chunk.length) {
        const result = await handle.write(chunk, offset, chunk.length - offset);
        check(result.bytesWritten > 0, 'ARTIFACT_WRITE_FAILED', 503); offset += result.bytesWritten;
      }
    })().then(() => callback(), callback);
  } });
}
function fileReader(handle, size) {
  return Readable.from((async function* () {
    let offset = 0;
    while (offset < size) {
      const buffer = Buffer.alloc(Math.min(64 * 1024, size - offset));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      check(bytesRead > 0, 'ARTIFACT_CHANGED', 409); offset += bytesRead;
      yield buffer.subarray(0, bytesRead);
    }
  })(), { objectMode: false });
}

export class PodArtifacts {
  constructor({ root = '/tmp/openrind-browser/artifacts', downloads = '/tmp/downloads', enabled = false,
    limits = ARTIFACT_LIMITS } = {}) {
    this.root = root; this.downloads = downloads; this.enabled = enabled; this.limits = limits;
    this.stored = 0; this.objects = 0; this.busy = false; this.archives = new Map(); this.archive = null;
    this.controller = new AbortController();
  }
  async start() {
    // Keep directory descriptors open. A renamed path cannot redirect a later file open.
    this.rootHandle = await directory(this.root);
    this.downloadHandle = await directory(this.downloads);
  }
  path(name) { return `${fdPath(this.rootHandle)}/${name}`; }
  async close() {
    this.controller.abort();
    await Promise.allSettled([this.job, this.uploadJob].filter(Boolean));
    await this.rootHandle?.close(); await this.downloadHandle?.close();
  }
  async upload(req, signal) {
    check(!this.busy, 'ARTIFACT_BUSY', 429);
    check(!this.controller.signal.aborted, 'SESSION_STOPPED', 410);
    this.busy = true;
    this.uploadJob = this.receiveUpload(req, AbortSignal.any([signal, this.controller.signal]));
    try { return await this.uploadJob; } finally { this.busy = false; this.uploadJob = null; }
  }
  async receiveUpload(req, signal) {
    check(this.stored + this.limits.file <= this.limits.stored, 'ARTIFACT_CAPACITY', 429);
    check(this.objects < this.limits.entries, 'ARTIFACT_ENTRY_LIMIT', 429);
    const name = `${randomBytes(16).toString('hex')}.upload`;
    const partial = `${name}.part`;
    let handle; let originalName; let bytes = 0; let failure; let seen = false;
    const hash = createHash('sha256'); const tasks = [];
    try {
      const parser = Busboy({ headers: req.headers, preservePath: true,
        limits: { files: 1, fields: 0, parts: 2, fileSize: this.limits.file, headerPairs: 32 } });
      const fail = (code, status = 400) => { failure ??= new ArtifactError(code, status); };
      for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit']) parser.on(event, () => fail('INVALID_MULTIPART'));
      parser.on('file', (field, file, info) => {
        if (seen || field !== 'file' || !safeName(info.filename)) { fail('INVALID_UPLOAD_NAME'); file.resume(); return; }
        seen = true; originalName = info.filename;
        file.on('limit', () => fail('ARTIFACT_TOO_LARGE', 413));
        const task = (async () => {
          handle = await open(this.path(partial), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
          await pipeline(file, bounded(this.limits.file, chunk => { bytes += chunk.length; hash.update(chunk); }),
            fileWriter(handle), { signal });
          await handle.sync();
        })().catch(error => { failure ??= error; file.resume(); });
        tasks.push(task);
      });
      await pipeline(req, bounded(this.limits.file + 64 * 1024), parser, { signal });
      await Promise.all(tasks);
      if (failure) throw failure;
      check(seen && handle, 'FILE_REQUIRED');
      signal.throwIfAborted();
      await handle.close(); handle = null;
      await rename(this.path(partial), this.path(name));
      this.stored += bytes; this.objects++;
      return { message: 'File uploaded', filePath: `${this.root}/${name}`, fileName: name, originalName,
        size: bytes, sha256: hash.digest('hex') };
    } finally {
      await Promise.all(tasks); await handle?.close();
      await unlink(this.path(partial)).catch(() => {});
    }
  }
  async snapshot() {
    const files = []; let bytes = 0; let visited = 0;
    const visit = async (parent, prefix, depth) => {
      check(depth <= 8, 'DOWNLOAD_DEPTH_LIMIT');
      const entries = await opendir(fdPath(parent));
      for await (const entry of entries) {
        check(++visited <= this.limits.entries, 'DOWNLOAD_ENTRY_LIMIT');
        if (!safeName(entry.name) || /\.(?:crdownload|part|tmp)$/.test(entry.name) || entry.isSymbolicLink()) continue;
        check(files.length < this.limits.entries, 'DOWNLOAD_ENTRY_LIMIT');
        const path = `${fdPath(parent)}/${entry.name}`;
        if (entry.isDirectory()) {
          const dir = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
          try { await visit(dir, `${prefix}${entry.name}/`, depth + 1); } finally { await dir.close(); }
        } else if (entry.isFile()) {
          const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
          let retained = false;
          try {
            const stat = await handle.stat({ bigint: true });
            check(stat.isFile() && stat.nlink === 1n, 'UNSAFE_DOWNLOAD');
            bytes += Number(stat.size);
            check(bytes <= this.limits.file - 64 * 1024 && stat.size <= BigInt(this.limits.file), 'ARTIFACT_TOO_LARGE', 413);
            files.push({ name: `${prefix}${entry.name}`, handle, stat }); retained = true;
          } finally { if (!retained) await handle.close(); }
        }
      }
    };
    try {
      await visit(this.downloadHandle, '', 0);
      files.sort((a, b) => a.name.localeCompare(b.name));
      const fingerprint = createHash('sha256').update(JSON.stringify(files.map(file =>
        [file.name, ...['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].map(key => String(file.stat[key]))]))).digest('hex');
      return { files, bytes, fingerprint, close: () => Promise.all(files.map(file => file.handle.close())) };
    } catch (error) { await Promise.all(files.map(file => file.handle.close())); throw error; }
  }
  async prepareArchive() {
    if (!this.enabled) return { status: 'not_enabled' };
    check(!this.controller.signal.aborted, 'SESSION_STOPPED', 410);
    if (this.archive?.status === 'in_progress') return { status: 'in_progress' };
    check(!this.busy, 'ARTIFACT_BUSY', 429);
    this.busy = true;
    let snapshot;
    try {
      snapshot = await this.snapshot();
      if (this.archive?.fingerprint === snapshot.fingerprint) {
        if (this.archive.status === 'completed') return { status: 'completed', artifactId: this.archive.artifactId };
        if (this.archive.status === 'failed') return { status: 'failed', error: this.archive.error };
      }
      check(this.stored + snapshot.bytes + this.limits.file <= this.limits.stored, 'ARTIFACT_CAPACITY', 429);
      check(this.objects < this.limits.entries, 'ARTIFACT_ENTRY_LIMIT', 429);
      this.archive = { status: 'in_progress' };
      const fingerprint = snapshot.fingerprint;
      this.job = this.buildArchive(snapshot).catch(error => {
        this.archive = { status: 'failed', fingerprint, error: error instanceof ArtifactError ? error.code : 'ARCHIVE_FAILED' };
      }).finally(() => { this.busy = false; this.job = null; });
      snapshot = null;
      return { status: 'in_progress' };
    } finally {
      if (snapshot) await snapshot.close();
      if (!this.job) this.busy = false;
    }
  }
  async buildArchive(snapshot) {
    const artifactId = randomBytes(16).toString('hex');
    const name = `${artifactId}.zip`; const partial = `${name}.part`;
    let handle; const zip = new ZipFile(); const inputs = [];
    const hash = createHash('sha256'); let bytes = 0;
    try {
      handle = await open(this.path(partial), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      zip.on('error', error => zip.outputStream.destroy(error));
      for (const file of snapshot.files) {
        zip.addReadStreamLazy(file.name, { size: Number(file.stat.size), mtime: new Date(Number(file.stat.mtimeMs)) }, callback => {
          const input = fileReader(file.handle, Number(file.stat.size));
          inputs.push(input); callback(null, input);
        });
      }
      zip.end();
      await pipeline(zip.outputStream, bounded(this.limits.file, chunk => { bytes += chunk.length; hash.update(chunk); }),
        fileWriter(handle), { signal: this.controller.signal });
      for (const file of snapshot.files) check(sameFile(file.stat, await file.handle.stat({ bigint: true })), 'DOWNLOAD_CHANGED');
      const current = await this.snapshot();
      try { check(current.fingerprint === snapshot.fingerprint, 'DOWNLOAD_CHANGED'); } finally { await current.close(); }
      await handle.sync(); await handle.close(); handle = null;
      this.controller.signal.throwIfAborted();
      await rename(this.path(partial), this.path(name));
      const readHandle = await open(this.path(name), constants.O_RDONLY | constants.O_NOFOLLOW);
      let stat; try { stat = await readHandle.stat({ bigint: true }); } finally { await readHandle.close(); }
      this.archives.set(artifactId, { name, stat, sha256: hash.digest('hex'), bytes }); this.stored += bytes; this.objects++;
      this.archive = { status: 'completed', artifactId, fingerprint: snapshot.fingerprint };
    } finally {
      zip.outputStream.destroy(); for (const input of inputs) input.destroy();
      await snapshot.close(); await handle?.close(); await unlink(this.path(partial)).catch(() => {});
    }
  }
  async streamArchive(id, res, signal) {
    const artifact = this.archives.get(id);
    check(artifact, 'ARTIFACT_NOT_FOUND', 404);
    const handle = await open(this.path(artifact.name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      check(sameFile(artifact.stat, await handle.stat({ bigint: true })), 'ARTIFACT_CHANGED', 409);
      // Do not send a complete HTTP body until its published hash is verified.
      const hash = createHash('sha256');
      const verify = new Transform({ transform(chunk, _encoding, callback) { hash.update(chunk); callback(null, chunk); },
        flush(callback) {
          handle.stat({ bigint: true }).then(stat => {
            check(sameFile(artifact.stat, stat) && hash.digest('hex') === artifact.sha256, 'ARTIFACT_CHANGED', 409);
          }).then(() => callback(), callback);
        } });
      res.writeHead(200, { 'content-type': 'application/zip', 'cache-control': 'no-store' });
      await pipeline(fileReader(handle, artifact.bytes), verify, res,
        { signal: AbortSignal.any([signal, this.controller.signal]) });
    } finally { await handle.close(); }
  }
}
