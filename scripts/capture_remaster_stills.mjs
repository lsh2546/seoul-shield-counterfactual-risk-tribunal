import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'outputs/remaster-final/preflight-4frames');
const profile = resolve(root, 'work/remaster-stills-profile');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const samples = [
  ['01-four-future-overview', 195], ['02-static-guard', 213],
  ['03-live-execution', 231], ['04-clean-ending', 250],
];

await mkdir(output, { recursive: true });
await rm(profile, { recursive: true, force: true });
const browser = spawn(edge, [
  '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--remote-debugging-port=9336', '--remote-allow-origins=*',
  `--user-data-dir=${profile}`, '--window-size=1920,1080', '--hide-scrollbars',
  '--use-angle=swiftshader', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', 'http://localhost:3001/',
], { stdio: 'ignore' });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
let page;
for (let attempt = 0; attempt < 100; attempt += 1) {
  try {
    const targets = await fetch('http://127.0.0.1:9336/json').then((r) => r.json());
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
for (let attempt = 0; attempt < 100; attempt += 1) {
  const ready = await cdp('Runtime.evaluate', { expression: "document.readyState === 'complete' && typeof window.__setTowerTime === 'function'", returnByValue: true });
  if (ready.result.value) break;
  if (attempt === 99) {
    const debug = await cdp('Runtime.evaluate', { expression: "({body: document.body.innerText.slice(0,1000), html: document.documentElement.outerHTML.slice(0,500)})", returnByValue: true });
    throw new Error(`Replay hook did not load: ${JSON.stringify(debug.result.value)}`);
  }
  await wait(100);
}
for (const [name, seconds] of samples) {
  await cdp('Runtime.evaluate', { expression: `window.__setTowerTime(${seconds})` });
  await wait(180);
  const shot = await cdp('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(resolve(output, `${name}.png`), Buffer.from(shot.data, 'base64'));
}
socket.close(); browser.kill();
process.stdout.write(`${output}\n`);
