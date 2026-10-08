import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise, DepthOfField } from '@react-three/postprocessing';
import { easing } from 'maath';
import * as THREE from 'three';
import Mech3D from './Mech3D';
import CourtSet, { COUNSEL } from './CourtSet';
import Audience from './Audience';
import { colorFor, vendorOf } from '../components/brand';
import './chamber.css';

const CHAIRMAN_SPOT = [0, 1.05, -4.4];
const CHAIR_SCALE = 1.28;
const FOV = 32;
const SEAT_GAP = 1.7;

const calmByDefault =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Counsel seats: two tables, split as evenly as possible, facing the bench. */
function seatsFor(count) {
  const leftCount = Math.ceil(count / 2);
  const rightCount = count - leftCount;
  const row = (n, cx) => Array.from({ length: n }, (_, j) => [cx + (j - (n - 1) / 2) * SEAT_GAP, 0, COUNSEL.seatZ]);
  return [...row(leftCount, -COUNSEL.tableX), ...row(rightCount, COUNSEL.tableX)];
}

/** Shift the picture so the court sits in the space the panel leaves free. */
function ViewOffset({ x = 0, y = 0 }) {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.setViewOffset(size.width, size.height, -x, y, size.width, size.height);
    camera.updateProjectionMatrix();
    return () => {
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
  }, [camera, size.width, size.height, x, y]);
  return null;
}

/**
 * Court TV coverage. The camera cuts between set-ups, like a real broadcast:
 * a wide from the gallery, a three-quarter wide, the judge, and whoever is
 * speaking or reacting. On each shot it pushes in slowly.
 */
function shotFor({ key, seats, fit }) {
  const back = Math.min(15, 9.2 + (fit - 1) * 6);
  if (key === 'wideA') return { pos: [0, 3.9, back], look: [0, 1.9, -2.6] };
  if (key === 'wideB') return { pos: [7.4, 3.4, 5.8], look: [-0.8, 1.7, -1.4] };
  if (key === 'judge') return { pos: [0.9, 3.1, 3.4], look: [0, 3.35, CHAIRMAN_SPOT[2]] };
  if (key === 'open') return { pos: [0, 8.5, 15], look: [0, 2, -3] };
  // a speaker or a reaction: from just in front of the bench (never inside
  // it), looking back at their face, with the gallery behind them
  const i = Number(key.split(':')[1]);
  const [x, , z] = seats[i] || [0, 0, COUNSEL.seatZ];
  const side = x < 0 ? 1 : -1;
  const tight = key.startsWith('react') ? 0.85 : 1;
  return { pos: [x + side * 0.9 * tight, 2.45, z - 3.7 * tight], look: [x, 1.95, z] };
}

function CameraRig({ shotKey, seats, fit, lens, intro, calm, onFocusPoint }) {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const goal = useRef(new THREE.Vector3());
  const current = useRef(null);
  const introDone = useRef(!intro || calm);

  useFrame((state, dt) => {
    if (current.current !== shotKey) {
      const shot = shotFor({ key: shotKey, seats, fit });
      const first = current.current === null;
      current.current = shotKey;
      if (first && !introDone.current) {
        // the opening crane shot, from high above the gallery
        const crane = shotFor({ key: 'open', seats, fit });
        pos.current.set(...crane.pos);
        look.current.set(...crane.look);
      } else if (first || !calm) {
        // a cut: jump straight to the new set-up, like an editor would
        pos.current.set(...shot.pos);
        look.current.set(...shot.look);
      }
      // the slow push-in: a few percent closer over the life of the shot
      const p = new THREE.Vector3(...shot.pos);
      const l = new THREE.Vector3(...shot.look);
      goal.current.copy(p).lerp(l, calm ? 0 : 0.07);
      onFocusPoint?.(shot.look);
    }

    // On a narrow screen (a phone held upright) a normal lens would only see
    // a sliver of the room, so widen it instead of backing the camera out
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * lens));
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const shot = shotFor({ key: shotKey, seats, fit });
    const slow = !introDone.current ? 1.6 : 3.2;
    easing.damp3(pos.current, goal.current, slow, dt);
    easing.damp3(look.current, shot.look, !introDone.current ? 1.4 : 0.6, dt);
    if (!introDone.current && state.clock.elapsedTime > 4) introDone.current = true;

    camera.position.copy(pos.current);
    camera.lookAt(look.current);
  });

  return null;
}

