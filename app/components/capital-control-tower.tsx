'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Activity, Database, Play, ShieldCheck } from 'lucide-react';
import { Color, InstancedMesh, Object3D } from 'three';
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
};

const DURATION = 24;
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
  [-6.5, 3.1, -4],
  [-3.7, 4.6, -6],
  [0, 5.2, -7.2],
  [3.7, 4.6, -6],
  [6.5, 3.1, -4],
  [-6.8, -1.8, -4.6],
  [-3.6, -3.6, -6],
  [0, -4.3, -7],
  [3.6, -3.6, -6],
  [6.8, -1.8, -4.6],
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
      dummy.position.set(
        origin[0] * (1 - travel),
        origin[1] * (1 - travel),
        origin[2] * (1 - travel) - 0.4,
      );
      dummy.lookAt(0, 0, 0);
      dummy.scale.set(0.03, 0.03, 0.32 + progress * 0.45);
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
      <ambientLight intensity={0.55} />
      <directionalLight position={[0, 8, 6]} intensity={2.4} color="#dfffff" />
      <pointLight position={[0, 0, 2]} intensity={35} color="#55cfff" distance={18} />
      <group rotation={[Math.PI / 2, 0, 0]}>
        {[2.2, 2.8, 3.4].map((radius, index) => (
          <mesh key={radius} scale={[radius, radius, 0.06]}>
            <torusGeometry args={[1, 0.025 + index * 0.012, 12, 96]} />
            <meshBasicMaterial color={index === 1 ? '#ffffff' : '#33cfff'} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0, -0.3]}>
        <cylinderGeometry args={[1.1, 1.6, 1.2, 48, 1, true]} />
        <meshStandardMaterial color="#0b2740" metalness={0.82} roughness={0.25} />
      </mesh>
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
      {time >= 6 && <ContractFlow data={data} time={time} />}
      {classify &&
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
  const phase = time < 6 ? 'CONTROL TOWER' : time < 13.5 ? 'DATA EXTRACTION' : 'RISK CLASSIFICATION';
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
          <b>{time < 6 ? 'CAPITAL CONTROL TOWER' : time < 13.5 ? 'MARKET DATA → CENTRAL ENGINE' : '245 CONTRACTS · THREE OUTCOMES'}</b>
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
        {time >= 13.5 && (
          <div className="tower-sort-counts">
            {(['OPPORTUNITY', 'UNCERTAIN', 'RISK BLOCKED'] as Classification[]).map((key) => (
              <div key={key} className={key.toLowerCase().replace(' ', '-')}>
                <strong>{Math.floor(counts[key] * classificationProgress)}</strong><b>{key}</b>
              </div>
            ))}
          </div>
        )}
        {time >= 16 && (
          <div className="tower-block-reason"><b>{reasons[reasonIndex]}</b><span>EXECUTION FIREWALL</span></div>
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
