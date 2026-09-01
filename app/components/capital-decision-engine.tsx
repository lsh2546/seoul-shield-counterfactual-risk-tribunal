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
  opportunityRank: number,
) {
  const laneY =
    point.classification === 'OPPORTUNITY'
      ? 3.25
      : point.classification === 'UNCERTAIN'
        ? 0
        : -3.25;
  const side = index % 2 === 0 ? -1 : 1;
  const streamZ = -28 + ((time * 13 + index * 0.71) % 38);
  const intake = new Vector3(
    side * (3.25 + (index % 5) * 0.42),
    (((index * 7) % 13) - 6) * 0.42,
    streamZ,
  );
  const sorting = new Vector3(
    ((index % 19) - 9) * 0.48,
    laneY,
    -7 + Math.floor(index / 19) * 0.64,
  );
  if (time < 3) return intake;
  if (time < 6) return sorting;
  if (point.classification !== 'OPPORTUNITY')
    return new Vector3(sorting.x, sorting.y - 6, sorting.z - 8);
  const survivors = time < 6.75 ? 21 : time < 7.35 ? 8 : time < 7.95 ? 4 : 2;
  if (opportunityRank >= survivors)
    return new Vector3(sorting.x * 1.8, 6.5, -12 - opportunityRank * 0.2);
  if (survivors === 2)
    return new Vector3(point.selected === 'long' ? -2.05 : 2.05, 0.65, 0.3);
  return new Vector3(
    (opportunityRank - (survivors - 1) / 2) * 0.72,
    1.1 + (opportunityRank % 2) * 0.34,
    -2.5 - Math.abs(opportunityRank - survivors / 2) * 0.12,
  );
}

function tileScale(
  point: Point,
  time: number,
  opportunityRank: number,
  z: number,
) {
  if (time < 3) {
    const proximity = clamp((z + 25) / 32, 0.24, 1.25);
    return new Vector3(1.5 * proximity, 0.19 * proximity, 0.035);
  }
  if (time < 6) return new Vector3(1.3, 0.22, 0.035);
  const survivors = time < 6.75 ? 21 : time < 7.35 ? 8 : time < 7.95 ? 4 : 2;
  if (point.classification !== 'OPPORTUNITY' || opportunityRank >= survivors)
    return new Vector3(0.001, 0.001, 0.001);
  return new Vector3(
    survivors === 2 ? 1.55 : 1.35,
    survivors === 2 ? 0.46 : 0.25,
    0.045,
  );
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
      const rank = data.terrain
        .filter((candidate) => candidate.classification === 'OPPORTUNITY')
        .findIndex((candidate) => candidate.symbol === p.symbol);
      const v = tilePosition(p, i, time, rank);
      dummy.position.copy(v);
      dummy.rotation.set(time < 3 ? -0.02 : -0.12, 0, 0);
      dummy.scale.copy(tileScale(p, time, rank, v.z));
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
      mesh.current!.setColorAt(i, colors[i]);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
    const target =
      time < 3
        ? new Vector3(0, 0.2, 8 - time * 1.8)
        : time < 6
          ? new Vector3(0, 6.8, 9.5)
          : new Vector3(0, 2.8, 8.2);
    camera.position.lerp(target, 0.08);
    camera.lookAt(0, time < 3 ? 0 : 0.25, time < 3 ? -5 : -1);
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, data.terrain.length]}
      frustumCulled={false}
    >
      <boxGeometry args={[1.7, 0.8, 0.06]} />
      <meshBasicMaterial transparent opacity={0.62} toneMapped={false} />
    </instancedMesh>
  );
}

