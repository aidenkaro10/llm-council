import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { easing } from 'maath';
import * as THREE from 'three';
import { markTexture, mouthTexture } from './textures';

/**
 * A council member in the courtroom.
 *
 * Counsel wear a suit with a tie in their maker's colour, sit at their table,
 * and stand when it's their turn to speak. The judge wears a black robe, sits
 * at the high bench, and holds the only gavel.
 *
 * Their face is their maker's mark, with LED eyebrows and a mouth that moves
 * while they talk and shows how they feel. Every movement runs in the render
 * loop with damping, never through React re-rendering, so it stays smooth.
 */

const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeIn = (x) => x * x;
const smooth = (x) => x * x * (3 - 2 * x);

// The judge's gavel rests flat on the bench, rises, strikes, settles
const REST = 1.3;
const RAISED = -0.55;
const STRIKE = 1.5;

function gavelAngle(s) {
  if (s < 0) return null;
  if (s < 0.2) return REST + (RAISED - REST) * easeOut(s / 0.2);
  if (s < 0.29) return RAISED + (STRIKE - RAISED) * easeIn((s - 0.2) / 0.09);
  if (s < 0.75) {
    const u = (s - 0.29) / 0.46;
    return REST + (STRIKE - REST) * Math.cos(u * Math.PI * 2.5) * Math.pow(1 - u, 2.2);
  }
  return null;
}

/** A lawyer bringing a fist down on the table: arm angle, or null when done. */
function fistAngle(s) {
  if (s < 0) return null;
  if (s < 0.22) return -1.1 * easeOut(s / 0.22);
  if (s < 0.31) return -1.1 + 1.25 * easeIn((s - 0.22) / 0.09);
  if (s < 0.8) return 0.15 * (1 - smooth((s - 0.31) / 0.49));
  return null;
}

// Eyebrows per mood: [tilt (inner ends down is angry), raise, left brow extra raise]
const BROWS = {
  neutral: [0, 0, 0],
  happy: [-0.12, 0.025, 0],
  smug: [0.05, 0, 0.05],
  annoyed: [0.22, -0.01, 0],
  angry: [0.45, -0.025, 0],
  shocked: [-0.18, 0.06, 0],
  sad: [-0.4, 0.01, 0],
  laughing: [-0.1, 0.035, 0],
};

const GESTURE_LENGTH = { point: 1.8, facepalm: 2.1, shrug: 1.5, laugh: 2.0 };
const MOOD_HOLD = 5;
// how far a lawyer sinks when sitting down
const SEATED = -0.26;

