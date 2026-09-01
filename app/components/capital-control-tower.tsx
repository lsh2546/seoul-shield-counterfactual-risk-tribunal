'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Activity, Database, Play, ShieldCheck } from 'lucide-react';
import { Color, InstancedMesh, Object3D, Vector3 } from 'three';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Classification = 'OPPORTUNITY' | 'UNCERTAIN' | 'RISK BLOCKED';
type Point = {
  symbol: string;
  expiration: string;
  strike: number;
  bid: number;
  ask: number;
  iv: number | null;
  open_interest: number;
  quote_age_seconds: number | null;
  classification: Classification;
  classification_reason?: string;
};
type Preview = {
  generated_at: string;
  evidence_status: string;
  ai_status: string;
  account: {
    environment: string;
    cash: number;
    equity: number;
    buying_power: number;
    options_level: number;
    positions: number;
    open_orders: number;
    daily_pnl: number;
  };
  market: {
    symbol: string;
    underlying_price: number;
    underlying_timestamp: string;
    expiration: string;
  };
  terrain: Point[];
  selection: {
    long: Point;
    short: Point;
    net_debit: number;
    requested_contracts: number;
    max_loss: number;
  };
  risk: { trade_risk_limit: number };
};

const DURATION = 42;
const PALETTE: Record<Classification, string> = {
  OPPORTUNITY: '#39ff88',
  UNCERTAIN: '#ffc928',
  'RISK BLOCKED': '#ff3f46',
};
const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const ease = (value: number) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};

const PANEL_POSITIONS: [number, number, number][] = [
  [-6.7, 3.2, -2.4],
  [-3.8, 4.8, -6.8],
  [0, 5.4, -9],
  [3.8, 4.8, -6.2],
  [6.7, 3.2, -2.8],
  [-6.9, -2.1, -3.2],
  [-3.8, -3.8, -7.4],
  [0, -4.5, -9.4],
  [3.8, -3.8, -6.8],
  [6.9, -2.1, -3.5],
];

function Panel({
  position,
  label,
  value,
  unit,
  active,
}: {
  position: [number, number, number];
  label: string;
  value: string;
  unit: string;
  active: boolean;
}) {
  return (
    <Html position={position} transform distanceFactor={6.8} occlude={false}>
      <div className={`tower-market-panel ${active ? 'active' : ''}`}>
        <small>{label}</small>
        <b>{value}</b>
        <span>{unit}</span>
      </div>
    </Html>
  );
}