function RepresentativeLabels({ data, time }: { data: Preview; time: number }) {
  const sample = useMemo(() => {
    const selected = data.terrain.filter((p) => p.selected);
    const readable = data.terrain.filter((_, i) => i % 31 === 0).slice(0, 6);
    const visible = time >= 7.75 ? selected : [...selected, ...readable];
    return visible
      .filter((p, i, a) => a.findIndex((x) => x.symbol === p.symbol) === i)
      .slice(0, 8);
  }, [data, time]);
  return (
    <>
      {time < 8.05 &&
        sample.map((p) => {
          const index = data.terrain.findIndex((x) => x.symbol === p.symbol),
            rank = data.terrain
              .filter((candidate) => candidate.classification === 'OPPORTUNITY')
              .findIndex((candidate) => candidate.symbol === p.symbol),
            pos = tilePosition(p, index, time, rank);
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
      <ambientLight intensity={0.9} />
      <directionalLight position={[2, 8, 9]} intensity={1.8} color="#d7ffff" />
      <TileField data={data} time={time} />
      <RepresentativeLabels data={data} time={time} />
      {time < 3 &&
        [-5.2, -4.2, -3.2, 3.2, 4.2, 5.2].map((x) => (
          <mesh key={x} position={[x, 0, -10]} scale={[0.012, 0.012, 24]}>
            <boxGeometry />
            <meshBasicMaterial color="#63d8d1" transparent opacity={0.4} />
          </mesh>
        ))}
      {time >= 3 &&
        time < 7.95 &&
        [
          { y: 3.25, color: '#42e6a4' },
          { y: 0, color: '#ffc95e' },
          { y: -3.25, color: '#ff5f59' },
        ].map((lane) => (
          <mesh
            key={lane.y}
            position={[0, lane.y, -3.5]}
            scale={[8.8, 0.025, 9]}
          >
            <boxGeometry />
            <meshBasicMaterial color={lane.color} transparent opacity={0.22} />
          </mesh>
        ))}
      {time >= 8 && (
        <mesh position={[0, 0.65, 0]} scale={[2.75, 0.86, 0.08]}>
          <boxGeometry />
          <meshBasicMaterial
            color="#ffd36e"
            transparent
            opacity={0.2}
            wireframe
          />
        </mesh>
      )}
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
    const params = new URLSearchParams(location.search);
    const requested = params.get('scene');
    const fixed = SCENES.find((s) => s.id === requested);
    const exact = Number(params.get('t'));
    queueMicrotask(() => {
      setReduced(matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (Number.isFinite(exact) && exact >= 0 && exact < 9) {
        setTime(exact);
        setPlaying(false);
      } else if (fixed) {
        setTime(
          fixed.id === 'intake' ? 1.45 : fixed.id === 'sort' ? 5.55 : 8.55,
        );
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
  const sortProgress = smooth((time - 3) / 2.5),
    displayedCounts = {
      opportunity: Math.floor((counts.OPPORTUNITY ?? 0) * sortProgress),
      uncertain: Math.floor((counts.UNCERTAIN ?? 0) * sortProgress),
      blocked: Math.floor((counts['RISK BLOCKED'] ?? 0) * sortProgress),
    },
    survivors = time < 6.75 ? 21 : time < 7.35 ? 8 : time < 7.95 ? 4 : 2;
  const quarantine = time >= 3.35 && time < 6;
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
            <b>CONTRACTS INGESTED</b>
            <span>ACTUAL ALPACA OPTION SNAPSHOT</span>
          </div>
        )}
        {scene.id === 'sort' && (
          <div className="sort-counter">
            <div className="green">
              <strong>{displayedCounts.opportunity}</strong>
              <b>OPPORTUNITY</b>
            </div>
            <div className="amber">
              <strong>{displayedCounts.uncertain}</strong>
              <b>UNCERTAIN</b>
            </div>
            <div className="red">
              <strong>{displayedCounts.blocked}</strong>
              <b>RISK BLOCKED</b>
            </div>
          </div>
        )}
        {quarantine && (
          <div className="quarantine">
            <ShieldAlert />
            <b>
              {Math.floor((time - 3.35) / 0.3) % 4 === 0
                ? 'STALE'
                : Math.floor((time - 3.35) / 0.3) % 4 === 1
                  ? 'SPREAD'
                  : Math.floor((time - 3.35) / 0.3) % 4 === 2
                    ? 'LIQUIDITY'
                    : 'RISK CAP'}
            </b>
            <span>EXECUTION FIREWALL</span>
          </div>
        )}
        {scene.id === 'converge' && time < 8.05 && (
          <div className="compression-counter">
            <small>LIQUID CANDIDATE REDUCTION</small>
            <b>
              21 <i>→</i> {survivors}
            </b>
            <span>STRIKE · EXPIRY · SPREAD · OPEN INTEREST</span>
          </div>
        )}
        {scene.id === 'converge' && time >= 8.05 && (
          <div className="magnet-legs">
            <div>
              <b>SPY 765C</b>
              <span>
                BUY · IV {(data.selection.long.iv! * 100).toFixed(1)}%
              </span>
              <small>
                OI {data.selection.long.open_interest.toLocaleString()}
              </small>
            </div>
            <i>DEFINED RISK RANGE</i>
            <div>
              <b>SPY 770C</b>
              <span>
                SELL · IV {(data.selection.short.iv! * 100).toFixed(1)}%
              </span>
              <small>
                OI {data.selection.short.open_interest.toLocaleString()}
              </small>
            </div>
          </div>
        )}
        {scene.id === 'converge' && time >= 8.05 && (
          <div className="order-convergence">
            <small>VERIFIED DEBIT SPREAD CANDIDATE</small>
            <b>
              BUY 765C <ChevronRight /> SELL 770C
            </b>
            <div>
              <span>
                DEFINED LOSS{' '}
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
