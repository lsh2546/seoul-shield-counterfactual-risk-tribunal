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

const DURATION = 260;
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

const guidedSceneTime = (time: number) => {
  if (time < 8) return 13.5 + (time / 8) * 23.4;
  if (time < 30) return 1.6;
  if (time < 45) return 2.2;
  if (time < 65) return 6 + ((time - 45) / 20) * 7.4;
  if (time < 100) return 13.5 + ((time - 65) / 35) * 10.4;
  if (time < 135) return 24 + ((time - 100) / 35) * 9;
  if (time < 165) return 29 + ((time - 135) / 30) * 8;
  if (time < 200) return 37 + ((time - 165) / 35) * 18;
  return 54;
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
                : time < 40
                  ? new Vector3(0, 10.5, 13.5)
                  : time < 43
                    ? new Vector3(-5.2, 2.2, 5 - (time - 40) * 3.6)
                    : time < 46
                      ? new Vector3(-1.8, -1.8, 3.5 - (time - 43) * 3.2)
                      : time < 50
                        ? new Vector3(2.0, 2.0, 4 - (time - 46) * 2.6)
                        : time < 53
                          ? new Vector3(5.2, -1.7, 4 - (time - 50) * 2.8)
                          : new Vector3(0, 9.2, 15.8);
    camera.position.lerp(target, time >= 37 ? 0.075 : 0.045);
    const look = time < 40
      ? new Vector3(0, 0, -7)
      : time < 43
        ? new Vector3(-5.2, 2.2, -18)
        : time < 46
          ? new Vector3(-1.8, -1.8, -18)
          : time < 50
            ? new Vector3(2, 2, -18)
            : time < 53
              ? new Vector3(5.2, -1.7, -18)
              : new Vector3(0, 0, -10);
    camera.lookAt(look);
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

function PolicyTunnel({ position, color, active, blockedAt, kind }: {
  position: [number, number, number]; color: string; active: boolean; blockedAt?: number;
  kind: 'no-guard' | 'static' | 'adaptive' | 'live';
}) {
  const pulse = useRef<Object3D>(null);
  const inspectors = useRef<Object3D>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pulse.current) {
      const travel = kind === 'no-guard' ? 18 : kind === 'static' ? 10 : kind === 'adaptive' ? 8 : 7;
      pulse.current.position.z = active ? -((t * 7) % travel) : 0;
    }
    if (inspectors.current) inspectors.current.rotation.z = t * 1.8;
  });
  return (
    <group position={position}>
      {Array.from({ length: 9 }, (_, index) => (
        <mesh key={index} position={[0, 0, -index * 2.25]}>
          <torusGeometry args={[1.25, 0.045, 8, 42]} />
          <meshBasicMaterial color={color} transparent opacity={0.34 + index * 0.025} />
        </mesh>
      ))}
      <mesh position={[0, 0, -9]} scale={[0.035, 0.035, 18]}><boxGeometry /><meshBasicMaterial color={color} transparent opacity={0.55} /></mesh>
      <group ref={pulse}>
        <mesh scale={[0.72, 0.38, 0.12]}><boxGeometry /><meshBasicMaterial color="#ffffff" /></mesh>
        <mesh scale={[1.15, 0.04, 0.04]}><boxGeometry /><meshBasicMaterial color={color} /></mesh>
      </group>
      {kind === 'static' && (
        <group position={[0, 0, -(blockedAt ?? 10)]}>
          <mesh scale={[1.15, 1.15, 0.14]}><boxGeometry /><meshBasicMaterial color="#23c8ff" transparent opacity={0.88} /></mesh>
        </group>
      )}
      {kind === 'adaptive' && (
        <group ref={inspectors} position={[0, 0, -(blockedAt ?? 8)]}>
          {[1.45, 1.05, 0.7].map((radius, index) => (
            <mesh key={radius} rotation={[index * 0.5, index * 0.8, 0]}><torusGeometry args={[radius, 0.055, 8, 48]} /><meshBasicMaterial color="#c77dff" /></mesh>
          ))}
        </group>
      )}
      {kind === 'live' && (
        <group position={[0, 0, -(blockedAt ?? 7)]}>
          <mesh position={[0, -0.65, 0]} scale={[1.3, 0.78, 0.18]}><boxGeometry /><meshBasicMaterial color="#ffd21f" transparent opacity={0.82} /></mesh>
          <mesh position={[0, 0.12, 0]}><torusGeometry args={[0.5, 0.13, 10, 32, Math.PI]} /><meshBasicMaterial color="#fff0a8" /></mesh>
        </group>
      )}
    </group>
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
  const rise = ease((time - 37) / 1.2);
  const shock = ease((time - 38.1) / 0.45);
  return (
    <>
      <group position={[0, -1.4 + rise * 3.1, -4]} scale={1 - shock * 0.35}>
        <mesh><octahedronGeometry args={[0.72, 0]} /><meshBasicMaterial color="#ffffff" /></mesh>
        <mesh scale={[1 + shock * 5, 1 + shock * 5, 0.04]}><ringGeometry args={[0.9, 1.02, 64]} /><meshBasicMaterial color="#bff5ff" transparent opacity={1 - shock * 0.72} /></mesh>
      </group>
      <PolicyTunnel position={[-5.2, 2.2, -5]} color="#ff314a" active={time >= 39.2 && time < 43} kind="no-guard" />
      <PolicyTunnel position={[-1.8, -1.8, -5]} color="#23c8ff" active={time >= 39.2 && time < 46} blockedAt={10} kind="static" />
      <PolicyTunnel position={[2, 2, -5]} color="#c77dff" active={time >= 39.2 && time < 50} blockedAt={8} kind="adaptive" />
      <PolicyTunnel position={[5.2, -1.7, -5]} color="#ffd21f" active={time >= 39.2 && time < 53} blockedAt={7} kind="live" />
      {time >= 53 && [
        { p: [-5.2, 3.8, -8] as [number, number, number], c: '#ff314a', t: 'NO GUARD', d: 'SHADOW ONLY' },
        { p: [-1.8, -3.4, -8] as [number, number, number], c: '#23c8ff', t: 'STATIC', d: 'BLOCKED' },
        { p: [2, 3.8, -8] as [number, number, number], c: '#c77dff', t: 'ADAPTIVE', d: 'FAIL-CLOSED' },
        { p: [5.2, -3.3, -8] as [number, number, number], c: '#ffd21f', t: 'LIVE', d: 'NOT SUBMITTED' },
      ].map((item) => <Html key={item.t} position={item.p} transform distanceFactor={8}><div className="future-final" style={{ borderColor: item.c }}><b>{item.t}</b><span>{item.d}</span></div></Html>)}
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
  const timelineTime = time * (220 / 260);
  const sceneTime = guidedSceneTime(timelineTime);
  const classificationProgress = ease((sceneTime - 14) / 2.5);
  const reasons = [
    'STALE QUOTE',
    'WIDE SPREAD',
    'LOW LIQUIDITY',
    'MARGINAL LIQUIDITY',
    'RISK CAP',
  ];
  const reasonIndex = Math.floor(Math.max(0, sceneTime - 16) / 0.8) % reasons.length;
  const phase = sceneTime < 6 ? 'CONTROL TOWER' : sceneTime < 13.5 ? 'DATA EXTRACTION' : sceneTime < 24 ? 'RISK CLASSIFICATION' : sceneTime < 29 ? 'CANDIDATE CONVERGENCE' : sceneTime < 33 ? 'DEFINED-RISK CALCULATION' : sceneTime < 37 ? 'HARD RISK GATE' : 'FOUR-FUTURE TRIBUNAL';
  const headline = sceneTime < 6
    ? 'CAPITAL CONTROL TOWER'
    : sceneTime < 13.5
      ? 'MARKET DATA → CENTRAL ENGINE'
      : sceneTime < 24
        ? '245 CONTRACTS · THREE OUTCOMES'
        : sceneTime < 29
          ? '21 → 8 → 4 → 2'
          : sceneTime < 33
            ? 'TWO LEGS · ONE DEFINED RISK'
            : sceneTime < 37
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
          <TowerScene data={data} time={sceneTime} />
        </Canvas>
        <div className="tower-grid" />
        <div className="tower-title">
          <small>{phase}</small>
          <b>{headline}</b>
          <span>{data.ai_status} · {new Date(data.market.underlying_timestamp).toISOString()}</span>
        </div>
        {sceneTime < 2.5 && (
          <div className="tower-ready">
            <Database />
            <small>ALPACA SNAPSHOT READY</small>
            <b>245 OPTION CONTRACTS</b>
            <div><span>PAPER ACCOUNT <strong>$100,000</strong></span><span>OPTIONS LEVEL <strong>3</strong></span></div>
            {!running && <button onClick={run}><Play /> RUN CAPITAL ANALYSIS <kbd>ENTER</kbd></button>}
          </div>
        )}
        {sceneTime >= 6 && sceneTime < 13.5 && (
          <div className="extraction-status">
            <b>{Math.min(245, Math.floor(245 * ease((sceneTime - 6) / 5)))}</b>
            <span>CONTRACTS ENTERING ANALYSIS RING</span>
            <small>PRICE · QUOTE · IV · OI · ACCOUNT RISK</small>
          </div>
        )}
        {sceneTime >= 13.5 && sceneTime < 24 && (
          <div className="tower-sort-counts">
            {(['OPPORTUNITY', 'UNCERTAIN', 'RISK BLOCKED'] as Classification[]).map((key) => (
              <div key={key} className={key.toLowerCase().replace(' ', '-')}>
                <strong>{Math.floor(counts[key] * classificationProgress)}</strong><b>{key}</b>
              </div>
            ))}
          </div>
        )}
        {sceneTime >= 16 && sceneTime < 24 && (
          <div className="tower-block-reason"><b>{reasons[reasonIndex]}</b><span>EXECUTION FIREWALL</span></div>
        )}
        {sceneTime >= 24 && sceneTime < 29 && (
          <div className="candidate-compression">
            <small>21 → 8 → 4 → 2</small>
            <b>{sceneTime < 25 ? '21 CANDIDATES' : sceneTime < 26 ? '8 PASSED EXPIRATION' : sceneTime < 27 ? '4 PASSED LIQUIDITY' : '2 DEFINED-RISK LEGS'}</b>
            <span>{sceneTime < 27 ? 'PASSING CONTRACTS TURN ELECTRIC BLUE' : 'BUY 765C + SELL 770C'}</span>
          </div>
        )}
        {sceneTime >= 29 && sceneTime < 33 && (
          <div className="risk-calculation">
            <small>DEFINED-RISK CALL SPREAD</small>
            <div><span>NET DEBIT <b>$2.74</b></span><span>REQUESTED <b>4 CONTRACTS</b></span></div>
            <strong>MAX LOSS $1,096</strong>
          </div>
        )}
        {sceneTime >= 33 && sceneTime < 37 && (
          <div className="hard-gate-verdict">
            <div><span>MAX LOSS</span><b>$1,096</b></div>
            <strong>$96 OVER LIMIT<em>HARD GATE: BLOCKED</em></strong>
            <div><span>POLICY LIMIT</span><b>$1,000</b></div>
            <footer>QUOTE: STALE · AI: FALLBACK / NOT LIVE AI · PAPER PREVIEW · NOT SUBMITTED</footer>
          </div>
        )}
        {sceneTime >= 37 && sceneTime < 40 && <div className="tribunal-banner"><small>IDENTICAL ORDER SIGNAL · ONE IMPACT · FOUR DEPTH PATHS</small><b>EXECUTION AUTHORITY TRIBUNAL</b></div>}
        {sceneTime >= 40 && sceneTime < 43 && <div className="policy-verdict no-guard"><small>NO GUARD</small><b>4 CONTRACTS · $1,096 EXPOSED</b><span>NO PROTECTIVE GATE · SHADOW ONLY</span></div>}
        {sceneTime >= 43 && sceneTime < 46 && <div className="policy-verdict static"><small>STATIC GUARD</small><b>$1,000 HARD LIMIT · BLOCKED</b><span>$96 OVER LIMIT</span></div>}
        {sceneTime >= 46 && sceneTime < 50 && <div className="policy-verdict adaptive"><small>ADAPTIVE GUARD</small><b>STALE QUOTE · FALLBACK AI</b><span className="inspection-line">QUOTE AGE · AI STATUS · LIQUIDITY</span><strong>FAIL-CLOSED</strong></div>}
        {sceneTime >= 50 && sceneTime < 53 && <div className="policy-verdict live"><small>LIVE EXECUTION</small><b>PAPER PREVIEW</b><strong>HUMAN APPROVAL REQUIRED</strong><em>LOCKED</em><span>NOT SUBMITTED</span></div>}
        {sceneTime >= 53 && <div className="tribunal-banner final"><small>FOUR POLICIES · ONE EVIDENCE SNAPSHOT</small><b>{timelineTime >= 215 ? 'MOST AGENTS SEARCH FOR A REASON TO TRADE. SEOUL SHIELD SEARCHES FOR THE REASON THEY SHOULD NOT.' : 'ONLY LIVE EXECUTION HAS AUTHORITY — AND IT REMAINS LOCKED'}</b></div>}
        {timelineTime >= 30 && timelineTime < 65 && <div className="guided-evidence"><small>ALPACA PAPER TRADING · SANITIZED ACCOUNT EVIDENCE</small><b>CASH / EQUITY <strong>$100,000</strong></b><b>BUYING POWER <strong>$400,000</strong></b><div><span>OPTIONS LEVEL <strong>3</strong></span><span>POSITIONS <strong>0</strong></span><span>OPEN ORDERS <strong>0</strong></span></div></div>}
        {timelineTime >= 200 && timelineTime < 215 && <div className="guided-audit"><small>TAMPER-EVIDENT EXECUTION RECORD</small><b>HASH-CHAIN AUDIT LOG</b><span>SNAPSHOT → AI/FALLBACK → POLICIES → HARD GATE → PREVIEW</span><strong>CHAIN VERIFIED · SECRETS REDACTED</strong></div>}
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
