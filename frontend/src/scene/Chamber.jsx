import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Environment,
  Lightformer,
  MeshReflectorMaterial,
  Sparkles,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { easing } from 'maath';
import * as THREE from 'three';
import Mech3D from './Mech3D';
import { colorFor, vendorOf, shortName } from '../components/brand';
import './chamber.css';

const CHAIRMAN_SPOT = [0, 1.05, -4.4];
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

/** Moves the camera with the story: wide while waiting, in close for the verdict. */
function CameraRig({ phase, focus, seats, council, intro, calm, fit, freeHeight }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 1.8, -1));
  const started = useRef(false);

  useEffect(() => {
    if (intro && !calm && !started.current) {
      // start high above and far back, then fly in
      camera.position.set(0, 11, 22);
      look.current.set(0, 1, -2);
    } else if (!started.current) {
      camera.position.set(0, 2.3, 10.5);
    }
    started.current = true;
  }, [camera, intro, calm]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    let pos;
    let target;

    const focusIndex = focus ? council.findIndex((c) => c.model === focus) : -1;

    if (focusIndex >= 0) {
      const [x, , z] = seats[focusIndex];
      // close-ups need more room when the chamber only has part of the screen
      pos = [x * 0.85, 2.3, z + 4.2 + (1 - freeHeight) * 5];
      target = [x, 1.9, z];
    } else if (phase === 'verdict') {
      pos = [0, 3.9, 2.4 + (1 - freeHeight) * 6];
      target = [CHAIRMAN_SPOT[0], 3.6, CHAIRMAN_SPOT[2]];
    } else if (phase === 'review') {
      const pan = calm ? 0 : Math.sin(t * 0.22) * 1.2;
      pos = [pan, 1.7, 10.2 * fit];
      target = [pan * 0.3, 2.0, -1];
    } else if (phase === 'opinions') {
      pos = [calm ? 0 : Math.sin(t * 0.15) * 0.5, 2.2, 10.4 * fit];
      target = [0, 2.0, -1];
    } else {
      const sway = calm ? 0 : Math.sin(t * 0.1) * 1.4;
      pos = [sway, 2.5 + (fit - 1) * 1.2, 10.6 * fit];
      target = [0, 2.1, -1.2];
    }

    // the fly-in is slower than everyday camera moves
    const smooth = t < 3.5 && intro ? 1.1 : 0.7;
    easing.damp3(camera.position, pos, smooth, dt);
    easing.damp3(look.current, target, smooth * 0.8, dt);
    camera.lookAt(look.current);
  });

  return null;
}

/**
 * The council chamber. A full-screen 3D stage behind the app.
 *
 * council: [{ model, state, text, cost, won }]
 * chairman: { model, state, text, cost } or null
 * phase: 'idle' | 'opinions' | 'review' | 'verdict' | 'done'
 */
