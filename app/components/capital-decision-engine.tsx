'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Color, InstancedMesh, Object3D, Vector3 } from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronRight,
  Database,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import TribunalExperience from './tribunal-experience';

type Point = {
  symbol: string;
  expiration: string;
  strike: number;
  bid: number;
  ask: number;
  spread_pct: number;
  open_interest: number;
  iv: number | null;
  quote_age_seconds: number | null;
  tradable: boolean;
  classification: 'OPPORTUNITY' | 'UNCERTAIN' | 'RISK BLOCKED';
  classification_reason?: string;
  selected: 'long' | 'short' | null;
};
type Preview = {
  evidence_status: string;
  ai_status: string;
  generated_at: string;
  terrain: Point[];
  market: {
    underlying_price: number;
    underlying_timestamp: string;
    expiration: string;
  };
  selection: {
    long: Point;
    short: Point;
    max_loss: number;
    requested_contracts: number;
    net_debit: number;
  };
  risk: { hard_gate: string; reasons: string[] };
  preview: { status: string; allow_submit: boolean };
};
const COLORS = {
  OPPORTUNITY: '#42e6a4',
  UNCERTAIN: '#ffc95e',
  'RISK BLOCKED': '#ff5f59',
};
const SCENES = [
  { id: 'intake', name: 'RAW MARKET INTAKE', from: 0, to: 3 },
  { id: 'sort', name: 'AI RAPID CLASSIFICATION', from: 3, to: 6 },
  { id: 'converge', name: 'CANDIDATE CONVERGENCE', from: 6, to: 9 },
] as const;
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const smooth = (n: number) => {
  const x = clamp(n);
  return x * x * (3 - 2 * x);
};

function tilePosition(
  point: Point,
  index: number,
  time: number,
) {
  const lane =
    point.classification === 'OPPORTUNITY'
      ? 3.1
      : point.classification === 'UNCERTAIN'
        ? 0
        : -3.1;
  const row = (index % 13) - 6,
    col = Math.floor(index / 13);
  const intake = new Vector3(
    row * 0.68,
    (((index * 7) % 9) - 4) * 0.34,
    -24 + col * 1.18 + (index % 5) * 0.12,
  );
  const sorting = new Vector3(
    lane + row * 0.19,
    (((index * 5) % 11) - 5) * 0.29,
    -7 + col * 0.52,
  );
  const isSelected = point.selected !== null;
  const opportunityIndex = index % 21;
  const converge = isSelected
    ? new Vector3(point.selected === 'long' ? -1.25 : 1.25, 0, 0.4)
    : point.classification === 'OPPORTUNITY'
      ? new Vector3(
          (opportunityIndex - 10) * 0.35,
          ((index % 3) - 1) * 0.26,
          -3 - Math.abs(opportunityIndex - 10) * 0.16,
        )
      : new Vector3(lane * 2, ((index % 11) - 5) * 0.36, -10 - col * 0.2);
  if (time < 3) {
    const p = smooth(time / 3);
    return intake
      .clone()
      .lerp(new Vector3(intake.x * 0.45, intake.y * 0.7, 4 - col * 0.28), p);
  }
  if (time < 6)
    return new Vector3(intake.x * 0.45, intake.y * 0.7, 4 - col * 0.28).lerp(
      sorting,
      smooth((time - 3) / 3),
    );
  return sorting.lerp(converge, smooth((time - 6) / 3));
}

