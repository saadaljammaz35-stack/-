#!/usr/bin/env node
/**
 * WARD montage runner — executes ONE media task with ffmpeg and exits.
 *
 *   node runner.mjs <spec.json> <result.json>
 *
 * The same file runs on a self-hosted worker, on a developer machine and inside a Vercel
 * Sandbox. It has no npm dependencies of its own: `ffmpeg` comes from FFMPEG_PATH, the
 * `ffmpeg-static` package next to it, or PATH; `@vercel/blob` is imported lazily and only
 * when an output goes to Vercel Blob. Every decision (what to cut, captions, framing) is
 * made by the app and arrives in the spec — the runner only measures and renders.
 *
 * Tasks
 *   analyze  probe the source, extract 16 kHz mono audio, detect silences, optionally
 *            transcribe locally with faster-whisper (transcribe.py). Returns data inline.
 *   render   render jobs (the trimmed episode, vertical shorts with burned-in captions),
 *            then upload every file to its target.
 *
 * Progress is written to <workdir>/progress.json while running; the result to <result.json>.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, promises as fs, openAsBlob } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER_VERSION = 1;

// ---------------------------------------------------------------------------------------
// helpers

function ffmpegBin(spec) {
  if (spec.ffmpeg) return spec.ffmpeg;
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const p = createRequire(path.join(HERE, 'package.json'))('ffmpeg-static');
    if (p && existsSync(p)) return p;
  } catch {
    /* not installed next to the runner */
  }
  return 'ffmpeg';
}

/** Run a command; resolve with exit code and the tail of stderr. Never throws on non-zero. */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: { ...process.env, ...(opts.env ?? {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
    let errTail = '';
    let outBuf = '';
    let errBuf = '';
    const lines = (buf, chunk, cb) => {
      buf += chunk;
      let i;
      while ((i = buf.search(/[\r\n]/)) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line && cb) cb(line);
      }
      return buf;
    };
    child.stdout.on('data', (d) => {
      outBuf = lines(outBuf, d.toString('utf8'), opts.onStdout);
    });
    child.stderr.on('data', (d) => {
      const s = d.toString('utf8');
      errTail = (errTail + s).slice(-20000);
      errBuf = lines(errBuf, s, opts.onStderr);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? -1, stderr: errTail }));
  });
}

function fail(message, detail) {
  const e = new Error(message);
  e.detail = detail;
  return e;
}

let progressFile = null;
let lastProgressWrite = 0;
let progressState = { stage: 'starting', pct: 0 };
async function progress(update, force = false) {
  progressState = { ...progressState, ...update, updatedAt: new Date().toISOString() };
  if (!progressFile) return;
  const now = Date.now();
  if (!force && now - lastProgressWrite < 1500) return;
  lastProgressWrite = now;
  await fs.writeFile(progressFile, JSON.stringify(progressState)).catch(() => {});
}

/** ffmpeg with -progress on stdout; reports 0..1 of `expectedSeconds` through onFraction. */
async function ffmpeg(bin, args, { expectedSeconds, onFraction, cwd } = {}) {
  const full = ['-hide_banner', '-nostdin', '-y', '-progress', 'pipe:1', '-nostats', ...args];
  const res = await run(bin, full, {
    cwd,
    onStdout: (line) => {
      const m = /^out_time_us=(\d+)/.exec(line);
      if (m && expectedSeconds > 0 && onFraction) onFraction(Math.min(1, Number(m[1]) / 1e6 / expectedSeconds));
    },
  });
  if (res.code !== 0) throw fail(`ffmpeg exited with ${res.code}`, res.stderr.slice(-4000));
  return res;
}

// ---------------------------------------------------------------------------------------
// analyze

