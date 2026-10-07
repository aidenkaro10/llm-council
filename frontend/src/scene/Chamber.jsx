import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Environment,
  Lightformer,
  MeshReflectorMaterial,
  PerformanceMonitor,
  Sparkles,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { easing } from 'maath';
import * as THREE from 'three';
import Mech3D from './Mech3D';
import CourtSet from './CourtSet';
import Audience from './Audience';
import { colorFor, vendorOf, shortName } from '../components/brand';
import './chamber.css';

const CHAIRMAN_SPOT = [0, 1.05, -4.4];
const CHAIR_SCALE = 1.28;
const FOV = 34;

const calmByDefault =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Where each judge stands. Wide screens get a shallow arc with the ends curving
 * towards the viewer. Narrow screens get a tight staggered line, so the judges
 * stay a decent size instead of shrinking to fit a wide arc.
 */
function seatsFor(count, compact) {
  if (compact) {
    return Array.from({ length: count }, (_, i) => [
      (i - (count - 1) / 2) * 1.12,
      0,
      i % 2 === 0 ? -0.7 : 0.45,
    ]);
  }
  const radius = Math.max(3.2, count * 0.9);
  const spread = Math.min(1.15, 0.32 * count); // radians either side
  return Array.from({ length: count }, (_, i) => {
    const a = count === 1 ? 0 : -spread + (i / (count - 1)) * spread * 2;
    return [radius * Math.sin(a), 0, -radius * Math.cos(a) + radius * 0.62];
  });
}

/** Which way a judge faces at rest: towards the viewer, angled in slightly. */
function restingYaw([x, , z]) {
  return Math.atan2(x * 0.4 - x, 12 - z);
}

/** Thin streaks of light rushing up behind the council while it works. */
function Streaks({ active, count = 46 }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lines = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 22,
        z: -5 - Math.random() * 7,
        y: Math.random() * 12 - 2,
        speed: 3 + Math.random() * 6,
        length: 0.6 + Math.random() * 1.8,
      })),
    [count]
  );

  useFrame((_, dt) => {
    if (!mesh.current) return;
    const mat = mesh.current.material;
    easing.damp(mat, 'opacity', active ? 0.55 : 0, 0.6, dt);
    if (mat.opacity < 0.01) return;

    lines.forEach((l, i) => {
      l.y += l.speed * dt;
      if (l.y > 11) l.y = -2;
      dummy.position.set(l.x + l.y * 0.18, l.y, l.z);
      dummy.rotation.set(0, 0, -0.18);
      dummy.scale.set(1, l.length, 1);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <planeGeometry args={[0.018, 1]} />
      <meshBasicMaterial
        color="#cfe3ff"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/** A huge slow-turning ring of light behind the chairman. */
function Halo({ color, active }) {
  const outer = useRef();
  const inner = useRef();
  useFrame((_, dt) => {
    if (outer.current) outer.current.rotation.z += dt * 0.05;
    if (inner.current) inner.current.rotation.z -= dt * 0.08;
    [outer, inner].forEach((r) => {
      if (r.current) easing.damp(r.current.material, 'opacity', active ? 0.95 : 0.4, 0.8, dt);
    });
  });
  return (
    <group position={[0, 3.9, -6.6]}>
      <mesh ref={outer}>
        <torusGeometry args={[3.6, 0.022, 8, 160]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh ref={inner} rotation={[0, 0, 0.6]}>
        <torusGeometry args={[3.1, 0.012, 8, 160, Math.PI * 1.6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Shift the picture so the council sits in the space the panel leaves free. */
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

/** A spotlight that glides to whoever has the floor. */
function FloorLight({ target }) {
  const light = useRef();
  const aim = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    if (!light.current) return;
    const [x, y, z] = target || [0, 1.8, -1];
    easing.damp3(light.current.position, [x * 0.9, 8, z + 3.5], 0.5, dt);
    easing.damp3(aim.position, [x, y, z], 0.4, dt);
    easing.damp(light.current, 'intensity', target ? 70 : 0, 0.4, dt);
  });
  return (
    <>
      <primitive object={aim} />
      <spotLight ref={light} target={aim} angle={0.28} penumbra={0.75} intensity={0} color="#fff3df" distance={16} decay={1.2} />
    </>
  );
}

/** Crackling energy between two judges going at each other. */
function Clash({ from, to, color }) {
  // From chest to chest, swinging out over the floor in front of the bench,
  // so it never hides behind the speech bubbles above the heads
  const curve = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.35, 1.9));
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  }, [from, to]);
  const outer = useMemo(() => new THREE.TubeGeometry(curve, 64, 0.055, 10, false), [curve]);
  const inner = useMemo(() => new THREE.TubeGeometry(curve, 64, 0.02, 8, false), [curve]);
  const glow = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [color]
  );
  const core = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    []
  );
  const pulse = useRef();
  const born = useRef(null);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (born.current === null) born.current = t;
    // fade in, then crackle
    const life = Math.min(1, (t - born.current) / 0.25);
    const flicker = 0.6 + Math.sin(t * 37) * 0.2 + Math.sin(t * 23 + 1) * 0.2;
    easing.damp(glow, 'opacity', life * flicker * 0.9, 0.05, dt);
    easing.damp(core, 'opacity', life * flicker, 0.05, dt);
    if (pulse.current) {
      pulse.current.position.copy(curve.getPoint((t * 1.1) % 1));
    }
  });

  return (
    <group>
      <mesh geometry={outer} material={glow} />
      <mesh geometry={inner} material={core} />
      <mesh ref={pulse} material={core}>
        <sphereGeometry args={[0.12, 16, 16]} />
      </mesh>
    </group>
  );
}

