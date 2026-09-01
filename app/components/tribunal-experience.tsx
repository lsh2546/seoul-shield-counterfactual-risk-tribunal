'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { Activity, Database, LockKeyhole, Pause, Play, RotateCcw, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Vector3, type Group } from 'three';

type Contract={symbol:string;exp:string;strike:number;bid:number;ask:number;iv:number;delta:number;gamma:number;theta:number;vega:number;bidSize:number;askSize:number};
const contracts:Contract[]=[
 ['SPY260904C00755000','09-04',755,12.40,12.63,.1598,.8128,.0210,-.4913,.2156,22,88],['SPY260904C00758000','09-04',758,9.86,9.94,.1482,.7582,.0263,-.5204,.2502,10,102],['SPY260904C00763000','09-04',763,5.89,6.03,.1307,.6226,.0363,-.5443,.3046,48,50],['SPY260904C00768000','09-04',768,2.94,2.97,.1183,.4271,.0413,-.4974,.3145,102,186],['SPY260904C00771000','09-04',771,1.71,1.72,.1129,.3004,.0384,-.4162,.2789,143,163],['SPY260904C00773000','09-04',773,1.16,1.17,.1116,.2263,.0336,-.3537,.2413,196,60],['SPY260904C00775000','09-04',775,.70,.71,.1077,.1567,.0278,-.2710,.1925,222,643],
 ['SPY260908C00757000','09-08',757,11.08,11.15,.1112,.7780,.0236,-.2928,.3374,67,45],['SPY260908C00761000','09-08',761,8.07,8.28,.1098,.6740,.0289,-.3310,.4086,42,71],['SPY260908C00766000','09-08',766,4.80,4.82,.1008,.5204,.0349,-.3237,.4518,112,36],['SPY260908C00768000','09-08',768,3.61,3.63,.0956,.4478,.0365,-.3017,.4485,70,120],['SPY260908C00771000','09-08',771,2.32,2.33,.0925,.3370,.0348,-.2648,.4140,40,50],['SPY260908C00772000','09-08',772,1.91,1.93,.0902,.2985,.0339,-.2443,.3933,155,157],
 ['SPY260909C00758000','09-09',758,10.78,10.81,.1148,.7367,.0236,-.3055,.3927,18,58],['SPY260909C00762000','09-09',762,7.87,7.98,.1114,.6372,.0280,-.3270,.4511,23,57],['SPY260909C00767000','09-09',767,4.61,4.63,.1006,.4892,.0330,-.3049,.4796,106,126],['SPY260909C00770000','09-09',770,3.05,3.16,.0960,.3866,.0332,-.2746,.4603,155,106],['SPY260909C00775000','09-09',775,1.39,1.41,.0908,.2238,.0274,-.1984,.3596,212,233],
 ['SPY260911C00755000','09-11',755,14.26,14.39,.1321,.7530,.0180,-.3081,.4198,30,51],['SPY260911C00761000','09-11',761,9.67,9.85,.1230,.6413,.0228,-.3258,.4968,96,109],['SPY260911C00768000','09-11',768,5.19,5.22,.1096,.4691,.0273,-.2987,.5288,133,153],['SPY260911C00770000','09-11',770,4.15,4.17,.1062,.4123,.0276,-.2808,.5175,181,61],['SPY260911C00773000','09-11',773,2.88,2.90,.1025,.3268,.0265,-.2481,.4796,148,134],
 ['SPY260918C00757000','09-18',757,14.39,14.84,.1265,.6893,.0164,-.2625,.6007,69,55],['SPY260918C00765000','09-18',765,8.97,8.98,.1150,.5513,.0202,-.2563,.6729,150,99],['SPY260918C00768000','09-18',768,7.35,7.39,.1138,.4901,.0206,-.2514,.6783,154,55],['SPY260918C00775000','09-18',775,3.97,3.98,.1053,.3384,.0204,-.2076,.6221,210,35]
].map(x=>({symbol:x[0] as string,exp:x[1] as string,strike:x[2] as number,bid:x[3] as number,ask:x[4] as number,iv:x[5] as number,delta:x[6] as number,gamma:x[7] as number,theta:x[8] as number,vega:x[9] as number,bidSize:x[10] as number,askSize:x[11] as number}));
const expiries=['09-04','09-08','09-09','09-11','09-18'];
const phases=[{t:0,name:'INGEST',sub:'MARKET FEED'},{t:12,name:'CLASSIFY',sub:'AI RISK MAP'},{t:28,name:'SELECT',sub:'SPREAD'},{t:44,name:'POLICIES',sub:'4 VERDICTS'},{t:60,name:'HARD GATE',sub:'ACCOUNT RISK'},{t:74,name:'PREVIEW',sub:'AUTHORITY'}];
const duration=86;
const policy=[['NO GUARD','APPROVE','4 / 4','$724'],['STATIC','REJECT','0 / 4','$0'],['ADAPTIVE','RESIZE','2 / 4','$362'],['LIVE','PREVIEW','2 / 4','$362']];