function parseTime(h, m, s) {
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export function parseProbe(stderr) {
  const d = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const v = /Stream #\d+:\d+[^\n]*?: Video: ([\w-]+)[^\n]*?, (\d{2,5})x(\d{2,5})/.exec(stderr);
  const fps = /, (\d+(?:\.\d+)?) fps/.exec(stderr) ?? /, (\d+(?:\.\d+)?) tbr/.exec(stderr);
  const a = /Stream #\d+:\d+[^\n]*?: Audio: ([\w-]+)[^\n]*?, (\d+) Hz/.exec(stderr);
  const rot = /rotation of (-?\d+(?:\.\d+)?) degrees/.exec(stderr);
  let width = v ? Number(v[2]) : null;
  let height = v ? Number(v[3]) : null;
  const rotation = rot ? Math.round(Number(rot[1])) : 0;
  if (width && height && Math.abs(rotation) % 180 === 90) [width, height] = [height, width];
  return {
    duration: d ? parseTime(d[1], d[2], d[3]) : null,
    video: v ? { codec: v[1], width, height, fps: fps ? Number(fps[1]) : null, rotation } : null,
    audio: a ? { codec: a[1], sampleRate: Number(a[2]) } : null,
  };
}

export function parseSilences(stderr, duration) {
  const out = [];
  let start = null;
  for (const line of stderr.split(/\r?\n/)) {
    const s = /silence_start: (-?\d+(?:\.\d+)?)/.exec(line);
    if (s) start = Math.max(0, Number(s[1]));
    const e = /silence_end: (\d+(?:\.\d+)?)/.exec(line);
    if (e && start !== null) {
      out.push([round3(start), round3(Number(e[1]))]);
      start = null;
    }
  }
  if (start !== null && duration) out.push([round3(start), round3(duration)]); // silent until the end
  return out;
}

const round3 = (n) => Math.round(n * 1000) / 1000;

async function analyze(spec, bin, work) {
  const src = spec.source.url;
  await progress({ stage: 'probe', pct: 1 }, true);
  const probeRes = await run(bin, ['-hide_banner', '-nostdin', '-i', src]);
  const probe = parseProbe(probeRes.stderr);
  if (!probe.duration) throw fail('could not read the media file', probeRes.stderr.slice(-2000));
  if (!probe.audio) throw fail('the file has no audio track');

  const wav = path.join(work, 'audio16k.wav');
  await progress({ stage: 'audio', pct: 2 }, true);
  await ffmpeg(bin, ['-i', src, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], {
    expectedSeconds: probe.duration,
    onFraction: (f) => progress({ stage: 'audio', pct: 2 + f * 18 }),
  });

  const sd = spec.analyze?.silence ?? {};
  const noise = Number.isFinite(sd.noiseDb) ? sd.noiseDb : -35;
  const minS = Number.isFinite(sd.minSeconds) ? sd.minSeconds : 0.5;
  await progress({ stage: 'silence', pct: 21 }, true);
  const silRes = await run(bin, ['-hide_banner', '-nostdin', '-i', wav, '-af', `silencedetect=noise=${noise}dB:d=${minS}`, '-f', 'null', '-']);
  if (silRes.code !== 0) throw fail('silence detection failed', silRes.stderr.slice(-2000));
  const silences = parseSilences(silRes.stderr, probe.duration);

  let transcript = null;
  const tr = spec.analyze?.transcribe ?? { engine: 'none' };
  if (tr.engine === 'whisper-local') {
    await progress({ stage: 'transcribe', pct: 25 }, true);
    const out = path.join(work, 'transcript.json');
    const args = [path.join(HERE, 'transcribe.py'), wav, out, '--model', tr.model ?? 'large-v3-turbo', '--lang', tr.language ?? 'ar', '--threads', String(tr.threads ?? os.cpus().length)];
    const res = await run(process.env.PYTHON ?? 'python3', args, {
      onStdout: (line) => {
        const m = /^PROGRESS ([\d.]+) ([\d.]+)/.exec(line);
        if (m && Number(m[2]) > 0) progress({ stage: 'transcribe', pct: 25 + (Number(m[1]) / Number(m[2])) * 73 });
      },
    });
    if (res.code !== 0) throw fail('transcription failed', res.stderr.slice(-4000));
    transcript = { engine: 'whisper-local', ...JSON.parse(await fs.readFile(out, 'utf8')) };
  }
  await progress({ stage: 'done', pct: 100 }, true);
  return { probe, silences, silenceParams: { noiseDb: noise, minSeconds: minS }, transcript };
}

// ---------------------------------------------------------------------------------------
// render

/** Sorted, clamped, merged keep-segments in [0, limit]. */
export function normalizeSegments(segments, limit) {
  const s = segments
    .map(([a, b]) => [Math.max(0, Number(a)), Math.min(limit ?? Infinity, Number(b))])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b - a >= 0.1)
    .sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const seg of s) {
    const last = out[out.length - 1];
    if (last && seg[0] <= last[1] + 0.04) last[1] = Math.max(last[1], seg[1]);
    else out.push([...seg]);
  }
  return out.map(([a, b]) => [round3(a), round3(b)]);
}

