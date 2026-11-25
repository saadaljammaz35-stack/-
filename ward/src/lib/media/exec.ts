import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, openSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '@/lib/env';

/**
 * Starts the media runner (media-runner/runner.mjs) and checks on it later.
 *
 *   local    a detached child process on this machine (development, a self-hosted worker).
 *            Needs ffmpeg on PATH (or FFMPEG_PATH) and, for transcription, python3 with
 *            faster-whisper.
 *   sandbox  a Vercel Sandbox microVM created for this one task (hosted deployments, where
 *            functions cannot run ffmpeg for long). Installs ffmpeg-static and faster-whisper
 *            itself, runs the task, posts the result back to the app, and is stopped.
 *
 * Long tasks never block a request or a queue job: start() returns a handle at once and
 * poll() is cheap. The result also arrives by callback, so nothing depends on polling.
 */

export type RunnerMode = 'local' | 'sandbox';
export type RunnerTask = 'analyze' | 'render';

export interface RunnerHandle {
  runId: string;
  mode: RunnerMode;
  task: RunnerTask;
  startedAt: string;
  dir?: string;
  pid?: number;
  sandbox?: string;
  cmdId?: string;
}

export interface RunnerProgress {
  stage?: string;
  pct?: number;
}

export interface AnalyzeResult {
  ok: boolean;
  task: 'analyze';
  runId?: string;
  error?: string;
  detail?: string;
  seconds?: number;
  probe: { duration: number; video: { codec: string; width: number; height: number; fps: number | null; rotation: number } | null; audio: { codec: string; sampleRate: number } | null };
  silences: [number, number][];
  transcript: null | { engine: string; language?: string; model?: string; cues: { start: number; end: number; text: string }[]; words?: { start: number; end: number; word: string }[] };
}

export interface RenderResult {
  ok: boolean;
  partial?: boolean;
  task: 'render';
  runId?: string;
  error?: string;
  detail?: string;
  seconds?: number;
  jobs: Record<string, { ok: boolean; error?: string; duration?: number; files?: Record<string, string> }>;
  uploads: Record<string, { ok: boolean; size: number; error?: string }>;
}

export type RunnerResult = AnalyzeResult | RenderResult | { ok: false; error: string; detail?: string; runId?: string; task?: undefined };

export type PollResult = { state: 'running'; progress: RunnerProgress | null } | { state: 'finished'; result: RunnerResult } | { state: 'lost'; error: string };

export function runnerMode(): RunnerMode {
  return env().WARD_MEDIA_RUNNER ?? (process.env.VERCEL ? 'sandbox' : 'local');
}

const RUNNER_DIR = () => path.join(/*turbopackIgnore: true*/ process.cwd(), 'media-runner');
const FONT_FILE = () => path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'fonts', 'WARDTypeOriginal-Bold.ttf');

/** Paths inside the sandbox. */
const SBX = { runner: '/vercel/sandbox/runner', job: '/vercel/sandbox/job', venv: '/vercel/sandbox/venv' };

export interface StartOptions {
  task: RunnerTask;
  /** The runner spec without the machine-specific fields (workdir, fontsDir, callback, runId). */
  spec: Record<string, unknown>;
  needsWhisper?: boolean;
  callbackUrl?: string | null;
}

