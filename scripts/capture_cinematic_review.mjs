import { spawn, execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const app = resolve(root, 'app');
const out = resolve(root, 'outputs/cinematic-remaster-review');
const profile = resolve(root, 'work/cinematic-remaster-profile');
const url = 'http://127.0.0.1:8788';
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const samples = [['01-ai-proposed',16],['02-risk-vetoed',52],['03-safe-alternative',92],['04-human-approval',132],['05-paper-execution-pending',172],['06-position-pnl-pending',212],['07-hash-evidence',238]];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

await mkdir(out, { recursive: true });
await rm(profile, { recursive: true, force: true });
execFileSync('cmd.exe', ['/d', '/s', '/c', 'npm run build'], { cwd: app, stdio: 'inherit' });
const wrangler = resolve(app, 'node_modules/wrangler/bin/wrangler.js');
const server = spawn(process.execPath, [wrangler, 'dev', '--config', 'dist/server/wrangler.json', '--port', '8788'], { cwd: app, stdio: 'ignore' });
let serverReady = false;
for (let i = 0; i < 120; i++) {
  try { serverReady = (await fetch(url)).ok; } catch {}
  if (serverReady) break;
  await wait(250);
}
if (!serverReady) throw Error('production server did not become ready');

const browser = spawn(edge, ['--headless=new','--no-sandbox','--disable-gpu-sandbox','--remote-debugging-port=9347','--remote-allow-origins=*',`--user-data-dir=${profile}`,'--window-size=1920,1080','--hide-scrollbars',`${url}/?cinematic=1`], { stdio: 'ignore' });
let page;
for (let i = 0; i < 100; i++) {
  try { page = (await fetch('http://127.0.0.1:9347/json').then((response) => response.json())).find((item) => item.type === 'page' && item.url.includes('127.0.0.1:8788')); } catch {}
  if (page) break;
  await wait(100);
}
if (!page) throw Error('browser did not become ready');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((done, fail) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', fail, { once: true }); });
let id = 1;
const pending = new Map();
socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); if (!message.id || !pending.has(message.id)) return; const job = pending.get(message.id); pending.delete(message.id); message.error ? job.reject(Error(JSON.stringify(message.error))) : job.resolve(message.result); });
const call = (method, params = {}) => new Promise((resolveCall, reject) => { const callId = id++; pending.set(callId, { resolve: resolveCall, reject }); socket.send(JSON.stringify({ id: callId, method, params })); });
const evaluate = async (expression) => (await call('Runtime.evaluate', { expression, returnByValue: true })).result.value;
const waitForReady = async (stage) => {
  for (let i = 0; i < 120; i++) {
    const selector = `[data-render-ready="true"][data-render-stage="${stage}"]`;
    if (await evaluate(`Boolean(window.__setTowerTime && document.querySelector('${selector}'))`)) return;
    await wait(100);
  }
  throw Error(`render-ready DOM signal missing: ${stage}`);
};

await call('Page.enable');
await call('Runtime.enable');
await call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await waitForReady('proposed');
for (const [name, time] of samples) {
  await evaluate(`window.__setTowerTime(${time})`);
  const expected = time < 32 ? 'proposed' : time < 72 ? 'vetoed' : time < 112 ? 'alternative' : time < 150 ? 'approval' : time < 195 ? 'execution' : time < 225 ? 'position' : 'verified';
  await waitForReady(expected);
  await wait(120);
  const shot = await call('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(resolve(out, `${name}.png`), Buffer.from(shot.data, 'base64'));
}
await call('Page.navigate', { url: `${url}/?thumbnail=1` });
await waitForReady('thumbnail');
const thumb = await call('Page.captureScreenshot', { format: 'png', fromSurface: true });
await writeFile(resolve(out, '08-thumbnail.png'), Buffer.from(thumb.data, 'base64'));
socket.close();
browser.kill();
try { execFileSync('taskkill.exe', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}

const ffmpeg = execFileSync('python', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim();
const names = [...samples.map(([name]) => name), '08-thumbnail'];
const inputs = names.flatMap((name) => ['-i', resolve(out, `${name}.png`)]);
const filter = names.map((_, i) => `[${i}:v]scale=960:540[v${i}]`).join(';') + ';[v0][v1][v2][v3][v4][v5][v6][v7]xstack=inputs=8:layout=0_0|960_0|0_540|960_540|0_1080|960_1080|0_1620|960_1620[out]';
execFileSync(ffmpeg, ['-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-frames:v', '1', resolve(out, 'contact-sheet.png')], { stdio: 'ignore' });
console.log(out);