const VCODEC = (o) => ['-c:v', 'libx264', '-preset', o.preset ?? 'veryfast', '-crf', String(o.crf ?? 20), '-pix_fmt', 'yuv420p'];
const ACODEC = ['-c:a', 'aac', '-b:a', '160k', '-ar', '48000'];
const LOUDNORM = 'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000';

/** trim/atrim every keep-segment and concat them: sample-accurate audio, sync kept per segment. */
export function concatGraph(segments, { videoOut = 'vc', audioOut = 'ac' } = {}) {
  const n = segments.length;
  const parts = [];
  const vIn = n > 1 ? Array.from({ length: n }, (_, i) => `vs${i}`) : ['0:v'];
  const aIn = n > 1 ? Array.from({ length: n }, (_, i) => `as${i}`) : ['0:a'];
  if (n > 1) {
    parts.push(`[0:v]split=${n}${vIn.map((l) => `[${l}]`).join('')}`);
    parts.push(`[0:a]asplit=${n}${aIn.map((l) => `[${l}]`).join('')}`);
  }
  const pairs = [];
  segments.forEach(([a, b], i) => {
    parts.push(`[${vIn[i]}]trim=start=${a}:end=${b},setpts=PTS-STARTPTS[vt${i}]`);
    parts.push(`[${aIn[i]}]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS[at${i}]`);
    pairs.push(`[vt${i}][at${i}]`);
  });
  parts.push(`${pairs.join('')}concat=n=${n}:v=1:a=1[${videoOut}][${audioOut}]`);
  return parts;
}

const FRAMING_X = { left: 0.25, center: 0.5, right: 0.75 };

export function verticalChain(framing, inLabel, outLabel) {
  if (framing === 'fit') {
    return [
      `[${inLabel}]split[fg0][bg0]`,
      `[bg0]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=28,eq=brightness=-0.06[bg1]`,
      `[fg0]scale=1080:1920:force_original_aspect_ratio=decrease[fg1]`,
      `[bg1][fg1]overlay=(W-w)/2:(H-h)/2,setsar=1[${outLabel}]`,
    ];
  }
  const x = FRAMING_X[framing] ?? 0.5;
  return [`[${inLabel}]crop=w='min(iw,ih*9/16)':h=ih:x='(iw-ow)*${x}':y=0,scale=1080:1920,setsar=1[${outLabel}]`];
}

function escFilterPath(p) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

async function renderEpisode(bin, src, job, work, onFraction) {
  const segs = normalizeSegments(job.segments, job.sourceDuration);
  if (!segs.length) throw fail('nothing left to render: every part was cut');
  const graph = concatGraph(segs);
  const vf = [];
  if (job.height) vf.push(`scale=-2:${job.height}`);
  vf.push('format=yuv420p');
  graph.push(`[vc]${vf.join(',')}[vout]`);
  graph.push(job.loudnorm === false ? `[ac]anull[aout]` : `[ac]${LOUDNORM}[aout]`);
  const script = path.join(work, `${job.name}.filter`);
  await fs.writeFile(script, graph.join(';\n'));
  const out = path.join(work, job.output);
  const expected = segs.reduce((t, [a, b]) => t + (b - a), 0);
  await ffmpeg(bin, ['-i', src, '-filter_complex_script', script, '-map', '[vout]', '-map', '[aout]', ...VCODEC(job), ...ACODEC, '-movflags', '+faststart', out], {
    expectedSeconds: expected,
    onFraction,
  });
  return { file: out, duration: round3(expected) };
}