export async function startRunner(opts: StartOptions): Promise<RunnerHandle> {
  const runId = randomUUID();
  const mode = runnerMode();
  const startedAt = new Date().toISOString();
  if (mode === 'local') {
    const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().WARD_MEDIA_WORK_DIR, `${opts.task}-${runId}`);
    await fs.mkdir(path.join(dir, 'fonts'), { recursive: true });
    await fs.copyFile(FONT_FILE(), path.join(dir, 'fonts', 'WARDTypeOriginal-Bold.ttf'));
    const spec = { ...opts.spec, version: 1, task: opts.task, runId, workdir: path.join(dir, 'work'), ...(opts.task === 'render' ? { render: { ...(opts.spec.render as object), fontsDir: path.join(dir, 'fonts') } } : {}) };
    await fs.writeFile(path.join(dir, 'spec.json'), JSON.stringify(spec));
    const log = openSync(path.join(dir, 'runner.log'), 'a');
    const child = spawn(process.execPath, [path.join(RUNNER_DIR(), 'runner.mjs'), path.join(dir, 'spec.json'), path.join(dir, 'result.json')], {
      cwd: dir,
      detached: true,
      stdio: ['ignore', log, log],
      env: { ...process.env },
    });
    closeSync(log);
    child.on('error', (err) => console.error('[ward] media runner failed to start', err));
    child.unref();
    return { runId, mode, task: opts.task, startedAt, dir, pid: child.pid };
  }

  const { Sandbox } = await import('@vercel/sandbox');
  const e = env();
  const [runnerSrc, transcribeSrc, font] = await Promise.all([
    fs.readFile(path.join(RUNNER_DIR(), 'runner.mjs')),
    fs.readFile(path.join(RUNNER_DIR(), 'transcribe.py')),
    fs.readFile(FONT_FILE()),
  ]);
  const spec = {
    ...opts.spec,
    version: 1,
    task: opts.task,
    runId,
    workdir: `${SBX.job}/work`,
    callback: opts.callbackUrl ?? undefined,
    ...(opts.task === 'render' ? { render: { ...(opts.spec.render as object), fontsDir: `${SBX.runner}/fonts` } } : {}),
  };
  const sbx = await Sandbox.create({
    resources: { vcpus: e.WARD_SANDBOX_VCPUS },
    timeout: e.WARD_SANDBOX_TIMEOUT_MIN * 60_000,
    persistent: false,
    region: 'fra1',
    tags: { app: 'ward', task: opts.task },
  });
  try {
    await sbx.writeFiles([
      { path: `${SBX.runner}/runner.mjs`, content: runnerSrc },
      { path: `${SBX.runner}/transcribe.py`, content: transcribeSrc },
      { path: `${SBX.runner}/package.json`, content: '{"name":"ward-media-runner","private":true,"type":"module"}' },
      { path: `${SBX.runner}/fonts/WARDTypeOriginal-Bold.ttf`, content: font },
      { path: `${SBX.job}/spec.json`, content: JSON.stringify(spec) },
    ]);
    const script = [
      'set -e',
      `cd ${SBX.runner}`,
      `npm install --no-audit --no-fund --loglevel=error ffmpeg-static@5.3.0 @vercel/blob@2.9.0 > ${SBX.job}/setup.log 2>&1`,
      opts.needsWhisper ? `python3 -m venv ${SBX.venv} >> ${SBX.job}/setup.log 2>&1 && ${SBX.venv}/bin/pip install -q faster-whisper==1.2.1 >> ${SBX.job}/setup.log 2>&1` : '',
      `node runner.mjs ${SBX.job}/spec.json ${SBX.job}/result.json >> ${SBX.job}/runner.log 2>&1`,
    ]
      .filter(Boolean)
      .join('\n');
    const cmd = await sbx.runCommand({ cmd: 'bash', args: ['-c', script], detached: true, env: { PYTHON: `${SBX.venv}/bin/python` } });
    return { runId, mode, task: opts.task, startedAt, sandbox: sbx.name, cmdId: cmd.cmdId };
  } catch (err) {
    await sbx.stop().catch(() => {});
    throw err;
  }
}

async function readJsonFile<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function alive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const tail = (s: string, n = 1200) => s.slice(-n).trim();

export async function pollRunner(h: RunnerHandle): Promise<PollResult> {
  if (h.mode === 'local') {
    const dir = h.dir!;
    const result = await readJsonFile<RunnerResult>(path.join(dir, 'result.json'));
    if (result) return { state: 'finished', result };
    if (alive(h.pid)) return { state: 'running', progress: await readJsonFile<RunnerProgress>(path.join(dir, 'progress.json')) };
    const log = await fs.readFile(path.join(dir, 'runner.log'), 'utf8').catch(() => '');
    return { state: 'lost', error: `runner_exited_without_result: ${tail(log) || 'no log'}` };
  }
  const { Sandbox } = await import('@vercel/sandbox');
  const sbx = await Sandbox.get({ name: h.sandbox! });
  if (['stopped', 'failed', 'aborted'].includes(sbx.status)) return { state: 'lost', error: `sandbox_${sbx.status}` };
  const cmd = await sbx.getCommand(h.cmdId!);
  if (cmd.exitCode === null) {
    const buf = await sbx.readFileToBuffer({ path: `${SBX.job}/progress.json` }).catch(() => null);
    let progress: RunnerProgress | null = null;
    try {
      progress = buf ? (JSON.parse(buf.toString('utf8')) as RunnerProgress) : null;
    } catch {
      /* partially written */
    }
    return { state: 'running', progress: progress ?? { stage: 'setup', pct: 0 } };
  }
  const buf = await sbx.readFileToBuffer({ path: `${SBX.job}/result.json` }).catch(() => null);
  if (buf) return { state: 'finished', result: JSON.parse(buf.toString('utf8')) as RunnerResult };
  const logs = await Promise.all(['setup.log', 'runner.log'].map((f) => sbx.readFileToBuffer({ path: `${SBX.job}/${f}` }).catch(() => null)));
  return { state: 'lost', error: `runner_failed (exit ${cmd.exitCode}): ${tail(logs.map((b) => b?.toString('utf8') ?? '').join('\n')) || 'no log'}` };
}

export async function stopRunner(h: RunnerHandle, opts: { keepFiles?: boolean } = {}): Promise<void> {
  try {
    if (h.mode === 'local') {
      if (alive(h.pid)) {
        try {
          process.kill(-h.pid!, 'SIGTERM'); // the whole process group (ffmpeg, python)
        } catch {
          process.kill(h.pid!, 'SIGTERM');
        }
      }
      if (!opts.keepFiles && h.dir) await fs.rm(h.dir, { recursive: true, force: true });
      return;
    }
    const { Sandbox } = await import('@vercel/sandbox');
    const sbx = await Sandbox.get({ name: h.sandbox! });
    if (!['stopped', 'failed', 'aborted'].includes(sbx.status)) await sbx.stop();
  } catch (err) {
    console.error('[ward] stopping media runner failed', err);
  }
}