/**
 * The courtroom. A full-screen 3D stage behind the app.
 *
 * council: [{ model, state, won }]
 * chairman: { model, state } or null
 * phase: 'idle' | 'opinions' | 'review' | 'verdict' | 'done'
 * show: what the director is staging (see useShow)
 */
export default function Chamber({
  council,
  chairman,
  phase,
  show,
  focus,
  onFocus,
  offset = { x: 0, y: 0 },
  freeAspect = 1.6,
  freeHeight = 1,
  intro = false,
  lite = false,
  onReady,
}) {
  const calm = calmByDefault;
  const seats = useMemo(() => seatsFor(council.length), [council.length]);
  const s = show || {};
  const now = performance.now();

  const maxDpr = lite ? 1.5 : 2;
  const [dpr, setDpr] = useState(maxDpr);
  const [focusPoint, setFocusPoint] = useState([0, 2, -2]);

  // how much further back the wide shots must sit so the room fits the space
  // how much wider than normal the lens is (1 on a desktop, about 2 on a phone)
  const lens = Math.max(1, 1 / Math.max(freeAspect, 0.3), 0.85 / freeHeight);
  const fit = useMemo(() => {
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * lens;
    const neededWidth = 12;
    const neededHeight = 6.4;
    return Math.max(1, neededWidth / (2 * tan * Math.max(freeAspect, 0.3)) / 14, neededHeight / (2 * tan * freeHeight) / 14);
  }, [freeAspect, freeHeight, lens]);

  const indexOf = (model) => council.findIndex((c) => c.model === model);
  const voiceIndex = s.voice && s.voice !== 'chair' ? indexOf(s.voice) : -1;
  const reactorIndex = s.reactor && now - s.reactor.at < 1900 ? indexOf(s.reactor.who) : -1;
  const focusIndex = focus ? indexOf(focus) : -1;

  // which set-up the director of photography would choose right now
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setBeat((b) => b + 1), 8000);
    return () => clearInterval(id);
  }, []);
  let shotKey;
  if (focusIndex >= 0) shotKey = `speak:${focusIndex}`;
  else if (reactorIndex >= 0) shotKey = `react:${reactorIndex}`;
  else if (voiceIndex >= 0) shotKey = `speak:${voiceIndex}`;
  else if (s.voice === 'chair' || phase === 'verdict') shotKey = 'judge';
  else shotKey = beat % 2 ? 'wideB' : 'wideA';

  // who looks at whom: a speaker turns to whoever they're addressing, the one
  // addressed turns to them; otherwise everyone faces the bench
  const yawTowards = (i, other) => {
    const [x, , z] = seats[i];
    const [tx, tz] = other >= 0 ? [seats[other][0], seats[other][2]] : [0, -4.4];
    const want = Math.atan2(tx - x, tz - z) - Math.PI;
    return Math.atan2(Math.sin(want), Math.cos(want));
  };
  const turnFor = (i) => {
    const g = s.gestures?.[council[i].model];
    if (g?.target && now - g.at < 2600) return THREE.MathUtils.clamp(yawTowards(i, indexOf(g.target)), -0.7, 0.7);
    if (reactorIndex === i && voiceIndex >= 0) return THREE.MathUtils.clamp(yawTowards(i, voiceIndex), -0.7, 0.7);
    return THREE.MathUtils.clamp(yawTowards(i, -1) * 0.5, -0.4, 0.4);
  };
  const aimFor = (i) => {
    const g = s.gestures?.[council[i].model];
    return g?.target ? yawTowards(i, indexOf(g.target)) - turnFor(i) : 0;
  };

  const chairColor = chairman ? colorFor(chairman.model) : '#8fa7ff';
  const shadows = !lite;

  return (
    <Canvas
      className="chamber-canvas"
      dpr={dpr}
      shadows={shadows ? 'soft' : false}
      camera={{ fov: FOV, near: 0.1, far: 120, position: [0, 3.9, 10] }}
      gl={{ antialias: !lite, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        onReady?.();
      }}
      onPointerMissed={() => onFocus?.(null)}
    >
      {/* step down once if the device struggles, and stay there */}
      <PerformanceMonitor onDecline={() => setDpr(1)} onFallback={() => setDpr(1)} />

      <color attach="background" args={['#120c08']} />
      <fog attach="fog" args={['#1a120c', 22, 60]} />

      <ViewOffset x={offset.x} y={offset.y} />
      <CameraRig shotKey={shotKey} seats={seats} fit={fit} lens={lens} intro={intro} calm={calm} onFocusPoint={setFocusPoint} />

      {/* daylight through the tall windows on the left, warm and soft */}
      <hemisphereLight args={['#ffe9cc', '#3a2414', 0.55]} />
      <ambientLight intensity={0.12} />
      <directionalLight
        position={[-12, 11, 1.5]}
        intensity={2.6}
        color="#ffe5bf"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-far={40}
      />
      <directionalLight position={[7, 6, 11]} intensity={0.45} color="#d7e2ff" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[-8, 5, 0]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} color="#ffe8cc" />
        <Lightformer form="rect" intensity={0.8} position={[0, 7, 6]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} color="#fff3e0" />
      </Environment>

      <Suspense fallback={null}>
        <CourtSet seats={seats} chairSpot={CHAIRMAN_SPOT} chairScale={CHAIR_SCALE} lite={lite} />
        <Audience crowd={s.crowd} lite={lite} />

        {/* counsel */}
        {council.map((judge, i) => (
          <Mech3D
            key={judge.model + i}
            model={judge.model}
            color={colorFor(judge.model)}
            vendor={vendorOf(judge.model)}
            role="counsel"
            state={judge.state}
            won={judge.won}
            position={seats[i]}
            faceYaw={Math.PI}
            turn={turnFor(i)}
            aimYaw={aimFor(i)}
            phaseOffset={i * 1.3}
            onSelect={onFocus}
            standing={i === voiceIndex || (phase === 'done' && judge.won)}
            talking={i === voiceIndex}
            slamAt={s.slams?.[judge.model] || 0}
            emotion={s.emotions?.[judge.model] || null}
            gesture={s.gestures?.[judge.model] || null}
            shadows={shadows}
          />
        ))}

        {/* the judge, at the high bench */}
        {chairman && (
          <Mech3D
            model={chairman.model}
            color={chairColor}
            vendor={vendorOf(chairman.model)}
            role="judge"
            state={chairman.state}
            position={CHAIRMAN_SPOT}
            faceYaw={0}
            scale={CHAIR_SCALE}
            phaseOffset={0.7}
            onSelect={onFocus}
            talking={s.voice === 'chair'}
            slamAt={s.slams?.chair || 0}
            emotion={s.emotions?.chair || null}
            shadows={shadows}
          />
        )}

        {/* dust drifting in the window light */}
        {!lite && <Sparkles count={60} scale={[6, 5, 9]} position={[-7.5, 3.5, 0.5]} size={1.4} speed={0.15} opacity={0.35} color="#fff1d6" />}
      </Suspense>

      <EffectComposer multisampling={lite ? 0 : 4} disableNormalPass>
        {!lite && <DepthOfField target={focusPoint} focalLength={0.025} bokehScale={2.2} height={480} />}
        <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.15} intensity={0.45} />
        <Vignette eskil={false} offset={0.25} darkness={0.55} />
        {!lite && <Noise opacity={0.022} />}
      </EffectComposer>
    </Canvas>
  );
}