function Mech3D({
  model,
  color,
  vendor,
  role = 'counsel',
  state = 'waiting',
  won = false,
  position,
  faceYaw = 0,
  turn = 0,
  aimYaw = 0,
  scale = 1,
  phaseOffset = 0,
  onSelect,
  standing = false,
  talking = false,
  slamAt = 0,
  emotion = null,
  gesture = null,
  shadows = true,
}) {
  const root = useRef();
  const body = useRef();
  const head = useRef();
  const armL = useRef();
  const armR = useRef();
  const gavel = useRef();
  const browL = useRef();
  const browR = useRef();
  const mouth = useRef('neutral');
  const flap = useRef(0);

  const judge = role === 'judge';
  const dead = state === 'failed';
  const texture = useMemo(() => markTexture(vendor), [vendor]);

  const m = useMemo(() => {
    const brand = dead ? '#5a6068' : color;
    return {
      head: new THREE.MeshPhysicalMaterial({ color: brand, roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.18 }),
      // a charcoal suit for counsel, a black robe for the judge
      cloth: new THREE.MeshStandardMaterial({ color: judge ? '#111114' : '#2a2d35', roughness: 0.78 }),
      lapel: new THREE.MeshStandardMaterial({ color: judge ? '#1b1b20' : '#1d2026', roughness: 0.7 }),
      shirt: new THREE.MeshStandardMaterial({ color: '#eceae4', roughness: 0.6 }),
      tie: new THREE.MeshStandardMaterial({ color: brand, roughness: 0.45 }),
      metal: new THREE.MeshStandardMaterial({ color: '#30343c', roughness: 0.4, metalness: 0.75 }),
      face: new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: dead ? 0.1 : 1.3, transparent: true, toneMapped: false }),
      led: new THREE.MeshBasicMaterial({ color: dead ? '#555' : '#ffffff', toneMapped: false }),
      mouth: new THREE.MeshBasicMaterial({ map: mouthTexture('neutral'), color: dead ? '#666' : '#ffffff', transparent: true, toneMapped: false }),
      wood: new THREE.MeshStandardMaterial({ color: '#3a2214', roughness: 0.5 }),
    };
  }, [color, dead, texture, judge]);

  useEffect(() => () => Object.values(m).forEach((mat) => mat.dispose?.()), [m]);

  // every part casts a shadow in the window light
  useEffect(() => {
    root.current?.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = shadows;
        o.receiveShadow = shadows;
      }
    });
  }, [shadows, m]);

  useFrame((frame, dt) => {
    const t = frame.clock.elapsedTime + phaseOffset;
    const now = performance.now();

    // --- mood, and the mouth moving while they talk ---
    const moodAge = emotion ? (now - emotion.at) / 1000 : Infinity;
    const mood = dead ? 'sad' : moodAge < MOOD_HOLD ? emotion.e : won ? 'happy' : 'neutral';
    let shape = mood;
    if (talking) {
      flap.current -= dt;
      if (flap.current <= 0) {
        // a new mouth shape every tenth of a second or so, like real speech
        flap.current = 0.07 + Math.random() * 0.09;
        mouth.current = Math.random() < 0.2 ? mood : Math.random() < 0.5 ? 'talk' : 'talkWide';
      }
      shape = mouth.current;
    }
    if (m.mouth.map !== mouthTexture(shape)) {
      m.mouth.map = mouthTexture(shape);
      m.mouth.needsUpdate = true;
    }

    const [tilt, raise, lift] = BROWS[mood] || BROWS.neutral;
    if (browL.current && browR.current) {
      easing.damp(browL.current.rotation, 'z', -tilt, 0.12, dt);
      easing.damp(browR.current.rotation, 'z', tilt, 0.12, dt);
      easing.damp(browL.current.position, 'y', 0.29 + raise + lift, 0.12, dt);
      easing.damp(browR.current.position, 'y', 0.29 + raise, 0.12, dt);
    }

    // --- gestures ---
    const gAge = gesture ? (now - gesture.at) / 1000 : Infinity;
    const u = gAge / (gesture ? GESTURE_LENGTH[gesture.type] || 1.6 : 1);
    const env = u < 0 || u > 1 ? 0 : u < 0.22 ? smooth(u / 0.22) : u > 0.72 ? smooth((1 - u) / 0.28) : 1;
    const type = env > 0 ? gesture.type : null;

    const pose = { lx: 0, lz: 0, rx: 0, ry: 0, rz: 0, bodyZ: 0, headX: 0, headZ: 0 };
    if (type === 'point') {
      pose.rx = -1.35;
      pose.ry = THREE.MathUtils.clamp(aimYaw, -1, 1) * 0.9;
    } else if (type === 'facepalm') {
      pose.lx = -2.15;
      pose.lz = -0.6;
      pose.headX = 0.28;
    } else if (type === 'shrug') {
      pose.lx = -0.45;
      pose.rx = -0.45;
      pose.lz = 0.5;
      pose.rz = -0.5;
      pose.headZ = 0.14;
    } else if (type === 'laugh') {
      pose.lx = -0.4;
      pose.rx = -0.4;
      pose.bodyZ = Math.sin(t * 20) * 0.04;
      pose.headX = -0.28;
    } else if (talking && !judge) {
      // talking with their hands, a little
      pose.rx = -0.35 + Math.sin(t * 2.6) * 0.18;
      pose.lx = -0.2 + Math.sin(t * 2.1 + 1) * 0.12;
    }

    // a lawyer's fist coming down on the table
    if (!judge) {
      const fist = fistAngle(slamAt ? (now - slamAt) / 1000 : -1);
      if (fist !== null) pose.rx = fist;
    }

    const k = 10;
    if (armL.current) {
      armL.current.rotation.x = THREE.MathUtils.damp(armL.current.rotation.x, pose.lx * (type ? env : 1), k, dt);
      armL.current.rotation.z = THREE.MathUtils.damp(armL.current.rotation.z, pose.lz * env, k, dt);
    }
    if (armR.current) {
      const rx = pose.rx * (type ? env : 1);
      armR.current.rotation.x = THREE.MathUtils.damp(armR.current.rotation.x, rx, slamAt && now - slamAt < 800 ? 40 : k, dt);
      armR.current.rotation.y = THREE.MathUtils.damp(armR.current.rotation.y, pose.ry * env, k, dt);
      armR.current.rotation.z = THREE.MathUtils.damp(armR.current.rotation.z, pose.rz * env, k, dt);
    }

    if (body.current) {
      // sit, or rise to speak; breathe; slump if the model failed
      const height = judge ? 0 : standing ? 0 : SEATED;
      easing.damp(body.current.position, 'y', height + Math.sin(t * 1.3) * 0.01, 0.28, dt);
      body.current.rotation.z = pose.bodyZ * env;
      easing.damp(body.current.rotation, 'x', dead ? 0.24 : standing ? -0.04 : 0.06, 0.35, dt);
      easing.dampAngle(body.current.rotation, 'y', dead ? 0 : turn, 0.45, dt);
    }

    if (head.current) {
      const glance = state === 'thinking' && !talking ? Math.sin(t * 0.9) * 0.18 : turn * 0.5;
      const nod = talking ? Math.sin(t * 7.5) * 0.035 : 0;
      easing.dampAngle(head.current.rotation, 'y', glance, 0.35, dt);
      easing.damp(head.current.rotation, 'x', nod + pose.headX * env, 0.14, dt);
      easing.damp(head.current.rotation, 'z', pose.headZ * env, 0.16, dt);
    }

    if (gavel.current) {
      const g = gavelAngle(slamAt ? (now - slamAt) / 1000 : -1);
      if (g !== null) gavel.current.rotation.x = g;
      else easing.damp(gavel.current.rotation, 'x', REST, 0.25, dt);
    }
  });

  return (
    <group
      ref={root}
      position={position}
      rotation={[0, faceYaw, 0]}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(model);
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <group ref={body}>
        {/* legs, mostly hidden by furniture */}
        <mesh position={[-0.2, 0.4, 0]} material={m.cloth}>
          <boxGeometry args={[0.26, 0.8, 0.3]} />
        </mesh>
        <mesh position={[0.2, 0.4, 0]} material={m.cloth}>
          <boxGeometry args={[0.26, 0.8, 0.3]} />
        </mesh>

        {/* the jacket (or robe), with shirt, lapels and tie */}
        <RoundedBox args={[0.98, 0.95, 0.58]} radius={0.12} position={[0, 1.27, 0]} material={m.cloth} />
        <mesh position={[0, 1.46, 0.292]} material={judge ? m.shirt : m.shirt}>
          <planeGeometry args={[0.26, 0.42]} />
        </mesh>
        {!judge && (
          <>
            <mesh position={[0, 1.43, 0.296]} material={m.tie}>
              <planeGeometry args={[0.09, 0.4]} />
            </mesh>
            <mesh position={[-0.13, 1.47, 0.298]} rotation={[0, 0, -0.32]} material={m.lapel}>
              <planeGeometry args={[0.12, 0.42]} />
            </mesh>
            <mesh position={[0.13, 1.47, 0.298]} rotation={[0, 0, 0.32]} material={m.lapel}>
              <planeGeometry args={[0.12, 0.42]} />
            </mesh>
          </>
        )}

        {/* shoulders */}
        <RoundedBox args={[0.4, 0.3, 0.54]} radius={0.12} position={[-0.64, 1.62, 0]} material={m.cloth} />
        <RoundedBox args={[0.4, 0.3, 0.54]} radius={0.12} position={[0.64, 1.62, 0]} material={m.cloth} />

        {/* left arm */}
        <group ref={armL} position={[-0.68, 1.6, 0]}>
          <mesh position={[0, -0.24, 0]} material={m.cloth}>
            <boxGeometry args={[0.22, 0.48, 0.24]} />
          </mesh>
          <RoundedBox args={[0.22, 0.2, 0.5]} radius={0.06} position={[0.04, -0.5, 0.18]} material={m.cloth} />
          <RoundedBox args={[0.2, 0.14, 0.2]} radius={0.05} position={[0.08, -0.5, 0.46]} material={m.metal} />
        </group>

        {/* right arm; the judge's holds the gavel */}
        <group ref={armR} position={[0.68, 1.6, 0]}>
          <mesh position={[0, -0.24, 0]} material={m.cloth}>
            <boxGeometry args={[0.22, 0.48, 0.24]} />
          </mesh>
          <RoundedBox args={[0.22, 0.2, 0.5]} radius={0.06} position={[-0.04, -0.5, 0.18]} material={m.cloth} />
          <group position={[-0.08, -0.5, 0.44]}>
            <RoundedBox args={[0.2, 0.16, 0.2]} radius={0.05} material={m.metal} />
            {judge && (
              <group ref={gavel} rotation={[REST, 0, 0]}>
                <mesh position={[0, 0.26, 0]} material={m.wood}>
                  <cylinderGeometry args={[0.03, 0.03, 0.52, 12]} />
                </mesh>
                <mesh position={[0, 0.52, 0]} rotation={[0, 0, Math.PI / 2]} material={m.wood}>
                  <cylinderGeometry args={[0.075, 0.075, 0.3, 16]} />
                </mesh>
              </group>
            )}
          </group>
        </group>

        {/* neck */}
        <mesh position={[0, 1.82, 0]} material={m.metal}>
          <cylinderGeometry args={[0.12, 0.14, 0.16, 16]} />
        </mesh>

        {/* head: the maker's mark is the face, with LED brows and a mouth */}
        <group ref={head} position={[0, 2.22, 0]}>
          <RoundedBox args={[0.72, 0.68, 0.68]} radius={0.08} material={m.head} />
          <mesh position={[0, 0.03, 0.342]} material={m.face}>
            <planeGeometry args={[0.4, 0.4]} />
          </mesh>
          <mesh ref={browL} position={[-0.15, 0.29, 0.344]} material={m.led}>
            <boxGeometry args={[0.17, 0.035, 0.01]} />
          </mesh>
          <mesh ref={browR} position={[0.15, 0.29, 0.344]} material={m.led}>
            <boxGeometry args={[0.17, 0.035, 0.01]} />
          </mesh>
          <mesh position={[0, -0.235, 0.344]} material={m.mouth}>
            <planeGeometry args={[0.36, 0.09]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export default memo(Mech3D);