async function renderShort(bin, src, job, work, fontsDir, onFraction) {
  const start = Math.max(0, Number(job.start));
  const end = Number(job.end);
  // Segments arrive in source time; the input is seeked to `start`, so shift them.
  const rel = normalizeSegments((job.segments?.length ? job.segments : [[start, end]]).map(([a, b]) => [Math.max(a, start) - start, Math.min(b, end) - start]), end - start);
  if (!rel.length) throw fail('the short is empty after cuts');
  const graph = concatGraph(rel);
  graph.push(...verticalChain(job.framing ?? 'fit', 'vc', 'vv'));
  let last = 'vv';
  if (job.ass) {
    const assFile = path.join(work, `${job.name}.ass`);
    await fs.writeFile(assFile, job.ass, 'utf8');
    const fontsOpt = fontsDir ? `:fontsdir='${escFilterPath(fontsDir)}'` : '';
    graph.push(`[vv]fps=30,ass='${escFilterPath(assFile)}'${fontsOpt}:shaping=complex[vcap]`);
    last = 'vcap';
  } else {
    graph.push(`[vv]fps=30[vcap]`);
    last = 'vcap';
  }
  graph.push(`[${last}]format=yuv420p[vout]`);
  graph.push(job.loudnorm === false ? `[ac]anull[aout]` : `[ac]${LOUDNORM}[aout]`);
  const script = path.join(work, `${job.name}.filter`);
  await fs.writeFile(script, graph.join(';\n'));
  const out = path.join(work, job.output);
  const expected = rel.reduce((t, [a, b]) => t + (b - a), 0);
  await ffmpeg(bin, ['-ss', String(start), '-to', String(end), '-i', src, '-filter_complex_script', script, '-map', '[vout]', '-map', '[aout]', ...VCODEC({ ...job, crf: job.crf ?? 21 }), ...ACODEC, '-movflags', '+faststart', out], {
    expectedSeconds: expected,
    onFraction,
  });
  const files = { [job.output]: out };
  if (job.thumbnail) {
    const thumb = path.join(work, job.thumbnail);
    await ffmpeg(bin, ['-ss', String(Math.min(1.5, expected / 2)), '-i', out, '-frames:v', '1', '-q:v', '3', thumb]);
    files[job.thumbnail] = thumb;
  }
  return { file: out, files, duration: round3(expected) };
}

async function render(spec, bin, work) {
  const src = spec.source.url;
  const jobs = spec.render?.jobs ?? [];
  if (!jobs.length) throw fail('no render jobs');
  const weights = jobs.map((j) => Math.max(1, j.kind === 'episode' ? (j.sourceDuration ?? 600) : Number(j.end) - Number(j.start)));
  const total = weights.reduce((a, b) => a + b, 0);
  let doneWeight = 0;
  const results = {};
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const onFraction = (f) => progress({ stage: `render:${job.name}`, pct: 1 + ((doneWeight + f * weights[i]) / total) * 89 });
    await progress({ stage: `render:${job.name}`, pct: 1 + (doneWeight / total) * 89 }, true);
    try {
      const r = job.kind === 'episode' ? await renderEpisode(bin, src, job, work, onFraction) : await renderShort(bin, src, job, work, spec.render.fontsDir, onFraction);
      results[job.name] = { ok: true, duration: r.duration, files: r.files ?? { [job.output]: r.file } };
    } catch (err) {
      results[job.name] = { ok: false, error: err.message, detail: err.detail ? String(err.detail).slice(-1500) : undefined };
    }
    doneWeight += weights[i];
  }
  // Upload.
  await progress({ stage: 'upload', pct: 91 }, true);
  const uploads = {};
  const all = Object.values(results).flatMap((r) => (r.ok ? Object.entries(r.files) : []));
  let n = 0;
  for (const [name, file] of all) {
    const target = spec.outputs?.[name];
    const stat = await fs.stat(file);
    try {
      uploads[name] = { ok: true, size: stat.size, ...(await upload(file, target)) };
    } catch (err) {
      uploads[name] = { ok: false, size: stat.size, error: err.message };
    }
    n++;
    await progress({ stage: 'upload', pct: 91 + (n / all.length) * 8 });
  }
  for (const r of Object.values(results)) {
    if (!r.ok) continue;
    for (const name of Object.keys(r.files)) if (!uploads[name]?.ok) Object.assign(r, { ok: false, error: `upload failed: ${uploads[name]?.error ?? 'no target'}` });
  }
  await progress({ stage: 'done', pct: 100 }, true);
  return { jobs: results, uploads };
}

