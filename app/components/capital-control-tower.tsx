'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Activity, Database, Play, ShieldCheck } from 'lucide-react';
import { Color, DoubleSide, InstancedMesh, Object3D, Vector3 } from 'three';
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
      dummy.rotateZ((i % 5 - 2) * 0.07);
      dummy.scale.set(0.08, 0.04, 0.75 + progress * 0.9);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 90]} frustumCulled={false}>
      <boxGeometry />
      <meshStandardMaterial color="#dfffff" emissive="#23c8ff" emissiveIntensity={2.4} metalness={0.8} roughness={0.18} transparent opacity={0.94} />
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
    camera.position.lerp(target, time >= 37 ? 0.09 : 0.06);
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

function ControlCenterArchitecture({ time }: { time: number }) {
  const ribs = useRef<Object3D>(null);
  useFrame(({ clock }) => {
    if (ribs.current) ribs.current.rotation.z = Math.sin(clock.elapsedTime * 0.12) * 0.012;
  });
  const redAlert = time >= 33 && time < 37;
  return (
    <group ref={ribs}>
      {Array.from({ length: 18 }, (_, index) => (
        <group key={index} position={[0, 0, -index * 2.8 + 4]}>
          <mesh position={[-8.6, 0, 0]} rotation={[0, 0, -0.13]} scale={[0.12, 6.4, 0.32]}><boxGeometry /><meshStandardMaterial color="#173f61" metalness={0.92} roughness={0.2} /></mesh>
          <mesh position={[8.6, 0, 0]} rotation={[0, 0, 0.13]} scale={[0.12, 6.4, 0.32]}><boxGeometry /><meshStandardMaterial color="#173f61" metalness={0.92} roughness={0.2} /></mesh>
          <mesh position={[0, 5.35, 0]} scale={[8.5, 0.08, 0.32]}><boxGeometry /><meshStandardMaterial color="#215478" emissive={redAlert ? '#ff314a' : '#23c8ff'} emissiveIntensity={redAlert ? 3.5 : 0.75} metalness={0.9} roughness={0.18} /></mesh>
        </group>
      ))}
      <mesh position={[-9.3, 0, -17]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[48, 13]} /><meshStandardMaterial color="#0a263f" metalness={0.7} roughness={0.26} side={DoubleSide} /></mesh>
      <mesh position={[9.3, 0, -17]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[48, 13]} /><meshStandardMaterial color="#0a263f" metalness={0.7} roughness={0.26} side={DoubleSide} /></mesh>
      <mesh position={[0, 5.8, -17]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[19, 48]} /><meshStandardMaterial color="#0c2d49" metalness={0.72} roughness={0.3} side={DoubleSide} /></mesh>
    </group>
  );
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

function PolicyTunnel({ position, color, active, blockedAt, kind, label, verdict, showLabel }: {
  position: [number, number, number]; color: string; active: boolean; blockedAt?: number;
  kind: 'no-guard' | 'static' | 'adaptive' | 'live'; label: string; verdict: string; showLabel: boolean;
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
      {showLabel && <Html position={[0, 1.75, 0]} center occlude={false}>
        <div className={`tunnel-verdict ${kind}`}><b>{label}</b><strong>{verdict}</strong></div>
      </Html>}
      {[-1.45, 1.45].map((x) => <mesh key={`rail-x-${x}`} position={[x, 0, -9]} scale={[0.045, 0.045, 18]}><boxGeometry /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.35} metalness={0.8} roughness={0.2} /></mesh>)}
      {[-1.05, 1.05].map((y) => <mesh key={`rail-y-${y}`} position={[0, y, -9]} scale={[1.5, 0.045, 18]}><boxGeometry /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.15} metalness={0.8} roughness={0.2} /></mesh>)}
      {[0, -18].map((z) => <group key={`frame-${z}`} position={[0, 0, z]}>
        <mesh position={[-1.45, 0, 0]} scale={[0.07, 1.12, 0.09]}><boxGeometry /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} /></mesh>
        <mesh position={[1.45, 0, 0]} scale={[0.07, 1.12, 0.09]}><boxGeometry /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} /></mesh>
        <mesh position={[0, 1.05, 0]} scale={[1.52, 0.07, 0.09]}><boxGeometry /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} /></mesh>
        <mesh position={[0, -1.05, 0]} scale={[1.52, 0.07, 0.09]}><boxGeometry /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} /></mesh>
      </group>)}
      <mesh position={[0, -1.12, -9]} scale={[1.48, 0.025, 18]}><boxGeometry /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} transparent opacity={0.28} /></mesh>
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
          {[1.05].map((radius, index) => (
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
        <mesh position={[-5 + close * 2.7, 0, 0]} scale={[2.2, 4, 0.34]}><boxGeometry /><meshStandardMaterial color="#9f071d" emissive="#ff1838" emissiveIntensity={2.3} metalness={0.78} roughness={0.17} /></mesh>
        <mesh position={[5 - close * 2.7, 0, 0]} scale={[2.2, 4, 0.34]}><boxGeometry /><meshStandardMaterial color="#9f071d" emissive="#ff1838" emissiveIntensity={2.3} metalness={0.78} roughness={0.17} /></mesh>
      </group>
    );
  }
  const rise = ease((time - 37) / 1.2);
  const shock = ease((time - 38.1) / 0.45);
  return (
    <>
      <group position={[0, -1.4 + rise * 3.1, -4]} scale={1 - shock * 0.35}>
        <mesh><octahedronGeometry args={[0.72, 0]} /><meshStandardMaterial color="#ffffff" emissive="#bff5ff" emissiveIntensity={3} metalness={0.85} roughness={0.12} /></mesh>
        <mesh scale={[1 + shock * 5, 1 + shock * 5, 0.04]}><ringGeometry args={[0.9, 1.02, 64]} /><meshBasicMaterial color="#bff5ff" transparent opacity={1 - shock * 0.72} /></mesh>
      </group>
      <PolicyTunnel position={[-4.1, 2.0, -4]} color="#ff314a" active={time >= 39.2 && time < 43} kind="no-guard" label="NO GUARD" verdict="APPROVE · SHADOW ONLY" showLabel={time < 40} />
      <PolicyTunnel position={[4.1, 2.0, -4]} color="#23c8ff" active={time >= 39.2 && time < 46} blockedAt={10} kind="static" label="STATIC GUARD" verdict="REJECT" showLabel={time < 40} />
      <PolicyTunnel position={[-4.1, -2.0, -4]} color="#c77dff" active={time >= 39.2 && time < 50} blockedAt={8} kind="adaptive" label="ADAPTIVE GUARD" verdict="REJECT · FAIL-CLOSED" showLabel={time < 40} />
      <PolicyTunnel position={[4.1, -2.0, -4]} color="#ffd21f" active={time >= 39.2 && time < 53} blockedAt={7} kind="live" label="LIVE EXECUTION" verdict="LOCKED · NOT SUBMITTED" showLabel={time < 40} />
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
        dummy.rotation.set(-0.08, side * 0.14, side * 0.05);
        dummy.scale.set(0.72, 0.12, 0.24);
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
      if (time >= 13.5) dummy.rotation.set(-0.08, 0, 0);
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
      <meshStandardMaterial transparent opacity={0.94} metalness={0.82} roughness={0.16} emissiveIntensity={1.6} toneMapped={false} />
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
      <fog attach="fog" args={['#071a2d', 13, 48]} />
      <ControlCenterArchitecture time={time} />
      <ambientLight intensity={1.65} />
      <directionalLight position={[0, 9, 7]} intensity={3.5} color="#efffff" />
      <pointLight position={[0, 1, 3]} intensity={62} color="#73ddff" distance={22} />
      <pointLight position={[0, 3, -18]} intensity={80} color={time >= 33 && time < 37 ? '#ff314a' : '#23c8ff'} distance={36} />
      <gridHelper args={[34, 34, '#3f87ba', '#24527d']} position={[0, -4.7, -4]} />
      <mesh position={[0, -4.64, -4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[34, 34]} />
        <meshStandardMaterial color="#123d62" transparent opacity={0.32} metalness={0.7} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0, -0.4]}>
        <cylinderGeometry args={[1.55, 1.55, 3.5, 64, 1, true]} />
        <meshPhysicalMaterial color="#8de9ff" transparent opacity={0.3} roughness={0.08} metalness={0.5} transmission={0.36} thickness={0.7} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.22, 0.22, 3.2, 24, 1, true]} />
        <meshStandardMaterial color="#ffffff" emissive="#23c8ff" emissiveIntensity={4} transparent opacity={0.98} />
      </mesh>
      {[
        { y: 1.15, radius: 2.1, label: 'MARKET' },
        { y: 0, radius: 2.55, label: 'LIQUIDITY' },
        { y: -1.15, radius: 2.95, label: 'RISK' },
      ].map((ring, index) => (
        <group key={ring.label} position={[0, ring.y, -0.4]} rotation={[Math.PI / 2, 0, time * (index % 2 ? -0.2 : 0.22)]}>
          <mesh>
            <torusGeometry args={[ring.radius, 0.055, 14, 112]} />
            <meshStandardMaterial color={index === 1 ? '#ffffff' : '#23c8ff'} emissive={index === 2 ? '#ff314a' : '#23c8ff'} emissiveIntensity={2.2} metalness={0.8} roughness={0.15} />
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
  const [time, setTime] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cover') === '1' ? 178 : 0);
  const [running, setRunning] = useState(false);
  const [coverMode] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cover') === '1');
  const [reviewFrame] = useState(() => typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('reviewFrame')
    : null);
  const [terminalMode] = useState(() => typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('terminal') === '1');
  const [cinematicMode] = useState(() => typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('cinematic') === '1');
  const [thumbnailMode] = useState(() => typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('thumbnail') === '1');
  const [fallback2d] = useState(() => {
    if (typeof window === 'undefined') return false;
    const forced = new URLSearchParams(window.location.search).get('fallback') === '2d';
    const canvas = document.createElement('canvas');
    const supported = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    return forced || !supported;
  });
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
    <main className={`control-tower ${time >= 244 ? 'ending-clean' : ''} ${reviewFrame ? 'evidence-review-mode' : ''} ${terminalMode ? 'terminal-remaster-mode' : ''} ${cinematicMode || thumbnailMode ? 'cinematic-remaster-mode' : ''}`}>
      {time < 244 && <header className="tower-header">
        <div><ShieldCheck /><b>SEOUL SHIELD</b><span>CAPITAL CONTROL TOWER</span></div>
        <div className="tower-proof"><i /> {data.evidence_status}</div>
      </header>}
      <section className="tower-stage">
        <div className={`cinematic-grade ${sceneTime >= 33 && sceneTime < 37 ? 'alert' : ''}`} />
        {fallback2d ? (
          <figure className="tower-fallback" aria-label="Two-dimensional summary of the Seoul Shield risk decision">
            <small>2D FALLBACK · VERIFIED ALPACA REPLAY</small>
            <b>245 CONTRACTS</b>
            <div><span className="opportunity">21 OPPORTUNITY</span><span className="uncertain">80 UNCERTAIN</span><span className="risk-blocked">144 RISK BLOCKED</span></div>
            <strong>21 → 8 → 4 → 2</strong>
            <p>BUY SPY 765C + SELL SPY 770C</p>
            <em>$1,096 MAX LOSS · $1,000 LIMIT · BLOCKED</em>
            <footer>PAPER PREVIEW · NOT SUBMITTED</footer>
          </figure>
        ) : time < 244 ? (
          <Canvas camera={{ position: [0, 1, 13], fov: 48 }} dpr={[1, 1.4]}>
            <TowerScene data={data} time={sceneTime} />
          </Canvas>
        ) : null}
        <div className="tower-grid" />
        {timelineTime < 3.4 && (
          <div className="cinematic-opening">
            <b>245 CONTRACTS.</b>
            <strong>ONE CAPITAL GATE.</strong>
            <span>ALPACA OPTIONS · VERIFIED REPLAY</span>
          </div>
        )}
        {time < 244 && <div className="tower-title">
          <small>{phase}</small>
          <b>{headline}</b>
          <span>{data.ai_status} · {new Date(data.market.underlying_timestamp).toISOString()}</span>
        </div>}
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
        {time >= 244 && <div className="cinematic-final"><b>AI MAY PROPOSE.</b><strong>ONLY POLICY EARNS THE RIGHT TO TRADE.</strong><span>VERIFIED ALPACA REPLAY · PAPER PREVIEW · NOT SUBMITTED</span></div>}
        {coverMode && <div className="cinematic-cover"><b>HARD GATE:</b><strong>BLOCKED</strong><span><i>RISK</i> $1,096 <em>&gt;</em> <i>LIMIT</i> $1,000</span><small>SEOUL SHIELD · COUNTERFACTUAL RISK TRIBUNAL</small></div>}
        {reviewFrame && <div className={`evidence-review evidence-review-${reviewFrame}`}>
          <div className="review-depth-rails" aria-hidden="true"><i /><i /><i /><i /></div>
          {reviewFrame === 'opening' && <><small>SEOUL SHIELD · AUTONOMOUS RISK-GOVERNED OPTIONS AGENT</small><b>AI PROPOSED AN UNSAFE TRADE.</b><strong>SEOUL SHIELD RESIZED THE RISK.</strong><em>ONLY AN APPROVED PAPER ORDER CAN REACH ALPACA.</em><span>FINAL EXECUTION EVIDENCE PENDING MARKET OPEN</span></>}
          {reviewFrame === 'gemini' && <><small>LIVE MARKET SNAPSHOT → STRUCTURED MODEL INFERENCE</small><b>GEMINI DECISION</b><strong>AI VERIFIED</strong><em>MODEL gemini-3.8-flash</em><span>SCHEMA VALID · INPUT SHA-256 6C2AE226…D77E7E</span></>}
          {reviewFrame === 'blocked' && <><small>DETERMINISTIC CAPITAL FIREWALL</small><b>UNSAFE ORDER BLOCKED</b><strong>$1,072 <i>&gt;</i> $1,000</strong><em>4 CONTRACTS · $72 OVER POLICY LIMIT</em><span>TEMPORARY STALE-QUOTE VALIDATION VALUE</span></>}
          {reviewFrame === 'alternative' && <><small>AUTONOMOUS POLICY-COMPLIANT SEARCH</small><b>SAFE ALTERNATIVE</b><strong>3 CONTRACTS · $804</strong><em>MAX LOSS · 0.804% OF EQUITY</em><span>RISK LIMIT PASSED · FRESH QUOTE STILL REQUIRED</span></>}
          {reviewFrame === 'order' && <><small>ALPACA PAPER EXECUTION GATEWAY</small><b>HUMAN APPROVAL</b><strong>ORDER NOT SUBMITTED</strong><em>MARKET CLOSED · QUOTE STALE</em><span>ORDER ID PENDING · ALPACA_ALLOW_SUBMIT=FALSE</span></>}
          {reviewFrame === 'pnl' && <><small>ALPACA PAPER POSITION MONITOR</small><b>FILL / STATUS</b><strong>PENDING REAL EXECUTION</strong><em>PAPER P&amp;L UNAVAILABLE</em><span>NO POSITION · NO FILL · NO FABRICATED RESULT</span></>}
          {reviewFrame === 'audit' && <><small>TAMPER-EVIDENT DECISION RECORD</small><b>HASH VERIFIED</b><strong>9 EVENTS LINKED</strong><em>SNAPSHOT → GEMINI → POLICIES → PREFLIGHT</em><span>SECRETS REDACTED · ORDER SUBMISSION LOCKED</span></>}
          {reviewFrame === 'ending' && <><small>SEOUL SHIELD · COUNTERFACTUAL RISK TRIBUNAL</small><b>AI MAY PROPOSE.</b><strong>ONLY POLICY EARNS<br />THE RIGHT TO TRADE.</strong><span>AI VERIFIED · ALPACA PAPER PREFLIGHT · NOT SUBMITTED</span></>}
        </div>}
        {terminalMode && time < 244 && <TerminalRemasterOverlay time={time} />}
        {(cinematicMode || thumbnailMode) && <CinematicRemasterOverlay time={time} thumbnail={thumbnailMode} />}
        {time < 244 && <div className="tower-legend">
          <span className="opportunity">● OPPORTUNITY · SMOOTH PATH</span>
          <span className="uncertain">△ UNCERTAIN · REVIEW LANE</span>
          <span className="risk-blocked">▣ RISK BLOCKED · QUARANTINE</span>
        </div>}
      </section>
      {time < 244 && <footer className="tower-footer">
        <span>{phase}</span><i><em style={{ width: `${(time / DURATION) * 100}%` }} /></i><b>{time.toFixed(1)} / {DURATION.toFixed(1)} SEC</b>
      </footer>}
    </main>
  );
}

const pending = 'AWAITING LIVE MARKET DATA';

function TerminalMetric({ label, value, tone = 'data' }: { label: string; value: string; tone?: 'data' | 'up' | 'down' | 'ai' | 'warn' }) {
  return <div className={`terminal-metric ${tone}`}><span>{label}</span><b>{value}</b></div>;
}

function TerminalRemasterOverlay({ time }: { time: number }) {
  const stage = time < 36 ? 'LIVE DATA' : time < 75 ? 'AI ANALYSIS' : time < 112 ? 'UNSAFE ORDER' : time < 148 ? 'SAFE ALTERNATIVE' : time < 178 ? 'HUMAN APPROVAL' : time < 210 ? 'ALPACA PAPER EXECUTION' : time < 232 ? 'POSITION / P&L' : 'HASH VERIFIED';
  const blocked = time >= 75 && time < 112;
  const passed = time >= 112 && time < 148;
  const awaitingOrder = time >= 178 && time < 232;
  const stageStatus = blocked ? 'ORDER BLOCKED' : passed ? 'RISK CAP PASSED' : awaitingOrder ? 'NOT SUBMITTED' : stage === 'HASH VERIFIED' ? 'AI EVIDENCE VERIFIED · EXECUTION PENDING' : pending;
  return <div className={`terminal-remaster ${blocked ? 'risk-flash' : ''}`}>
    <div className="terminal-topline">
      <div><strong>SEOUL SHIELD</strong><span>INSTITUTIONAL OPTIONS RISK TERMINAL</span></div>
      <div className="terminal-session"><i /> PAPER TRADING · SUBMISSION LOCKED</div>
    </div>
    <div className="terminal-stage-label"><span>{stage}</span><b>{stageStatus}</b></div>

    <section className="terminal-chain terminal-depth-back">
      <header><b>LIVE OPTIONS CHAIN</b><span>ALPACA MARKET DATA</span></header>
      <div className="terminal-chain-head"><span>CONTRACT</span><span>BID</span><span>ASK</span><span>MID</span><span>SPR</span><span>VOL</span><span>OI</span><span>Δ</span></div>
      {['SPY CALL · LEG A','SPY CALL · LEG B','SPY CALL · CANDIDATE','SPY PUT · CANDIDATE','SPY CALL · CANDIDATE'].map((name, i) => <div className={`terminal-chain-row ${i < 2 ? 'selected' : ''}`} key={name}>
        <span>{name}</span>{Array.from({length:7},(_,n)=><span key={n}>—</span>)}
      </div>)}
      <footer>{pending}</footer>
    </section>

    <section className="terminal-market terminal-depth-front">
      <header><b>SPY</b><span>UNDERLYING</span></header>
      <strong>—</strong><em>—%</em>
      <div className="terminal-spark"><i /><i /><i /><i /><i /><i /></div>
      <small>PRICE · CHANGE · TIMESTAMP</small>
      <b>{pending}</b>
    </section>

    <section className="terminal-contract terminal-depth-mid">
      <header><b>SELECTED SPREAD</b><span>DEFINED RISK</span></header>
      <div className="terminal-legs"><strong>BUY SPY CALL</strong><i>+</i><strong>SELL SPY CALL</strong></div>
      <div className="terminal-contract-grid">
        <TerminalMetric label="EXPIRATION" value="—" />
        <TerminalMetric label="STRIKES" value="— / —" />
        <TerminalMetric label="BID / ASK" value="— / —" />
        <TerminalMetric label="MID / SPREAD" value="— / —" />
        <TerminalMetric label="VOLUME / OI" value="— / —" />
        <TerminalMetric label="DELTA / GAMMA" value="— / —" />
        <TerminalMetric label="THETA / VEGA" value="— / —" />
        <TerminalMetric label="QUOTE TIME" value="—" />
      </div>
      <footer>{pending}</footer>
    </section>

    <section className="terminal-ai terminal-depth-front">
      <header><b>GEMINI RISK ANALYSIS</b><span>STRUCTURED JSON · SCHEMA VALIDATED</span></header>
      <div className="terminal-ai-score"><span>CONFIDENCE</span><strong>—</strong></div>
      <ul><li>OPPORTUNITY <b>AWAITING DATA</b></li><li>LIQUIDITY RISK <b>AWAITING DATA</b></li><li>VOLATILITY / REGIME <b>AWAITING DATA</b></li><li>PORTFOLIO CONFLICT <b>AWAITING DATA</b></li></ul>
      <footer>AI VERIFIED · MARKET DECISION PENDING FRESH SNAPSHOT</footer>
    </section>

    <section className={`terminal-risk terminal-depth-mid ${passed ? 'passed' : ''}`}>
      <header><b>CAPITAL RISK GATE</b><span>DETERMINISTIC POLICY</span></header>
      <div className="terminal-risk-grid">
        <TerminalMetric label="CONTRACTS" value="—" />
        <TerminalMetric label="TOTAL COST" value="—" />
        <TerminalMetric label="MAX PROFIT" value="—" />
        <TerminalMetric label="MAX LOSS" value="—" tone={blocked ? 'down' : 'warn'} />
        <TerminalMetric label="BREAKEVEN" value="—" />
        <TerminalMetric label="ACCOUNT LIMIT" value="—" />
        <TerminalMetric label="POST-TRADE CAPACITY" value="—" />
      </div>
      <strong>{blocked ? 'ORDER BLOCKED' : passed ? 'RISK CAP PASSED' : pending}</strong>
    </section>

    <section className="terminal-orders terminal-depth-back">
      <header><b>ALPACA PAPER ORDER</b><span>EXECUTION BLOTTER</span></header>
      <div><span>ORDER STATUS</span><b>{awaitingOrder ? 'NOT SUBMITTED' : 'AWAITING APPROVAL'}</b></div>
      <div><span>FILLED QTY / AVG PRICE</span><b>— / —</b></div>
      <div><span>POSITION / PAPER P&amp;L</span><b>— / —</b></div>
      <footer>NO ORDER · NO FILL · NO FABRICATED P&amp;L</footer>
    </section>

    <div className="terminal-audit"><span>MEASURED AT</span><b>AWAITING FRESH MARKET TIMESTAMP</b><span>SOURCE</span><b>ALPACA PAPER</b><span>AUDIT HASH</span><b>AWAITING EXECUTION EVIDENCE</b></div>
  </div>;
}

function CinematicRemasterOverlay({ time, thumbnail }: { time: number; thumbnail: boolean }) {
  const stage = thumbnail ? 'thumbnail' : time < 32 ? 'proposed' : time < 72 ? 'vetoed' : time < 112 ? 'alternative' : time < 150 ? 'approval' : time < 195 ? 'execution' : time < 225 ? 'position' : 'verified';
  const copy: Record<string, [string,string,string]> = {
    proposed:['MARKET DATA REQUIRED','LIVE SPY OPTIONS ANALYSIS','AWAITING VERIFIED ALPACA SNAPSHOT'],
    vetoed:['RISK CALCULATION PENDING','ORIGINAL ORDER REVIEW','AWAITING FRESH QUOTE'],
    alternative:['RESIZE CALCULATION PENDING','CONTROLLED ALTERNATIVE','AWAITING FRESH-QUOTE VALIDATION'],
    approval:['PREFLIGHT INCOMPLETE','HUMAN APPROVAL REQUIRED','PAPER EXECUTION LOCKED'],
    execution:['ORDER NOT SUBMITTED','ALPACA PAPER EXECUTION','AWAITING APPROVAL'],
    position:['NO VERIFIED POSITION','UNREALIZED P&L: $—','NO FABRICATED OUTCOME'],
    verified:['MODEL RESPONSE VERIFIED','SCHEMA VERIFIED','MARKET DECISION PENDING'],
    thumbnail:['LIVE SPY OPTIONS','RISK-GOVERNED PAPER EXECUTION','AWAITING VERIFIED MARKET DATA'],
  };
  const [eyebrow,headline,status]=copy[stage];
  const danger=false;
  const safe=false;
  const loopStages=['SCAN','CLASSIFY','PROPOSE','VERIFY','RESIZE','APPROVAL','EXECUTE','MONITOR'];
  const evidenceState={liveMarketReady:false,proposalReady:false,riskVerified:false,humanApproved:false,orderSubmitted:false,positionOpen:false};
  const completedLoop= evidenceState.positionOpen ? 8 : evidenceState.orderSubmitted ? 7 : evidenceState.humanApproved ? 6 : evidenceState.riskVerified ? 5 : evidenceState.proposalReady ? 3 : evidenceState.liveMarketReady ? 1 : 0;
  const rankedCandidates=['SPY','QQQ','AAPL','NVDA'];
  return <div data-render-ready="true" data-render-stage={stage} className={`cinematic-remaster cinematic-${stage} ${danger?'danger':''} ${safe?'safe':''}`}>
    <div className="market-index-bar">{['S&P 500','NASDAQ','DOW','VIX'].map(name=><div key={name}><b>{name}</b><span>—</span><em>AWAITING LIVE DATA</em></div>)}</div>
    <div className="autonomous-loop"><header><b>AUTONOMOUS DECISION LOOP</b><span>MARKET INPUT PENDING · PAPER EXECUTION LOCKED</span></header><div>{loopStages.map((name,i)=><span className={i===completedLoop?'active':i<completedLoop?'complete':''} key={name}><i>{i<completedLoop?'✓':String(i+1).padStart(2,'0')}</i><b>{name}</b></span>)}</div></div>
    <div className="cinematic-depth-field" aria-hidden="true">{Array.from({length:18},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div>
    <div className="market-hero" aria-hidden="true">
      <div className="market-symbol"><b>SPY</b><span>AWAITING LIVE MARKET DATA</span></div>
      <div className="market-empty-chart"><b>AWAITING LIVE ALPACA TIME SERIES</b><span>NO SYNTHETIC CANDLES · NO SIMULATED PRICE PATH</span></div>
      <div className="market-tape">EXPIRATION&nbsp;— &nbsp; STRIKE&nbsp;— &nbsp; BID&nbsp;— &nbsp; ASK&nbsp;— &nbsp; IV&nbsp;— &nbsp; OI&nbsp;— &nbsp; DELTA&nbsp;—</div>
    </div>
    <div className="option-ladder" aria-hidden="true"><header>LIVE OPTIONS CHAIN</header>{['CALL · —','CALL · —','CANDIDATE LEG · —','CANDIDATE LEG · —','PUT · —'].map((x,i)=><div className={i===2||i===3?'candidate':''} key={x+i}><b>{x}</b><span>BID —</span><span>ASK —</span><span>OI —</span></div>)}</div>
    <div className="market-watchlist"><header>AI WATCHLIST</header>{['SPY','QQQ','IWM','AAPL','NVDA'].map((name)=><div key={name}><b>{name}</b><span>—%</span><em>AWAITING LIVE SCORE</em></div>)}</div>
    <div className="market-position"><header>PAPER POSITION</header><strong>PAPER P&amp;L&nbsp; —</strong><div><span>AVG ENTRY</span><b>—</b></div><div><span>CURRENT</span><b>—</b></div><div><span>QTY / RETURN</span><b>— / —%</b></div><footer>NO POSITION · NOT SUBMITTED</footer></div>
    <div className="market-order-timeline"><b>ORDER LIFECYCLE</b><span>APPROVAL&nbsp; ○</span><i>→</i><span>SUBMITTED&nbsp; ○</span><i>→</i><span>FILLED&nbsp; ○</span><i>→</i><span>CLOSED&nbsp; ○</span></div>
    <div className="ai-decision-core" aria-label="AI decision core awaiting verified live market data">
      <header><span>LIVE MARKET INPUT</span><b>AI DECISION CORE</b><em>AWAITING VERIFIED ALPACA DATA</em></header>
      <div className="core-orbits" aria-hidden="true">
        {rankedCandidates.map((symbol,i)=><span className={`orbit orbit-${i+1}`} key={symbol}><i>{symbol}</i><strong>PENDING</strong><small>PRICE — &nbsp; CHG —% &nbsp; VOL —</small></span>)}
      </div>
      <div className="core-engine"><small>SELECTION PENDING</small><strong>CONFIDENCE<br/>—%</strong><em>RANKING SCORE —</em></div>
      <div className="core-verification"><span>MODEL <b>GEMINI-3.8-FLASH</b></span><span>RESPONSE <b>18,825 MS</b></span><span>SCHEMA <b>PASS</b></span></div>
      <footer><span>SELECTED CONTRACT</span><b>AWAITING LIVE OPTIONS CHAIN</b><em>NO ORDER SUBMITTED</em></footer>
    </div>
    <div className="digital-twin">
      <header><span>MARKET DIGITAL TWIN</span><b>ONE SIGNAL · TWO PRE-TRADE FUTURES</b></header>
      <section className="future original"><small>ORIGINAL FUTURE</small><strong>QUANTITY — <em>LIVE INPUT PENDING</em></strong><div className="pnl-axis"><i/><em>EXPECTED P&amp;L CURVE PENDING</em></div><dl><dt>MAX LOSS</dt><dd>$—</dd><dt>ACCOUNT RISK</dt><dd>—%</dd><dt>DECISION</dt><dd>AWAITING DATA</dd></dl></section>
      <div className="twin-split"><span>AI<br/>PROPOSAL</span><i>⇢</i><b>RISK<br/>ENGINE</b><i>⇢</i></div>
      <section className="future controlled"><small>CONTROLLED FUTURE</small><strong>QUANTITY — <em>RISK RESULT PENDING</em></strong><div className="pnl-axis"><i/><em>EXPECTED P&amp;L CURVE PENDING</em></div><dl><dt>MAX LOSS</dt><dd>$—</dd><dt>REMAINING CAPACITY</dt><dd>$—</dd><dt>DECISION</dt><dd>AWAITING DATA</dd></dl></section>
    </div>
    <div className="decision-lineage"><span>INPUT HASH</span><i>→</i><span>GEMINI</span><i>→</i><span>RISK GATE</span><i>→</i><span>HUMAN</span><i>→</i><span>ALPACA PAPER</span><i>→</i><span>RESULT HASH</span></div>
    <div className="cinematic-copy"><small>{eyebrow}</small><b>{headline}</b><span>{status}</span></div>
    <div className="cinematic-proof"><span>GEMINI · STRUCTURED DECISION</span><span>ALPACA · PAPER TRADING</span><span>DETERMINISTIC · RISK GATE</span></div>
  </div>;
}
