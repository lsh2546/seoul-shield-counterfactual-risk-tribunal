import { spawn, execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'outputs/evidence-review-ai-verified');
const profile = resolve(root, 'work/evidence-review-profile');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const samples = [
  ['01-opening', 'opening', 1], ['02-gemini-verified', 'gemini', 55],
  ['03-unsafe-blocked', 'blocked', 162], ['04-safe-alternative', 'alternative', 150],
  ['05-order-gateway', 'order', 225], ['06-paper-pnl-pending', 'pnl', 232],
  ['07-hash-verified', 'audit', 238], ['08-ending', 'ending', 250],
];

await mkdir(output, { recursive: true });
await rm(profile, { recursive: true, force: true });
const browser = spawn(edge, [
  '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader',
  '--remote-debugging-port=9342', '--remote-allow-origins=*', `--user-data-dir=${profile}`,
  '--window-size=1920,1080', '--hide-scrollbars', '--use-angle=swiftshader',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  'http://localhost:3001/?reviewFrame=opening',
], { stdio: 'ignore' });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
let page;
for (let attempt = 0; attempt < 100; attempt += 1) {
  try {
    const targets = await fetch('http://127.0.0.1:9342/json').then((r) => r.json());
    page = targets.find((item) => item.type === 'page' && item.url.includes('localhost:3001'));
    if (page) break;
  } catch {}
  await wait(100);
}
if (!page) throw new Error('Timed out waiting for browser.');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((done, fail) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', fail, { once: true }); });
let nextId = 1;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const waiter = pending.get(message.id); pending.delete(message.id);
  if (message.error) waiter.reject(new Error(JSON.stringify(message.error))); else waiter.resolve(message.result);
});
const cdp = (method, params = {}) => new Promise((done, fail) => {
  const id = nextId++; pending.set(id, { resolve: done, reject: fail });
  socket.send(JSON.stringify({ id, method, params }));
});
await cdp('Page.enable'); await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

for (const [name, frame, seconds] of samples) {
  await cdp('Page.navigate', { url: `http://localhost:3001/?reviewFrame=${frame}` });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await cdp('Runtime.evaluate', { expression: "document.readyState === 'complete' && typeof window.__setTowerTime === 'function'", returnByValue: true });
    if (ready.result.value) break;
    if (attempt === 99) throw new Error(`Replay hook did not load for ${frame}.`);
    await wait(100);
  }
  await cdp('Runtime.evaluate', { expression: `window.__setTowerTime(${seconds})` });
  await wait(250);
  const shot = await cdp('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(resolve(output, `${name}.png`), Buffer.from(shot.data, 'base64'));
}
socket.close(); browser.kill();

const ffmpeg = execFileSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim();
const inputs = samples.flatMap(([name]) => ['-i', resolve(output, `${name}.png`)]);
const filter = samples.map((_, index) => `[${index}:v]scale=960:540[v${index}]`).join(';')
  + ';[v0][v1][v2][v3][v4][v5][v6][v7]xstack=inputs=8:layout=0_0|960_0|0_540|960_540|0_1080|960_1080|0_1620|960_1620[out]';
execFileSync(ffmpeg, ['-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-frames:v', '1', resolve(output, 'contact-sheet-8-scenes.png')], { stdio: 'ignore' });
process.stdout.write(`${output}\n`);