function TileField({ data, time }: { data: Preview; time: number }) {
  const mesh = useRef<InstancedMesh>(null),
    dummy = useMemo(() => new Object3D(), []),
    colors = useMemo(
      () => data.terrain.map((p) => new Color(COLORS[p.classification])),
      [data],
    );
  const { camera } = useThree();
  useFrame(() => {
    if (!mesh.current) return;
    data.terrain.forEach((p, i) => {
      const v = tilePosition(p, i, time);
      dummy.position.copy(v);
      dummy.rotation.set(-0.06, 0, 0);
      const near = time < 3 ? clamp((v.z + 18) / 16, 0.18, 1) : 1;
      dummy.scale.set(1.15, 0.5, 0.045 * near);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
      mesh.current!.setColorAt(i, colors[i]);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
    const target =
      time < 3
        ? new Vector3(0, 0.2, 8 - time * 3.3)
        : time < 6
          ? new Vector3(0, 8.5, 8)
          : new Vector3(0, 2.7, 8.5);
    camera.position.lerp(target, 0.055);
    camera.lookAt(0, time < 6 ? 0 : 0.2, time < 3 ? -3 : 0);
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, data.terrain.length]}
      frustumCulled={false}
    >
      <boxGeometry args={[1.6, 0.82, 0.08]} />
      <meshStandardMaterial
        roughness={0.28}
        metalness={0.52}
        emissiveIntensity={0.36}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function RepresentativeLabels({ data, time }: { data: Preview; time: number }) {
  const sample = useMemo(() => {
    const selected = data.terrain.filter((p) => p.selected);
    const readable = data.terrain.filter((_, i) => i % 31 === 0).slice(0, 6);
    return [...selected, ...readable]
      .filter((p, i, a) => a.findIndex((x) => x.symbol === p.symbol) === i)
      .slice(0, 8);
  }, [data]);
  return (
    <>
      {sample.map((p) => {
        const index = data.terrain.findIndex((x) => x.symbol === p.symbol),
          pos = tilePosition(p, index, time);
        return (
          <Html
            key={p.symbol}
            position={pos}
            transform
            distanceFactor={6.4}
            occlude={false}
            className={`contract-tile ${p.classification.toLowerCase().replace(' ', '-')} ${p.selected ? 'chosen' : ''}`}
          >
            <b>SPY {p.strike}C</b>
            <span>
              EXP {p.expiration.slice(5).replace('-', '/')} · IV{' '}
              {p.iv === null ? 'N/A' : `${(p.iv * 100).toFixed(1)}%`}
            </span>
            <span>
              OI {p.open_interest.toLocaleString()} · {p.bid.toFixed(2)} /{' '}
              {p.ask.toFixed(2)}
            </span>
            <small>
              AGE {Math.round(p.quote_age_seconds ?? 0).toLocaleString()}s
            </small>
          </Html>
        );
      })}
    </>
  );
}

function Tunnel({ data, time }: { data: Preview; time: number }) {
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 8, 9]} intensity={2.4} color="#b7ffff" />
      <pointLight position={[0, 0, 2]} intensity={28} color="#39e7d0" />
      <TileField data={data} time={time} />
      <RepresentativeLabels data={data} time={time} />
      {time < 3 &&
        Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[0, 0, -4 - i * 2.6]}>
            <torusGeometry args={[6.4, 0.025, 4, 48]} />
            <meshBasicMaterial color="#1b817f" transparent opacity={0.42} />
          </mesh>
        ))}
    </>
  );
}

function StaticFallback() {
  return (
    <div className="engine-fallback">
      <b>245 LIVE OPTION CONTRACTS</b>
      <div>
        <span className="green">OPPORTUNITY 21</span>
        <span className="amber">UNCERTAIN 80</span>
        <span className="red">RISK BLOCKED 144</span>
      </div>
      <strong>BUY 765C + SELL 770C</strong>
      <small>MAX LOSS $1,096 · REQUESTED 4 · NOT SUBMITTED</small>
    </div>
  );
}