const MIME = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.srt': 'application/x-subrip', '.json': 'application/json' };

async function upload(file, target) {
  if (!target) throw new Error('no output target');
  if (target.kind === 'file') {
    await fs.mkdir(path.dirname(target.path), { recursive: true });
    await fs.copyFile(file, target.path);
    return { path: target.path };
  }
  if (target.kind === 'blob') {
    const { put } = await import('@vercel/blob/client');
    const body = await openAsBlob(file);
    const res = await put(target.pathname, body, {
      access: 'private',
      token: target.clientToken,
      contentType: target.contentType ?? MIME[path.extname(file)] ?? 'application/octet-stream',
      multipart: body.size > 50 * 1024 * 1024,
    });
    return { pathname: res.pathname, url: res.url };
  }
  throw new Error(`unknown output kind ${target.kind}`);
}

// ---------------------------------------------------------------------------------------

async function main() {
  const [, , specPath, resultPath] = process.argv;
  if (!specPath || !resultPath) {
    console.error('usage: node runner.mjs <spec.json> <result.json>');
    process.exit(2);
  }
  const started = Date.now();
  let result;
  let spec = null;
  try {
    spec = JSON.parse(await fs.readFile(specPath, 'utf8'));
    if (spec.version !== RUNNER_VERSION) throw fail(`spec version ${spec.version} not supported`);
    const work = spec.workdir ?? path.join(path.dirname(path.resolve(resultPath)), 'work');
    await fs.mkdir(work, { recursive: true });
    progressFile = path.join(path.dirname(path.resolve(resultPath)), 'progress.json');
    const bin = ffmpegBin(spec);
    const data = spec.task === 'analyze' ? await analyze(spec, bin, work) : spec.task === 'render' ? await render(spec, bin, work) : (() => { throw fail(`unknown task ${spec.task}`); })();
    const ok = spec.task === 'render' ? Object.values(data.jobs).every((j) => j.ok) : true;
    result = { ok, partial: !ok && spec.task === 'render' && Object.values(data.jobs).some((j) => j.ok), task: spec.task, runnerVersion: RUNNER_VERSION, seconds: Math.round((Date.now() - started) / 1000), ...data };
    if (spec.cleanup !== false && spec.task === 'render') await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  } catch (err) {
    result = { ok: false, error: err.message, detail: err.detail ? String(err.detail).slice(-3000) : undefined, seconds: Math.round((Date.now() - started) / 1000) };
  }
  result.runId = spec?.runId;
  await fs.writeFile(resultPath, JSON.stringify(result));
  console.log(`WARD_RUNNER_RESULT ${result.ok ? 'ok' : 'failed'}`);
  // Hand the result straight back to the app (the app also polls, so a failed callback is harmless).
  if (spec?.callback) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(spec.callback, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(result), signal: AbortSignal.timeout(60_000) });
        if (res.ok) break;
        console.error(`callback answered ${res.status}`);
      } catch (err) {
        console.error(`callback failed: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  process.exit(result.ok || result.partial ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