function xyz(c:Contract):[number,number,number]{const x=(c.strike-765)/2.35;const z=(expiries.indexOf(c.exp)-2)*1.15;const y=(c.iv-.09)*52;return[x,y,z]}
function Terrain({phase,selected,setSelected}:{phase:number;selected:Contract|null;setSelected:(c:Contract)=>void}){
 const group=useRef<Group>(null);const {camera}=useThree();
 useFrame(()=>{camera.position.lerp(new Vector3(7.7,7.2,9.2),.035);camera.lookAt(0,1,0);if(group.current)group.current.rotation.y=Math.sin(Date.now()/9000)*.035});
 return <group ref={group}>
  <gridHelper args={[14,14,'#244448','#112528']} position={[0,0,0]}/>
  <Line points={[[-5.8,0,0],[5.8,0,0]]} color="#8aa3a5"/><Line points={[[0,0,-3.5],[0,0,3.5]]} color="#8aa3a5"/><Line points={[[0,0,0],[0,4.2,0]]} color="#8aa3a5"/>
  {contracts.map(c=>{const p=xyz(c),spread=(c.ask-c.bid)/((c.ask+c.bid)/2),rejected=spread>.025;const chosen=c.strike===768&&c.exp==='09-04'||c.strike===773&&c.exp==='09-04';const color=chosen?'#ffcf62':rejected?'#ff5b52':spread<.01?'#52e0a4':'#59a9d8';return <group key={c.symbol} position={p} onClick={e=>{e.stopPropagation();setSelected(c)}}><mesh position={[0,-p[1]/2,0]} scale={[.055,Math.max(.03,p[1]/2),.055]}><boxGeometry/><meshBasicMaterial color={color} transparent opacity={phase<1?.35:.8}/></mesh><mesh scale={chosen?.15:.08}><sphereGeometry args={[1,12,12]}/><meshBasicMaterial color={color}/></mesh>{chosen&&phase>=2&&<mesh scale={.27}><torusGeometry args={[1,.08,8,32]}/><meshBasicMaterial color="#ffcf62"/></mesh>}</group>})}
  {phase>=2&&<Line points={[xyz(contracts[3]),xyz(contracts[5])]} color="#ffcf62" lineWidth={4}/>} 
  <Html position={[-5.9,-.2,3.4]} className="axis">STRIKE →</Html><Html position={[-.2,-.2,-3.8]} className="axis">EXPIRATION →</Html><Html position={[-.2,4.35,0]} className="axis">IV</Html>
  {selected&&<Html position={xyz(selected)} className="point-tip"><b>{selected.strike}C · {selected.exp}</b><span>IV {(selected.iv*100).toFixed(2)}% · Δ {selected.delta}</span><span>${selected.bid.toFixed(2)} / ${selected.ask.toFixed(2)}</span></Html>}
  <OrbitControls enablePan={false} minDistance={8} maxDistance={16}/>
 </group>
}

function phaseFor(t:number){for(let i=phases.length-1;i>=0;i--)if(t>=phases[i].t)return i;return 0}

