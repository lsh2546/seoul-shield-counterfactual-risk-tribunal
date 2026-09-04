import { execFileSync, spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const segmentStart = Number(process.env.SEOUL_SHIELD_SEGMENT_START ?? 0);
const segmentEnd = Number(process.env.SEOUL_SHIELD_SEGMENT_END ?? 260);
const output = resolve(root, process.env.SEOUL_SHIELD_SEGMENT_OUTPUT ?? 'outputs/previews/Seoul-Shield-CINEMATIC-REMASTER-4m20s.mp4');
const narration = resolve(root, process.env.SEOUL_SHIELD_NARRATION ?? 'outputs/previews/seoul-shield-temp-female-narration.wav');
const subtitleWork = resolve(root, 'work/guided-demo-audio');
const profile = resolve(root, process.env.SEOUL_SHIELD_CAPTURE_PROFILE ?? 'work/tower-capture-profile');
const edge = process.env.SEOUL_SHIELD_BROWSER_EXECUTABLE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const debuggingPort = Number(process.env.SEOUL_SHIELD_DEBUGGING_PORT ?? 9334);
const ffmpeg = execFileSync(
  'python',
  ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],
  { encoding: 'utf8' },
).trim();
// Capture deterministically at 15 unique WebGL frames per second and encode a
// constant 30 fps delivery file. This keeps the final container requirement
// while avoiding redundant browser screenshots for held/slow narration shots.
const fps = Number(process.env.SEOUL_SHIELD_CAPTURE_FPS ?? 15);
const frames = Math.round((segmentEnd - segmentStart) * fps);

await mkdir(dirname(output), { recursive: true });
await rm(profile, { recursive: true, force: true });
const browser = spawn(edge, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu-sandbox',
  `--remote-debugging-port=${debuggingPort}`,
  '--remote-allow-origins=*',
  `--user-data-dir=${profile}`,
  '--window-size=1920,1080',
  '--hide-scrollbars',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  'http://localhost:3001/',
], { stdio: 'ignore' });
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

let page;
for (let attempt = 0; attempt < 100; attempt += 1) {
  try {
    const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json`).then((response) => response.json());
    page = targets.find((item) => item.type === 'page' && item.url.includes('localhost:3001'));
    if (page) break;
  } catch {}
  await wait(100);
}
if (!page) throw new Error('Timed out waiting for the browser target.');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => {
  socket.addEventListener('open', resolveOpen, { once: true });
  socket.addEventListener('error', rejectOpen, { once: true });
});
let nextId = 1;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const waiter = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
  else waiter.resolve(message.result);
});
const cdp = (method, params = {}) => new Promise((resolveCall, rejectCall) => {
  const id = nextId++;
  pending.set(id, { resolve: resolveCall, reject: rejectCall });
  socket.send(JSON.stringify({ id, method, params }));
});
await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
for (let attempt = 0; attempt < 100; attempt += 1) {
  const ready = await cdp('Runtime.evaluate', {
    expression: "document.readyState === 'complete' && typeof window.__setTowerTime === 'function'",
    returnByValue: true,
  });
  if (ready.result.value) break;
  if (attempt === 99) throw new Error('Tower replay hook did not load.');
  await wait(100);
}
const encoder = spawn(ffmpeg, [
  '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', 'pipe:0', '-ss', String(segmentStart), '-i', narration,
  '-vf', `setpts=PTS+${segmentStart}/TB,subtitles=review.srt:force_style='FontName=Arial,FontSize=11.5,PrimaryColour=&H00FFFFFF,OutlineColour=&H00102038,BackColour=&H99000000,BorderStyle=3,Outline=1,Shadow=1,MarginV=34,Alignment=2',setpts=PTS-${segmentStart}/TB`,
  '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.1', '-preset', 'slow',
  '-crf', '18', '-r', '30', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-ac', '1', '-ar', '48000', '-b:a', '192k', '-t', String(segmentEnd - segmentStart), '-movflags', '+faststart', output,
], { cwd: subtitleWork, stdio: ['pipe', 'ignore', 'pipe'] });
let errors = '';
encoder.stderr.on('data', (chunk) => { errors += chunk.toString(); });
for (let frame = 0; frame < frames; frame += 1) {
  await cdp('Runtime.evaluate', { expression: `window.__setTowerTime(${segmentStart + frame / fps})` });
  await wait(12);
  const capture = await cdp('Page.captureScreenshot', {
    format: 'jpeg', quality: 100, fromSurface: true, captureBeyondViewport: false,
  });
  if (!encoder.stdin.write(Buffer.from(capture.data, 'base64'))) {
    await new Promise((resolveDrain) => encoder.stdin.once('drain', resolveDrain));
  }
}
encoder.stdin.end();
const exitCode = await new Promise((resolveExit) => encoder.once('close', resolveExit));
socket.close();
browser.kill();
if (exitCode !== 0) throw new Error(`ffmpeg failed (${exitCode}): ${errors}`);
process.stdout.write(`${output}\n`);