/**
 * Moves the camera with the story. Wide while waiting, drifting towards
 * whoever has the floor, in close for the verdict. A slow dolly every time,
 * never a cut, with a smooth shake when a gavel lands hard.
 */
function CameraRig({ phase, focus, seats, council, intro, calm, fit, freeHeight, voiceSpot, judgeOnFloor, shake, compact }) {
  const { camera } = useThree();
  const base = useRef(new THREE.Vector3(0, 2.3, 10.5));
  const look = useRef(new THREE.Vector3(0, 1.8, -1));
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (intro && !calm) {
      // start high above and far back, then fly in
      base.current.set(0, 11, 24);
      look.current.set(0, 1, -2);
    }
    camera.position.copy(base.current);
    started.current = true;
  }, [camera, intro, calm]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    let pos;
    let target;
    let smooth = 0.8;

    const focusIndex = focus ? council.findIndex((c) => c.model === focus) : -1;

    if (focusIndex >= 0) {
      const [x, , z] = seats[focusIndex];
      pos = [x * 0.85, 2.4, z + 4.4 + (1 - freeHeight) * 5];
      target = [x, 2, z];
    } else if (judgeOnFloor && voiceSpot && phase !== 'idle' && phase !== 'done') {
      // a medium shot on whoever is talking, or reacting: the sitcom angle
      const [vx, , vz] = voiceSpot;
      const sway = calm ? 0 : Math.sin(t * 0.2) * 0.25;
      // on a narrow screen, centre the speaker so their bubble isn't cut off
      pos = [vx * (compact ? 0.9 : 0.6) + sway, 2.4, vz + 8.4 * fit * 0.82];
      target = [vx * (compact ? 1 : 0.8), 2.2, vz];
      smooth = 0.65;
    } else if (phase === 'verdict') {
      pos = [0, 4.1, 2.6 + (1 - freeHeight) * 6];
      target = [CHAIRMAN_SPOT[0], 3.7, CHAIRMAN_SPOT[2]];
      smooth = 1;
    } else if (phase === 'opinions' || phase === 'review') {
      // between lines: the whole room
      const low = phase === 'review';
      const sway = calm ? 0 : Math.sin(t * 0.18) * 0.4;
      pos = [sway, low ? 1.8 : 2.3, (low ? 10 : 10.4) * fit];
      target = [0, 2.1, -1];
      smooth = 1.1;
    } else {
      const sway = calm ? 0 : Math.sin(t * 0.1) * 1.4;
      pos = [sway, 2.6 + (fit - 1) * 1.2, 10.8 * fit];
      target = [0, 2.2, -1.2];
    }

    // the fly-in is slower than everyday camera moves
    if (intro && t < 3.5) smooth = 1.2;
    easing.damp3(base.current, pos, smooth, dt);
    easing.damp3(look.current, target, smooth * 0.8, dt);

    camera.position.copy(base.current);

    // a smooth shake that fades out, not random jitter
    if (shake && !calm) {
      const age = (performance.now() - shake.at) / 1000;
      if (age >= 0 && age < 0.55) {
        const amp = shake.strength * Math.pow(1 - age / 0.55, 2);
        camera.position.x += amp * (Math.sin(t * 41) * 0.6 + Math.sin(t * 67 + 1.3) * 0.4);
        camera.position.y += amp * (Math.sin(t * 47 + 0.7) * 0.6 + Math.sin(t * 59 + 2.1) * 0.4);
      }
    }
    camera.lookAt(look.current);
  });

  return null;
}