export default function TribunalExperience(){
 const[elapsed,setElapsed]=useState(0),[playing,setPlaying]=useState(true),[selected,setSelected]=useState<Contract|null>(null),[policyIndex,setPolicyIndex]=useState(2);const phase=phaseFor(elapsed);const chosen=selected??contracts[3];
 useEffect(()=>{if(!playing)return;const id=setInterval(()=>setElapsed(v=>v>=duration?0:v+.25),250);return()=>clearInterval(id)},[playing]);
 const spreadPct=((chosen.ask-chosen.bid)/((chosen.ask+chosen.bid)/2)*100).toFixed(2);const midpoint=((chosen.ask+chosen.bid)/2).toFixed(2);
 const factors=useMemo(()=>[['Opportunity','+18','Bullish debit structure; defined loss'],['Volatility Risk','−9',`IV ${(chosen.iv*100).toFixed(2)}%`],['Liquidity Risk','+16',`Spread ${spreadPct}% · ${chosen.bidSize}/${chosen.askSize}`],['Trend / Regime','−4','30D close: 765.72 · mixed'],['Portfolio Conflict','N/A','Account not connected'],['Event / Data Risk','−6','Open interest unavailable'],['Final Confidence','68 / 100','Qualified for risk gates']], [chosen,spreadPct]);
 return <main className="risk-system">
  <header><div className="brand"><ShieldCheck/> SEOUL SHIELD <b>OPTIONS RISK TERRAIN</b></div><div className="source"><i/> REPLAY VERIFIED · ALPACA MCP · 14:41:57 UTC</div><button onClick={()=>setPlaying(!playing)}>{playing?<Pause/>:<Play/>}{playing?'PAUSE':'RESUME'}</button></header>
  <section className="market-strip"><div><small>SPY UNDERLYING</small><strong>$765.72</strong><span>31 AUG · IEX</span></div><div><small>MARKET</small><strong className="positive">OPEN</strong><span>Clock verified</span></div><div><small>CHAIN INGESTED</small><strong>193</strong><span>Indicative feed</span></div><div><small>REALIZED VOL</small><strong>UNAVAILABLE</strong><span>Not calculated in evidence</span></div><div><small>ACCOUNT</small><strong>UNAVAILABLE</strong><span>Not connected</span></div></section>
  <section className="workspace">
   <div className="terrain-panel"><div className="panel-title"><div><Activity/> OPTIONS RISK TERRAIN</div><span>X STRIKE · Y EXPIRATION · Z IV</span></div><Canvas camera={{position:[7.7,7.2,9.2],fov:43}} dpr={[1,1.4]}><ambientLight intensity={.7}/><pointLight position={[0,7,2]} intensity={16} color="#83eff7"/><Terrain phase={phase} selected={selected} setSelected={c=>{setSelected(c);setPlaying(false)}}/></Canvas><div className="legend"><span className="good">● NARROW SPREAD</span><span className="mid">● ACCEPTABLE</span><span className="bad">● FILTERED</span><span className="pick">◎ SELECTED LEGS</span></div>{phase>=2&&<div className="spread-card"><small>SELECTED DEBIT SPREAD</small><b>BUY 768C <i/> SELL 773C</b><span>SEP 04 · MID DEBIT $1.81 · WIDTH $5.00</span></div>}</div>
   <aside className="analysis-panel"><div className="panel-title"><div><Database/> DECISION EVIDENCE</div><span>{phases[phase].name}</span></div><div className="contract-head"><div><small>FOCUSED CONTRACT</small><b>{chosen.strike} CALL · {chosen.exp}</b></div><em>TRADABLE</em></div><div className="quote-grid"><div><small>BID / ASK</small><b>${chosen.bid.toFixed(2)} / ${chosen.ask.toFixed(2)}</b></div><div><small>MIDPOINT</small><b>${midpoint}</b></div><div><small>SPREAD</small><b>{spreadPct}%</b></div><div><small>QUOTE SIZE</small><b>{chosen.bidSize} / {chosen.askSize}</b></div><div><small>IV</small><b>{(chosen.iv*100).toFixed(2)}%</b></div><div><small>DELTA</small><b>{chosen.delta}</b></div></div><div className="greeks"><span>Γ {chosen.gamma}</span><span>Θ {chosen.theta}</span><span>V {chosen.vega}</span><span>OI UNAVAILABLE</span></div><div className="ai-block"><small>AI STRUCTURED CLASSIFICATION</small>{factors.map(([k,v,n])=><div key={k}><b>{k}</b><em className={v.startsWith('+')?'up':v.startsWith('−')?'down':''}>{v}</em><span>{n}</span></div>)}</div></aside>
  </section>
  <section className={`pipeline phase-${phase}`}><span>MARKET FEED</span><i>1</i><span>CLASSIFY</span><i>2</i><span>64 CANDIDATES</span><i>3</i><span>21 FILTERED</span><i>4</i><span>768/773 SPREAD</span><i>5</i><span>RISK GATES</span><i>6</i><span>PREVIEW</span></section>
  <section className={`policy-dock ${phase>=3?'show':''}`}>{policy.map((p,i)=><button key={p[0]} className={policyIndex===i?'active':''} onClick={()=>{setPolicyIndex(i);setPlaying(false)}}><small>{p[0]}</small><b>{p[1]}</b><span>CONTRACTS {p[2]}</span><span>MAX LOSS {p[3]}</span>{i===3&&<LockKeyhole/>}</button>)}</section>
  <section className={`account-gate ${phase>=4?'show':''}`}><div><small>TRADE RISK LIMIT</small><b>$1,000 · 1.0%</b><em>PASS · $362</em></div><div><small>PORTFOLIO RISK</small><b>UNAVAILABLE</b><em>ACCOUNT NOT CONNECTED</em></div><div><small>DAILY LOSS STOP</small><b>UNAVAILABLE</b><em>ACCOUNT NOT CONNECTED</em></div><div><small>EXECUTION AUTHORITY</small><b>PREVIEW ONLY</b><em>HUMAN APPROVAL REQUIRED</em></div></section>
  <footer><button onClick={()=>{setElapsed(0);setPlaying(true);setSelected(null)}}><RotateCcw/> RESET</button><div className="phase-nav">{phases.map((p,i)=><button className={phase===i?'active':''} key={p.name} onClick={()=>{setElapsed(p.t+.2);setPlaying(false)}}>{p.name}<small>{p.sub}</small></button>)}</div><div className="progress"><i style={{width:`${elapsed/duration*100}%`}}/></div><span>{Math.floor(elapsed)} / {duration}s</span></footer>
 </main>
}