export default function CapitalDecisionEngine() {
  const [data, setData] = useState<Preview | null>(null),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(true),
    [evidence, setEvidence] = useState(false),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    void fetch('/data/preview.json', { cache: 'no-store' })
      .then((r) => r.json() as Promise<Preview>)
      .then((value) => setData(value))
      .catch(() => setData(null));
  }, []);
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('scene');
    const fixed = SCENES.find((s) => s.id === requested);
    queueMicrotask(() => {
      setReduced(matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (fixed) {
        setTime((fixed.from + fixed.to) / 2);
        setPlaying(false);
      }
    });
  }, []);
  useEffect(() => {
    if (!playing || reduced) return;
    let before = performance.now(),
      raf = 0;
    const loop = (now: number) => {
      setTime((t) => (t + (now - before) / 1000) % 9);
      before = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduced]);
  if (evidence)
    return (
      <div>
        <button className="return-engine" onClick={() => setEvidence(false)}>
          ← RETURN TO DECISION ENGINE
        </button>
        <TribunalExperience />
      </div>
    );
  if (!data)
    return (
      <main className="engine-loading">
        <Activity />
        <b>LOADING SANITIZED REPLAY</b>
      </main>
    );
  const scene = SCENES.find((s) => time >= s.from && time < s.to) ?? SCENES[0],
    counts = data.terrain.reduce(
      (a, p) => {
        a[p.classification] = (a[p.classification] ?? 0) + 1;
        return a;
      },
      {} as Record<string, number>,
    );
  const quarantine = time >= 4.8 && time < 6;
  return (
    <main className="capital-engine">
      <header className="engine-header">
        <div>
          <ShieldAlert />
          <b>THE CAPITAL DECISION ENGINE</b>
          <span>SEOUL SHIELD · ACTUAL ALPACA REPLAY</span>
        </div>
        <div className="engine-status">
          <i /> {data.evidence_status}
        </div>
        <button onClick={() => setEvidence(true)}>
          <Database /> EVIDENCE ROOM
        </button>
      </header>
      <section className="engine-stage">
        {reduced ? (
          <StaticFallback />
        ) : (
          <Canvas
            camera={{ position: [0, 0.2, 8], fov: 58 }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
          >
            <Tunnel data={data} time={time} />
          </Canvas>
        )}
        <div className="engine-vignette" />
        <div className="engine-copy">
          <small>
            {scene.id === 'intake' ? '01' : scene.id === 'sort' ? '02' : '03'} /
            03
          </small>
          <b>{scene.name}</b>
          <span>
            {scene.id === 'intake'
              ? 'REAL CONTRACTS · REAL QUOTES · ZERO ORDERS'
              : scene.id === 'sort'
                ? 'IV · SPREAD · OI · AGE · TRADABILITY'
                : 'TWO LEGS · ONE DEFINED-RISK ORDER'}
          </span>
        </div>
        {scene.id === 'intake' && (
          <div className="hero-counter">
            <strong>245</strong>
            <b>LIVE OPTION CONTRACTS</b>
            <span>STREAMING FROM ALPACA REPLAY</span>
          </div>
        )}
        {scene.id === 'sort' && (
          <div className="sort-counter">
            <div className="green">
              <strong>{counts.OPPORTUNITY}</strong>
              <b>OPPORTUNITY</b>
            </div>
            <div className="amber">
              <strong>{counts.UNCERTAIN}</strong>
              <b>UNCERTAIN</b>
            </div>
            <div className="red">
              <strong>{counts['RISK BLOCKED']}</strong>
              <b>RISK BLOCKED</b>
            </div>
          </div>
        )}
        {quarantine && (
          <div className="quarantine">
            <ShieldAlert />
            <b>
              {Math.floor(time * 3) % 4 === 0
                ? 'STALE'
                : Math.floor(time * 3) % 4 === 1
                  ? 'WIDE SPREAD'
                  : Math.floor(time * 3) % 4 === 2
                    ? 'LOW LIQUIDITY'
                    : 'RISK CAP'}
            </b>
            <span>EXECUTION FIREWALL</span>
          </div>
        )}
        {scene.id === 'converge' && (
          <div className="order-convergence">
            <small>VERIFIED DEBIT SPREAD CANDIDATE</small>
            <b>
              BUY 765C <ChevronRight /> SELL 770C
            </b>
            <div>
              <span>
                MAX LOSS{' '}
                <strong>${data.selection.max_loss.toLocaleString()}</strong>
              </span>
              <span>
                REQUESTED{' '}
                <strong>{data.selection.requested_contracts} CONTRACTS</strong>
              </span>
            </div>
            <em>PAPER PREVIEW · NOT SUBMITTED</em>
          </div>
        )}
        <div className="lane-labels">
          <span className="green">OPPORTUNITY {counts.OPPORTUNITY}</span>
          <span className="amber">UNCERTAIN {counts.UNCERTAIN}</span>
          <span className="red">RISK BLOCKED {counts['RISK BLOCKED']}</span>
        </div>
      </section>
      <footer className="engine-timeline">
        <button onClick={() => setPlaying(!playing)}>
          {playing ? <Pause /> : <Play />}
          {playing ? 'PAUSE' : 'PLAY'}
        </button>
        {SCENES.map((s) => (
          <button
            key={s.id}
            className={scene.id === s.id ? 'active' : ''}
            onClick={() => {
              setTime(s.from + 0.15);
              setPlaying(false);
            }}
          >
            <span>{s.name}</span>
            <i />
          </button>
        ))}
        <button
          onClick={() => {
            setTime(0);
            setPlaying(true);
          }}
        >
          <RotateCcw /> REPLAY 9s
        </button>
        <div className="engine-progress">
          <i style={{ width: `${(time / 9) * 100}%` }} />
        </div>
      </footer>
    </main>
  );
}