/**
 * The courtroom. A full-screen 3D stage behind the app.
 *
 * council: [{ model, state, text, cost, won }]
 * chairman: { model, state, text, cost } or null
 * phase: 'idle' | 'opinions' | 'review' | 'verdict' | 'done'
 * show: what the director is staging (see useShow)
 */
export default function Chamber({
  council,
  chairman,
  phase,
  show,
  question,
  labels,
  focus,
  onFocus,
  offset = { x: 0, y: 0 },
  // width of the space the chamber gets, divided by the full screen height
  freeAspect = 1.6,
  // how much of the screen height the chamber gets (all of it on desktop)
  freeHeight = 1,
  intro = false,
  lite = false,
  onReady,
}) {
  const calm = calmByDefault;
  const compact = freeAspect < 0.9;
  const seats = useMemo(() => seatsFor(council.length, compact), [council.length, compact]);
  const yaws = useMemo(() => seats.map(restingYaw), [seats]);

  // Shrink the render resolution if the device starts struggling, so motion
  // stays fluid instead of stuttering
  const maxDpr = lite ? 1.5 : 2;
  const [dpr, setDpr] = useState(maxDpr);

  // How much further back the wide shots must be so the whole court is in
  // frame. The field of view is vertical, so width and height are separate.
  const fit = useMemo(() => {
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const widest = Math.max(...seats.map(([x]) => Math.abs(x)), 0);
    const neededWidth = widest * 2 + (compact ? 2.6 : 4.4);
    const neededHeight = 5.8;
    const byWidth = neededWidth / (2 * tan * Math.max(freeAspect, 0.3));
    const byHeight = neededHeight / (2 * tan * freeHeight);
    return Math.max(1, byWidth / 10.6, byHeight / 10.6);
  }, [seats, compact, freeAspect, freeHeight]);

  const working = phase === 'opinions' || phase === 'review' || phase === 'verdict';
  const chairColor = chairman ? colorFor(chairman.model) : '#8fa7ff';
  const s = show || {};

  const headOf = (i) => [seats[i][0], 2.35, seats[i][2]];
  const chairHead = [CHAIRMAN_SPOT[0], CHAIRMAN_SPOT[1] + 2.2 * CHAIR_SCALE, CHAIRMAN_SPOT[2]];

  const voiceIndex = s.voice ? council.findIndex((c) => c.model === s.voice) : -1;
  const voiceSpot = s.voice === 'chair' ? chairHead : voiceIndex >= 0 ? headOf(voiceIndex) : null;
  // a beat into a roast, the camera cuts to the face of whoever is on the receiving end
  const reactorIndex =
    s.reactor && performance.now() - s.reactor.at < 1900 ? council.findIndex((c) => c.model === s.reactor.who) : -1;
  const shotSpot = reactorIndex >= 0 ? headOf(reactorIndex) : voiceSpot;
  const judgeOnFloor = voiceIndex >= 0 || reactorIndex >= 0;

  // Who looks at whom: a judge faces whoever they're addressing, the one being
  // addressed turns to face them, and in cross-examination the two sides of an
  // argument face off
  const now = performance.now();
  const clashFrom = s.clash ? council.findIndex((c) => c.model === s.clash.from) : -1;
  const clashTo = s.clash ? council.findIndex((c) => c.model === s.clash.to) : -1;
  const indexOf = (model) => council.findIndex((c) => c.model === model);

  const yawTowards = (i, other) => {
    const [x, , z] = seats[i];
    const [tx, tz] = other >= 0 ? [seats[other][0], seats[other][2]] : [0, -1];
    const want = Math.atan2(tx - x, tz - z) - yaws[i];
    return Math.atan2(Math.sin(want), Math.cos(want));
  };

  const turnFor = (i) => {
    const model = council[i].model;
    const g = s.gestures?.[model];
    if (g?.target && now - g.at < 2600) return THREE.MathUtils.clamp(yawTowards(i, indexOf(g.target)), -0.6, 0.6);
    if (s.reactor?.who === model && now - s.reactor.at < 2600 && s.voice && s.voice !== 'chair') {
      return THREE.MathUtils.clamp(yawTowards(i, indexOf(s.voice)), -0.6, 0.6);
    }
    if (phase !== 'review') return 0;
    const other = i === clashFrom ? clashTo : i === clashTo ? clashFrom : -1;
    return THREE.MathUtils.clamp(yawTowards(i, other), -0.6, 0.6);
  };

  // where a pointing judge aims the gavel, relative to where its body faces
  const aimFor = (i) => {
    const g = s.gestures?.[council[i].model];
    if (!g?.target) return 0;
    return yawTowards(i, indexOf(g.target)) - turnFor(i);
  };

  // Keep the beam's endpoints stable between renders so it doesn't flicker.
  // Each end sits at a judge's glowing chest core.
  const clashEnds = useMemo(() => {
    if (clashFrom < 0 || clashTo < 0) return null;
    const chest = (i) => [
      seats[i][0] + Math.sin(yaws[i]) * 0.4,
      1.4,
      seats[i][2] + Math.cos(yaws[i]) * 0.4,
    ];
    return [chest(clashFrom), chest(clashTo)];
  }, [clashFrom, clashTo, seats, yaws]);

  const benchCouncil = useMemo(
    () => council.map((j) => ({ model: j.model, color: colorFor(j.model), label: shortName(j.model), cost: j.cost })),
    [council]
  );

  return (
    <Canvas
      className="chamber-canvas"
      dpr={dpr}
      camera={{ fov: FOV, near: 0.1, far: 120, position: [0, 2.3, 10.5] }}
      gl={{ antialias: !lite, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        onReady?.();
      }}
      onPointerMissed={() => onFocus?.(null)}
    >
      {/* step down once if the device struggles, and stay there: bouncing
          back up would resize the canvas again and cause a flicker */}
      <PerformanceMonitor onDecline={() => setDpr(1)} onFallback={() => setDpr(1)} />

      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', 10.6 * fit + 4, 10.6 * fit + 22]} />

      <ViewOffset x={offset.x} y={offset.y} />
      <CameraRig
        phase={phase}
        focus={focus}
        seats={seats}
        council={council}
        intro={intro}
        calm={calm}
        fit={fit}
        freeHeight={freeHeight}
        voiceSpot={shotSpot}
        judgeOnFloor={judgeOnFloor}
        shake={s.shake}
        compact={compact}
      />

      {/* warm court lighting, plus soft studio light for the glossy paint */}
      <ambientLight intensity={0.22} />
      <directionalLight position={[3, 8, 6]} intensity={1.1} color="#ffe9d2" />
      <spotLight position={[0, 10, 4]} angle={0.6} penumbra={1} intensity={working ? 34 : 24} color="#ffe2bd" />
      <FloorLight target={voiceSpot} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 5, 4]} scale={[8, 2, 1]} color="#fff1dc" />
        <Lightformer form="rect" intensity={1.4} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} color="#9db4ff" />
        <Lightformer form="rect" intensity={1.4} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} color="#ffb59d" />
      </Environment>

      <Suspense fallback={null}>
        <CourtSet
          seats={seats}
          yaws={yaws}
          council={benchCouncil}
          compact={compact}
          chairSpot={CHAIRMAN_SPOT}
          chairScale={CHAIR_SCALE}
          chairColor={chairColor}
          chairLabel={chairman ? `Chairman · ${shortName(chairman.model)}` : 'Chairman'}
          chairCost={chairman?.cost || 0}
          lite={lite}
        />

        {/* the council */}
        {council.map((judge, i) => (
          <Mech3D
            key={judge.model + i}
            model={judge.model}
            color={colorFor(judge.model)}
            vendor={vendorOf(judge.model)}
            state={judge.state}
            text={judge.text}
            won={judge.won}
            variant={i}
            position={seats[i]}
            faceYaw={yaws[i]}
            turn={turnFor(i)}
            aimYaw={aimFor(i)}
            phaseOffset={i * 1.3}
            onSelect={onFocus}
            showLabels={!lite || phase !== 'idle'}
            isVoice={judge.model === s.voice}
            slamAt={s.slams?.[judge.model] || 0}
            burst={s.bursts?.[judge.model] || null}
            line={s.lines?.[judge.model] || null}
            emotion={s.emotions?.[judge.model] || null}
            gesture={s.gestures?.[judge.model] || null}
          />
        ))}

        {/* the chairman, raised up behind the high bench */}
        {chairman && (
          <Mech3D
            model={chairman.model}
            color={chairColor}
            vendor={vendorOf(chairman.model)}
            state={chairman.state}
            text={chairman.text}
            variant={1}
            position={CHAIRMAN_SPOT}
            faceYaw={0}
            scale={CHAIR_SCALE}
            phaseOffset={0.7}
            onSelect={onFocus}
            isVoice={s.voice === 'chair'}
            slamAt={s.slams?.chair || 0}
            line={s.lines?.chair || null}
            emotion={s.emotions?.chair || null}
            subtitle={!Object.keys(s.lines || {}).some((k) => k !== 'chair')}
            labels={labels}
          />
        )}

        {s.clash && clashEnds && (
          <Clash key={s.clash.at} from={clashEnds[0]} to={clashEnds[1]} color={colorFor(s.clash.from)} />
        )}

        <Audience crowd={s.crowd} lite={lite} />

        <Halo color={chairColor} active={phase === 'verdict' || phase === 'done'} />
        <Sparkles count={lite ? 30 : 70} scale={[16, 8, 10]} position={[0, 3, -2]} size={1.6} speed={0.25} opacity={0.5} color="#ffe6c4" />
        {!calm && <Streaks active={phase === 'review'} count={lite ? 20 : 40} />}

        {/* a dark glossy floor that reflects the glowing heads */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[60, 60]} />
          <MeshReflectorMaterial
            blur={[300, 80]}
            resolution={lite ? 256 : 768}
            mixBlur={1}
            mixStrength={lite ? 18 : 30}
            roughness={0.9}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#07080c"
            metalness={0.6}
            mirror={0.5}
          />
        </mesh>
      </Suspense>

      <EffectComposer multisampling={lite ? 0 : 4} disableNormalPass>
        <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={lite ? 0.8 : 1.1} />
        <Vignette eskil={false} offset={0.18} darkness={0.75} />
        {!lite && <Noise opacity={0.03} />}
      </EffectComposer>
    </Canvas>
  );
}