export default function Chamber({
  council,
  chairman,
  phase,
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

  // How much further back the wide shots must be so the whole council is in
  // frame, given the space the chamber actually gets. The field of view is
  // vertical, so width and height are checked separately.
  const fit = useMemo(() => {
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const widest = Math.max(...seats.map(([x]) => Math.abs(x)), 0);
    // the mechs, plus room either side for speech bubbles
    const neededWidth = widest * 2 + (compact ? 2.6 : 4.4);
    // floor to the top of the chairman's head, plus his bubble
    const neededHeight = 5.6;
    const byWidth = neededWidth / (2 * tan * Math.max(freeAspect, 0.3));
    const byHeight = neededHeight / (2 * tan * freeHeight);
    return Math.max(1, byWidth / 10.6, byHeight / 10.6);
  }, [seats, compact, freeAspect, freeHeight]);
  const working = phase === 'opinions' || phase === 'review' || phase === 'verdict';

  // On narrow screens the judges stand too close for four bubbles, so the
  // words cut between whoever is speaking, one at a time
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (!compact || !working) return;
    const id = setInterval(() => setTurn((t) => t + 1), 2600);
    return () => clearInterval(id);
  }, [compact, working]);
  const speakers = council.map((j, i) => (j.state === 'speaking' ? i : -1)).filter((i) => i >= 0);
  const voice = speakers.length ? speakers[turn % speakers.length] : -1;

  const chairColor = chairman ? colorFor(chairman.model) : '#8fa7ff';

  return (
    <Canvas
      className="chamber-canvas"
      dpr={lite ? [1, 1.5] : [1, 2]}
      camera={{ fov: FOV, near: 0.1, far: 120, position: [0, 2.3, 10.5] }}
      gl={{ antialias: !lite, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        onReady?.();
      }}
      onPointerMissed={() => onFocus?.(null)}
    >
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', 10.6 * fit + 3, 10.6 * fit + 19]} />

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
      />

      {/* soft studio light for the glossy toy-like paint, with no downloads */}
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 8, 6]} intensity={1.2} />
      <spotLight
        position={[0, 9, 2]}
        angle={0.55}
        penumbra={1}
        intensity={working ? 40 : 26}
        color="#dfe8ff"
      />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 5, 4]} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} color="#9db4ff" />
        <Lightformer form="rect" intensity={1.5} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} color="#ffb59d" />
      </Environment>

      <Suspense fallback={null}>
        {/* the council */}
        {council.map((judge, i) => (
          <Mech3D
            key={judge.model + i}
            model={judge.model}
            color={colorFor(judge.model)}
            vendor={vendorOf(judge.model)}
            label={shortName(judge.model)}
            state={judge.state}
            text={judge.text}
            cost={judge.cost}
            won={judge.won}
            variant={i}
            position={seats[i]}
            // during the blind review they turn towards each other; in the
            // tight formation only partly, so you don't end up seeing backs
            lookAt={
              phase === 'review'
                ? compact
                  ? [0, 4]
                  : [0, -0.5]
                : [seats[i][0] * 0.4, 12]
            }
            phaseOffset={i * 1.3}
            onSelect={onFocus}
            showLabels={!lite || phase !== 'idle'}
            showWords={!compact || i === voice}
          />
        ))}

        {/* the chairman, raised up at the back */}
        {chairman && (
          <>
            <mesh position={[CHAIRMAN_SPOT[0], CHAIRMAN_SPOT[1] / 2, CHAIRMAN_SPOT[2]]}>
              <cylinderGeometry args={[1.05, 1.2, CHAIRMAN_SPOT[1], 48]} />
              <meshStandardMaterial color="#0d0f15" roughness={0.35} metalness={0.7} />
            </mesh>
            <Mech3D
              model={chairman.model}
              color={chairColor}
              vendor={vendorOf(chairman.model)}
              label={`Chairman · ${shortName(chairman.model)}`}
              state={chairman.state}
              text={chairman.text}
              cost={chairman.cost}
              variant={1}
              position={CHAIRMAN_SPOT}
              lookAt={[0, 12]}
              scale={1.28}
              phaseOffset={0.7}
              onSelect={onFocus}
            />
          </>
        )}

        <Halo color={chairColor} active={phase === 'verdict' || phase === 'done'} />
        <Sparkles count={lite ? 30 : 70} scale={[16, 8, 10]} position={[0, 3, -2]} size={1.6} speed={0.25} opacity={0.5} color="#c9d6ff" />
        {!calm && <Streaks active={working} count={lite ? 24 : 46} />}

        {/* a dark glossy floor that reflects the glowing heads */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[60, 60]} />
          <MeshReflectorMaterial
            blur={[300, 80]}
            resolution={lite ? 256 : 768}
            mixBlur={1}
            mixStrength={lite ? 18 : 32}
            roughness={0.9}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#07080c"
            metalness={0.6}
            mirror={0.55}
          />
        </mesh>
      </Suspense>

      <EffectComposer multisampling={lite ? 0 : 4} disableNormalPass>
        <Bloom
          mipmapBlur
          luminanceThreshold={0.85}
          luminanceSmoothing={0.2}
          intensity={lite ? 0.8 : 1.15}
        />
        <Vignette eskil={false} offset={0.18} darkness={0.75} />
        {!lite && <Noise opacity={0.035} />}
      </EffectComposer>
    </Canvas>
  );
}