function DataStreams({ time }: { time: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame(() => {
    if (!mesh.current) return;
    const progress = ease((time - 2) / 7);
    for (let i = 0; i < 90; i += 1) {
      const origin = PANEL_POSITIONS[i % PANEL_POSITIONS.length];
      const phase = ((time * 1.25 + i * 0.093) % 1 + 1) % 1;
      const travel = clamp(phase * progress);
      const curve = Math.sin(travel * Math.PI) * (origin[0] > 0 ? 1 : -1);
      dummy.position.set(
        origin[0] * (1 - travel) + curve * 0.75,
        origin[1] * (1 - travel) + Math.sin(travel * Math.PI) * 0.7,
        origin[2] * (1 - travel) - 0.4,
      );
      dummy.lookAt(0, 0, 0);
      dummy.scale.set(0.055, 0.055, 0.55 + progress * 0.65);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 90]} frustumCulled={false}>
      <boxGeometry />
      <meshBasicMaterial color="#f3ffff" transparent opacity={0.88} />
    </instancedMesh>
  );
}

function CameraRig({ time }: { time: number }) {
  const { camera } = useThree();
  useFrame(() => {
    const target =
      time < 2.5
        ? new Vector3(0, 0.7, 14)
        : time < 13.5
          ? new Vector3(Math.sin(time * 0.38) * 2.2, 1.1, 11.2)
          : time < 24
            ? new Vector3(0, 5.8, 13.8)
            : time < 29
              ? new Vector3(0, 2.8, 12.4)
              : time < 37
                ? new Vector3(0, 1.2, 11.2)
                : new Vector3(0, 7.2, 15.5);
    camera.position.lerp(target, 0.045);
    camera.lookAt(0, time >= 37 ? 0 : time >= 13.5 ? 0 : 0.4, time >= 24 ? -3 : -2.2);
  });
  return null;
}

function ConvergenceScene({ data, time }: { data: Preview; time: number }) {
  const opportunities = useMemo(
    () => data.terrain.filter((point) => point.classification === 'OPPORTUNITY').slice(0, 21),
    [data],
  );
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const stage = time < 25 ? 21 : time < 26 ? 8 : time < 27 ? 4 : 2;
  useFrame(() => {
    if (!mesh.current) return;
    opportunities.forEach((point, index) => {
      const survives = index < stage;
      if (stage === 2 && survives) {
        dummy.position.set(index === 0 ? -2.8 : 2.8, 0.4, -1.2);
        dummy.scale.set(2.2, 0.9, 0.12);
      } else if (survives) {
        dummy.position.set((index - (stage - 1) / 2) * 0.72, 0.4, -2 - index * 0.28);
        dummy.scale.set(0.65, 0.18, 0.08);
      } else {
        dummy.position.set(index % 2 ? 6.8 : -6.8, -2.5 + (index % 5) * 0.35, -4 - index * 0.15);
        dummy.scale.set(0.42, 0.1, 0.05);
      }
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
      mesh.current!.setColorAt(
        index,
        new Color(survives ? (time < 24.7 ? '#28ff9a' : '#23c8ff') : '#718093'),
      );
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  const gates = ['EXPIRATION', 'STRIKE ORDER', 'OPEN INTEREST', 'LIQUIDITY', 'DEFINED RISK'];
  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, opportunities.length]} frustumCulled={false}>
        <boxGeometry args={[1.45, 0.65, 0.08]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {gates.map((gate, index) => (
        <group key={gate} position={[0, 0, -8 + index * 1.65]}>
          <mesh><torusGeometry args={[3.1, 0.035, 10, 80]} /><meshBasicMaterial color={index < Math.min(5, Math.floor((time - 24) * 1.25)) ? '#23c8ff' : '#8fa7bb'} /></mesh>
          <Html position={[3.45, 0.25, 0]} transform distanceFactor={7} occlude={false}><b className="convergence-gate-label">{gate}</b></Html>
        </group>
      ))}
      {stage === 2 && (
        <>
          <Html position={[-2.8, 0.4, -1]} transform distanceFactor={6} occlude={false}><div className="contract-leg-panel"><small>LONG LEG</small><b>BUY SPY 765C</b><span>ASK ${data.selection.long.ask.toFixed(2)} · OI {data.selection.long.open_interest.toLocaleString()}</span></div></Html>
          <Html position={[2.8, 0.4, -1]} transform distanceFactor={6} occlude={false}><div className="contract-leg-panel short"><small>SHORT LEG</small><b>SELL SPY 770C</b><span>BID ${data.selection.short.bid.toFixed(2)} · OI {data.selection.short.open_interest.toLocaleString()}</span></div></Html>
        </>
      )}
    </>
  );
}

function RiskAndTribunalScene({ time }: { time: number }) {
  if (time < 29) return null;
  if (time < 33) {
    return (
      <group>
        <mesh position={[0, 0, -2]} scale={[5.2, 0.025, 0.025]}><boxGeometry /><meshBasicMaterial color="#ffd21f" /></mesh>
        <Html position={[-4.2, 1, -2]} transform distanceFactor={6} occlude={false}><div className="risk-leg-orb">BUY 765C</div></Html>
        <Html position={[4.2, 1, -2]} transform distanceFactor={6} occlude={false}><div className="risk-leg-orb">SELL 770C</div></Html>
      </group>
    );
  }
  if (time < 37) {
    const close = ease((time - 33.6) / 0.8);
    return (
      <group position={[0, 0, -2]}>
        <mesh position={[-5 + close * 2.7, 0, 0]} scale={[2.2, 4, 0.16]}><boxGeometry /><meshBasicMaterial color="#ff314a" transparent opacity={0.82} /></mesh>
        <mesh position={[5 - close * 2.7, 0, 0]} scale={[2.2, 4, 0.16]}><boxGeometry /><meshBasicMaterial color="#ff314a" transparent opacity={0.82} /></mesh>
      </group>
    );
  }
  const paths = [
    { x: -6, color: '#ff314a', title: 'NO GUARD', detail: '4 CONTRACTS · $1,096 EXPOSURE · SHADOW ONLY' },
    { x: -2, color: '#23c8ff', title: 'STATIC GUARD', detail: '$1,000 LIMIT · BLOCKED' },
    { x: 2, color: '#b26cff', title: 'ADAPTIVE GUARD', detail: 'STALE QUOTE · FALLBACK AI · BLOCKED' },
    { x: 6, color: '#ffd21f', title: 'LIVE EXECUTION', detail: 'HUMAN APPROVAL REQUIRED · NOT SUBMITTED' },
  ];
  return (
    <>
      {paths.map((path) => (
        <group key={path.title} position={[path.x, 0, -5]}>
          <mesh scale={[1.25, 0.07, 8]}><boxGeometry /><meshBasicMaterial color={path.color} /></mesh>
          <Html position={[0, 2.2, 1]} transform distanceFactor={7} occlude={false}><div className="future-path-label" style={{ borderColor: path.color }}><b>{path.title}</b><span>{path.detail}</span></div></Html>
        </group>
      ))}
    </>
  );
}

function ContractFlow({ data, time }: { data: Preview; time: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const colors = useMemo(
    () => data.terrain.map((point) => new Color(PALETTE[point.classification])),
    [data],
  );
  useFrame(() => {
    if (!mesh.current) return;
    data.terrain.forEach((point, index) => {
      const side = index % 2 ? 1 : -1;
      if (time < 13.5) {
        const z = -24 + ((time * 12 + index * 0.61) % 34);
        dummy.position.set(
          side * (1.3 + (index % 7) * 0.18),
          (((index * 5) % 17) - 8) * 0.12,
          z,
        );
        dummy.scale.set(0.72, 0.08, 0.16);
      } else {
        const lane =
          point.classification === 'OPPORTUNITY'
            ? 3.3
            : point.classification === 'UNCERTAIN'
              ? 0
              : -3.3;
        const spread = ease((time - 13.5) / 3.5);
        const x = ((index % 21) - 10) * 0.42;
        const y = lane * spread;
        const z = -8 + Math.floor(index / 21) * 0.7;
        dummy.position.set(x, y, z);
        dummy.scale.set(
          point.classification === 'OPPORTUNITY' ? 0.78 : 0.58,
          point.classification === 'UNCERTAIN' ? 0.1 : 0.14,
          point.classification === 'RISK BLOCKED' ? 0.14 : 0.05,
        );
      }
      dummy.rotation.set(-0.08, 0, 0);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
      mesh.current!.setColorAt(index, colors[index]);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, data.terrain.length]}
      frustumCulled={false}
    >
      <boxGeometry args={[1.5, 0.65, 0.08]} />
      <meshBasicMaterial transparent opacity={0.9} toneMapped={false} />
    </instancedMesh>
  );
}

function TowerScene({ data, time }: { data: Preview; time: number }) {
  const panels = [
    ['SPY UNDERLYING', `$${data.market.underlying_price.toFixed(2)}`, 'PRICE · VERIFIED'],
    ['OPTION CHAIN', data.terrain.length.toString(), 'CALL CONTRACTS'],
    ['EXPIRATION', data.market.expiration.slice(5), 'YYYY-MM-DD'],
    ['BID / ASK', 'LIVE QUOTES', 'SNAPSHOT'],
    ['QUOTE AGE', 'STALE', '> 30 SECONDS'],
    ['IMPLIED VOL', '12.7–13.6%', 'SELECTED LEGS'],
    ['OPEN INTEREST', '1,909 / 4,486', '765C / 770C'],
    ['ACCOUNT EQUITY', `$${data.account.equity.toLocaleString()}`, 'PAPER'],
    ['BUYING POWER', `$${data.account.buying_power.toLocaleString()}`, 'PAPER'],
    ['OPTIONS LEVEL', data.account.options_level.toString(), 'MLEG ENABLED'],
  ];
  const active = time >= 2.5;
  const classify = time >= 13.5;
  return (
    <>
      <CameraRig time={time} />
      <ambientLight intensity={1.25} />
      <directionalLight position={[0, 9, 7]} intensity={3.5} color="#efffff" />
      <pointLight position={[0, 1, 3]} intensity={62} color="#73ddff" distance={22} />
      <gridHelper args={[34, 34, '#3f87ba', '#24527d']} position={[0, -4.7, -4]} />
      <mesh position={[0, -4.64, -4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[34, 34]} />
        <meshStandardMaterial color="#123d62" transparent opacity={0.32} metalness={0.7} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0, -0.4]}>
        <cylinderGeometry args={[1.55, 1.55, 3.5, 64, 1, true]} />
        <meshPhysicalMaterial color="#8de9ff" transparent opacity={0.22} roughness={0.1} metalness={0.15} side={2} />
      </mesh>
      <mesh position={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.22, 0.22, 3.2, 24, 1, true]} />
        <meshBasicMaterial color="#eaffff" transparent opacity={0.95} />
      </mesh>
      {[
        { y: 1.15, radius: 2.1, label: 'MARKET' },
        { y: 0, radius: 2.55, label: 'LIQUIDITY' },
        { y: -1.15, radius: 2.95, label: 'RISK' },
      ].map((ring, index) => (
        <group key={ring.label} position={[0, ring.y, -0.4]} rotation={[Math.PI / 2, 0, time * (index % 2 ? -0.2 : 0.22)]}>
          <mesh>
            <torusGeometry args={[ring.radius, 0.055, 14, 112]} />
            <meshBasicMaterial color={index === 1 ? '#ffffff' : '#23c8ff'} />
          </mesh>
          <Html position={[ring.radius + 0.35, 0, 0]} transform distanceFactor={6} occlude={false}>
            <b className="engine-ring-label">{ring.label}</b>
          </Html>
        </group>
      ))}
      {!classify &&
        panels.map(([label, value, unit], index) => (
          <Panel
            key={label}
            position={PANEL_POSITIONS[index]}
            label={label}
            value={value}
            unit={unit}
            active={active}
          />
        ))}
      {active && !classify && <DataStreams time={time} />}
      {time >= 6 && time < 24 && <ContractFlow data={data} time={time} />}
      {classify && time < 24 &&
        [
          { y: 3.3, color: PALETTE.OPPORTUNITY },
          { y: 0, color: PALETTE.UNCERTAIN },
          { y: -3.3, color: PALETTE['RISK BLOCKED'] },
        ].map((lane) => (
          <mesh key={lane.y} position={[0, lane.y, -4]} scale={[6.2, 0.025, 8]}>
            <boxGeometry />
            <meshBasicMaterial color={lane.color} transparent opacity={0.22} />
          </mesh>
        ))}
      {time >= 24 && time < 29 && <ConvergenceScene data={data} time={time} />}
      <RiskAndTribunalScene time={time} />
    </>
  );
}

export default function CapitalControlTower() {
  const [data, setData] = useState<Preview | null>(null);
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    void fetch('/data/preview.json', { cache: 'no-store' })
      .then((response) => response.json() as Promise<Preview>)
      .then(setData);
  }, []);
  const run = useCallback(() => {
    setTime(0);
    setRunning(true);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run]);
  useEffect(() => {
    const target = window as typeof window & {
      __setTowerTime?: (value: number) => void;
    };
    target.__setTowerTime = (value) => {
      setTime(clamp(value, 0, DURATION - 0.001));
      setRunning(false);
    };
    return () => {
      delete target.__setTowerTime;
    };
  }, []);
  useEffect(() => {
    if (!running) return;
    let previous = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      setTime((value) => {
        const next = value + (now - previous) / 1000;
        if (next >= DURATION) {
          queueMicrotask(() => setRunning(false));
          return DURATION - 0.001;
        }
        return next;
      });
      previous = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running]);
  if (!data)
    return (
      <main className="tower-loading">
        <Activity /> LOADING VERIFIED REPLAY
      </main>
    );
  const counts = data.terrain.reduce(
    (result, point) => {
      result[point.classification] += 1;
      return result;
    },
    { OPPORTUNITY: 0, UNCERTAIN: 0, 'RISK BLOCKED': 0 } as Record<Classification, number>,
  );
  const classificationProgress = ease((time - 14) / 2.5);
  const reasons = [
    'STALE QUOTE',
    'WIDE SPREAD',
    'LOW LIQUIDITY',
    'MARGINAL LIQUIDITY',
    'RISK CAP',
  ];
  const reasonIndex = Math.floor(Math.max(0, time - 16) / 0.8) % reasons.length;
  const phase = time < 6 ? 'CONTROL TOWER' : time < 13.5 ? 'DATA EXTRACTION' : time < 24 ? 'RISK CLASSIFICATION' : time < 29 ? 'CANDIDATE CONVERGENCE' : time < 33 ? 'DEFINED-RISK CALCULATION' : time < 37 ? 'HARD RISK GATE' : 'FOUR-FUTURE TRIBUNAL';
  const headline = time < 6
    ? 'CAPITAL CONTROL TOWER'
    : time < 13.5
      ? 'MARKET DATA → CENTRAL ENGINE'
      : time < 24
        ? '245 CONTRACTS · THREE OUTCOMES'
        : time < 29
          ? '21 → 8 → 4 → 2'
          : time < 33
            ? 'TWO LEGS · ONE DEFINED RISK'
            : time < 37
              ? 'CAPITAL LIMIT ENFORCEMENT'
              : 'ONE SIGNAL · FOUR EXECUTION POLICIES';
  return (
    <main className="control-tower">
      <header className="tower-header">
        <div><ShieldCheck /><b>SEOUL SHIELD</b><span>CAPITAL CONTROL TOWER</span></div>
        <div className="tower-proof"><i /> {data.evidence_status}</div>
      </header>
      <section className="tower-stage">
        <Canvas camera={{ position: [0, 1, 13], fov: 48 }} dpr={[1, 1.4]}>
          <TowerScene data={data} time={time} />
        </Canvas>
        <div className="tower-grid" />
        <div className="tower-title">
          <small>{phase}</small>
          <b>{headline}</b>
          <span>{data.ai_status} · {new Date(data.market.underlying_timestamp).toISOString()}</span>
        </div>
        {time < 2.5 && (
          <div className="tower-ready">
            <Database />
            <small>ALPACA SNAPSHOT READY</small>
            <b>245 OPTION CONTRACTS</b>
            <div><span>PAPER ACCOUNT <strong>$100,000</strong></span><span>OPTIONS LEVEL <strong>3</strong></span></div>
            {!running && <button onClick={run}><Play /> RUN CAPITAL ANALYSIS <kbd>ENTER</kbd></button>}
          </div>
        )}
        {time >= 6 && time < 13.5 && (
          <div className="extraction-status">
            <b>{Math.min(245, Math.floor(245 * ease((time - 6) / 5)))}</b>
            <span>CONTRACTS ENTERING ANALYSIS RING</span>
            <small>PRICE · QUOTE · IV · OI · ACCOUNT RISK</small>
          </div>
        )}
        {time >= 13.5 && time < 24 && (
          <div className="tower-sort-counts">
            {(['OPPORTUNITY', 'UNCERTAIN', 'RISK BLOCKED'] as Classification[]).map((key) => (
              <div key={key} className={key.toLowerCase().replace(' ', '-')}>
                <strong>{Math.floor(counts[key] * classificationProgress)}</strong><b>{key}</b>
              </div>
            ))}
          </div>
        )}
        {time >= 16 && time < 24 && (
          <div className="tower-block-reason"><b>{reasons[reasonIndex]}</b><span>EXECUTION FIREWALL</span></div>
        )}
        {time >= 24 && time < 29 && (
          <div className="candidate-compression">
            <small>OPPORTUNITY CANDIDATES</small>
            <b>21 <i>→</i> {time < 25 ? 21 : time < 26 ? 8 : time < 27 ? 4 : 2}</b>
            <span>PASSING CONTRACTS TURN ELECTRIC BLUE</span>
          </div>
        )}
        {time >= 29 && time < 33 && (
          <div className="risk-calculation">
            <small>DEFINED-RISK CALL SPREAD</small>
            <div><span>NET DEBIT <b>$2.74</b></span><span>REQUESTED <b>4 CONTRACTS</b></span></div>
            <strong>MAX LOSS $1,096</strong>
          </div>
        )}
        {time >= 33 && time < 37 && (
          <div className="hard-gate-verdict">
            <div><span>MAX LOSS</span><b>$1,096</b></div>
            <strong>$96 OVER LIMIT<em>HARD GATE: BLOCKED</em></strong>
            <div><span>POLICY LIMIT</span><b>$1,000</b></div>
            <footer>QUOTE: STALE · AI: FALLBACK / NOT LIVE AI · PAPER PREVIEW · NOT SUBMITTED</footer>
          </div>
        )}
        {time >= 37 && (
          <div className="tribunal-banner"><small>IDENTICAL ORDER SIGNAL</small><b>EXECUTION AUTHORITY TRIBUNAL</b></div>
        )}
        <div className="tower-legend">
          <span className="opportunity">● OPPORTUNITY · SMOOTH PATH</span>
          <span className="uncertain">△ UNCERTAIN · REVIEW LANE</span>
          <span className="risk-blocked">▣ RISK BLOCKED · QUARANTINE</span>
        </div>
      </section>
      <footer className="tower-footer">
        <span>{phase}</span><i><em style={{ width: `${(time / DURATION) * 100}%` }} /></i><b>{time.toFixed(1)} / {DURATION.toFixed(1)} SEC</b>
      </footer>
    </main>
  );
}
