import { spawn, execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'outputs/terminal-remaster-review');
const profile = resolve(root, 'work/terminal-remaster-profile');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const samples = [['01-live-data',18],['02-ai-analysis',54],['03-unsafe-blocked',90],['04-safe-alternative',126],['05-human-approval',160],['06-paper-execution',192],['07-position-pnl',220],['08-hash-verified',238]];
await mkdir(output,{recursive:true}); await rm(profile,{recursive:true,force:true});
const browser=spawn(edge,['--headless=new','--no-sandbox','--disable-gpu-sandbox','--enable-unsafe-swiftshader','--remote-debugging-port=9345','--remote-allow-origins=*',`--user-data-dir=${profile}`,'--window-size=1920,1080','--hide-scrollbars','http://localhost:3001/?terminal=1'],{stdio:'ignore'});
const wait=(ms)=>new Promise(r=>setTimeout(r,ms)); let page;
for(let i=0;i<100;i++){try{const t=await fetch('http://127.0.0.1:9345/json').then(r=>r.json());page=t.find(x=>x.type==='page'&&x.url.includes('localhost:3001'));if(page)break}catch{}await wait(100)}
if(!page)throw new Error('Browser timeout'); const socket=new WebSocket(page.webSocketDebuggerUrl); await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true})});
let id=1;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(!m.id||!pending.has(m.id))return;const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)});const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=id++;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}))});
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
for(const [name,time] of samples){await cdp('Runtime.evaluate',{expression:`window.__setTowerTime(${time})`});await wait(350);const shot=await cdp('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await writeFile(resolve(output,`${name}.png`),Buffer.from(shot.data,'base64'))}
socket.close();browser.kill();
const ffmpeg=execFileSync('python',['-c','import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).trim();const inputs=samples.flatMap(([n])=>['-i',resolve(output,`${n}.png`)]);const filter=samples.map((_,i)=>`[${i}:v]scale=960:540[v${i}]`).join(';')+';[v0][v1][v2][v3][v4][v5][v6][v7]xstack=inputs=8:layout=0_0|960_0|0_540|960_540|0_1080|960_1080|0_1620|960_1620[out]';execFileSync(ffmpeg,['-y',...inputs,'-filter_complex',filter,'-map','[out]','-frames:v','1',resolve(output,'contact-sheet.png')],{stdio:'ignore'});process.stdout.write(`${output}\n`);
