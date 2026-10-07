import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Html } from '@react-three/drei';
import { easing } from 'maath';
import * as THREE from 'three';
import { markTexture } from './textures';
import { nameNames } from '../lib/text';

/**
 * A council member as a 3D mech, standing behind the bench. Built from simple
 * blocks, so there are no model files to download.
 *
 * Every movement is driven inside the render loop with damping, never by
 * React re-rendering, so it stays smooth while answers stream in.
 *
 * state: 'waiting' | 'thinking' | 'speaking' | 'done' | 'failed'
 */

// Gavel angles, tilting forward from the hand. It rests lying on the bench.
const REST = 1.3;
const RAISED = -0.55;
const STRIKE = 1.5;

const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeIn = (x) => x * x;

/**
 * Where the gavel is, a given number of seconds into a slam: a wind-up, a
 * fast strike, then a small damped bounce as it settles. null once it's over.
 */
function slamAngle(s) {
  if (s < 0) return null;
  if (s < 0.2) return REST + (RAISED - REST) * easeOut(s / 0.2);
  if (s < 0.29) return RAISED + (STRIKE - RAISED) * easeIn((s - 0.2) / 0.09);
  if (s < 0.75) {
    const u = (s - 0.29) / 0.46;
    return REST + (STRIKE - REST) * Math.cos(u * Math.PI * 2.5) * Math.pow(1 - u, 2.2);
  }
  return null;
}

/**
 * The last few words said, for the speech bubble. Stops before the ballot, and
 * swaps "Response A" for the judge it means, so the argument names names.
 */
function lastWords(text, labels, limit = 64) {
  if (!text) return '';
  const body = nameNames(text.split(/\bFINAL\b/)[0], labels);
  const clean = body.replace(/[#*`>_]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length <= limit ? clean : '...' + clean.slice(-limit);
}

function Crown() {
  const ref = useRef();
  const gold = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffcf3f',
        emissive: '#ffb000',
        emissiveIntensity: 1.5,
        metalness: 0.9,
        roughness: 0.25,
        toneMapped: false,
      }),
    []
  );
  const born = useRef(null);

  useFrame((state, dt) => {
    if (!ref.current) return;
    if (born.current === null) born.current = state.clock.elapsedTime;
    const age = state.clock.elapsedTime - born.current;
    // drops in from above with a small overshoot, then turns slowly
    const drop = age < 0.9 ? 1.4 * Math.pow(1 - easeOut(age / 0.9), 2) - 0.06 * Math.sin(age * 9) * (1 - age / 0.9) : 0;
    ref.current.position.y = 0.72 + drop;
    ref.current.rotation.y += dt * 0.9;
    const s = Math.min(1, age / 0.35);
    ref.current.scale.setScalar(s);
  });

  return (
    <group ref={ref} position={[0, 0.72, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={gold}>
        <torusGeometry args={[0.27, 0.045, 12, 40]} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.27, 0.13, Math.sin(a) * 0.27]} material={gold}>
            <coneGeometry args={[0.055, 0.22, 8]} />
          </mesh>
        );
      })}
      <pointLight color="#ffc53d" intensity={3} distance={2.6} position={[0, 0.3, 0]} />
    </group>
  );
}

function Mech3D({
  model,
  color,
  vendor,
  state = 'waiting',
  variant = 0,
  won = false,
  text,
  position,
  faceYaw = 0,
  turn = 0,
  scale = 1,
  phaseOffset = 0,
  onSelect,
  showWords = true,
  isVoice = false,
  slamAt = 0,
  burst = null,
  labels = null,
  showLabels = true,
}) {
  const body = useRef();
  const head = useRef();
  const core = useRef();
  const face = useRef();
  const gavel = useRef();
  const wave = useRef();

  const dead = state === 'failed';
  const texture = useMemo(() => markTexture(vendor), [vendor]);

  // One set of materials per mech, shared by all its parts
  const m = useMemo(() => {
    const paint = dead ? '#4d535c' : color;
    return {
      paint: new THREE.MeshPhysicalMaterial({ color: paint, roughness: 0.3, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.16 }),
      shade: new THREE.MeshPhysicalMaterial({
        color: dead ? '#353a41' : new THREE.Color(color).multiplyScalar(0.42),
        roughness: 0.45,
        metalness: 0.2,
        clearcoat: 0.5,
      }),
      metal: new THREE.MeshStandardMaterial({ color: '#1b1f26', roughness: 0.42, metalness: 0.75 }),
      core: new THREE.MeshStandardMaterial({ color: paint, emissive: dead ? '#000' : color, emissiveIntensity: 1.4, toneMapped: false }),
      face: new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: 1.5, transparent: true, toneMapped: false }),
      sensor: new THREE.MeshBasicMaterial({ color: dead ? '#444' : '#ffffff', toneMapped: false }),
      glow: new THREE.MeshBasicMaterial({ color: dead ? '#333' : color, toneMapped: false }),
      wave: new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
  }, [color, dead, texture]);

  useFrame((frame, dt) => {
    const t = frame.clock.elapsedTime + phaseOffset;
    const working = state === 'thinking' || state === 'speaking';

    if (body.current) {
      // breathe, bob faster while talking, slump if the model failed
      const bob = dead ? 0 : state === 'speaking' ? Math.sin(t * 6) * 0.025 : Math.sin(t * 1.4) * 0.012;
      body.current.position.y = bob;
      easing.damp(body.current.rotation, 'x', dead ? 0.24 : isVoice ? -0.07 : 0, 0.35, dt);
      // turn the upper body towards whoever they are arguing with
      easing.dampAngle(body.current.rotation, 'y', dead ? 0 : turn, 0.5, dt);
    }

    if (head.current) {
      const scan = state === 'thinking' ? Math.sin(t * 1.6) * 0.38 : turn * 0.6;
      const nod = state === 'speaking' ? Math.sin(t * 8.5) * 0.05 : 0;
      easing.dampAngle(head.current.rotation, 'y', scan, 0.3, dt);
      easing.damp(head.current.rotation, 'x', nod, 0.12, dt);
    }

    if (core.current) {
      const target = dead ? 0 : working ? 3 + Math.sin(t * 7) * 1.4 : 1.4;
      easing.damp(m.core, 'emissiveIntensity', target, 0.18, dt);
    }
    if (face.current) {
      const target = dead ? 0.1 : isVoice ? 2.8 + Math.sin(t * 13) * 0.35 : state === 'speaking' ? 2.2 : won ? 2.3 : 1.5;
      easing.damp(m.face, 'emissiveIntensity', target, 0.18, dt);
    }

    // the gavel: a slam if one is running, otherwise gesturing or at rest
    if (gavel.current) {
      const since = slamAt ? (performance.now() - slamAt) / 1000 : -1;
      const slam = slamAngle(since);
      if (slam !== null) {
        gavel.current.rotation.x = slam;
      } else {
        const target = dead ? REST : state === 'speaking' ? 0.75 + Math.sin(t * 3.4) * 0.35 : REST;
        easing.damp(gavel.current.rotation, 'x', target, 0.25, dt);
      }

      // a ring of light spreads across the bench where it lands
      if (wave.current) {
        const impact = since - 0.29;
        if (impact > 0 && impact < 0.55) {
          wave.current.visible = true;
          wave.current.scale.setScalar(1 + impact * 10);
          m.wave.opacity = Math.pow(1 - impact / 0.55, 1.5);
        } else {
          wave.current.visible = false;
        }
      }
    }
  });

  const words = state === 'speaking' && showWords ? lastWords(text, labels) : '';

  return (
    <group
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
      {/* coloured backlight gives each mech a rim of its own colour */}
      {!dead && <pointLight color={color} intensity={6} distance={3.4} position={[0, 2, -0.9]} />}

      {/* legs, behind the bench */}
      <mesh position={[-0.2, 0.4, 0]} material={m.metal}>
        <boxGeometry args={[0.26, 0.8, 0.3]} />
      </mesh>
      <mesh position={[0.2, 0.4, 0]} material={m.metal}>
        <boxGeometry args={[0.26, 0.8, 0.3]} />
      </mesh>

      <group ref={body}>
        {/* torso */}
        <RoundedBox args={[0.72, 0.2, 0.42]} radius={0.06} position={[0, 0.82, 0]} material={m.metal} />
        <RoundedBox args={[0.96, 0.82, 0.56]} radius={0.1} position={[0, 1.3, 0]} material={m.paint} />
        <RoundedBox args={[0.6, 0.46, 0.1]} radius={0.04} position={[0, 1.36, 0.27]} material={m.shade} />
        <mesh ref={core} position={[0, 1.36, 0.33]} material={m.core}>
          <sphereGeometry args={[0.085, 24, 24]} />
        </mesh>

        {/* shoulders */}
        <RoundedBox args={[0.42, 0.34, 0.52]} radius={0.12} position={[-0.66, 1.6, 0]} material={m.paint} />
        <RoundedBox args={[0.42, 0.34, 0.52]} radius={0.12} position={[0.66, 1.6, 0]} material={m.paint} />

        {/* arms: upper arms hang, forearms rest forward on the bench */}
        <mesh position={[-0.7, 1.37, 0]} material={m.metal}>
          <boxGeometry args={[0.2, 0.46, 0.22]} />
        </mesh>
        <mesh position={[0.7, 1.37, 0]} material={m.metal}>
          <boxGeometry args={[0.2, 0.46, 0.22]} />
        </mesh>
        <RoundedBox args={[0.24, 0.2, 0.5]} radius={0.06} position={[-0.66, 1.12, 0.18]} material={m.paint} />
        <RoundedBox args={[0.24, 0.2, 0.5]} radius={0.06} position={[0.64, 1.12, 0.18]} material={m.paint} />
        <RoundedBox args={[0.26, 0.14, 0.24]} radius={0.05} position={[-0.6, 1.12, 0.46]} material={m.shade} />

        {/* the gavel, pivoting at the right hand */}
        <group position={[0.6, 1.12, 0.42]}>
          <group ref={gavel} rotation={[REST, 0, 0]}>
            <mesh position={[0, 0.26, 0]} material={m.metal}>
              <cylinderGeometry args={[0.03, 0.03, 0.52, 12]} />
            </mesh>
            <RoundedBox args={[0.34, 0.15, 0.15]} radius={0.04} position={[0, 0.52, 0]} rotation={[0, 0, Math.PI / 2]} material={m.paint} />
            <mesh position={[0.18, 0.52, 0]} rotation={[0, 0, Math.PI / 2]} material={m.glow}>
              <cylinderGeometry args={[0.06, 0.06, 0.02, 16]} />
            </mesh>
          </group>
          <RoundedBox args={[0.26, 0.18, 0.24]} radius={0.06} material={m.paint} />
        </group>
        <mesh ref={wave} position={[0.6, 1.13, 0.9]} rotation={[-Math.PI / 2, 0, 0]} material={m.wave} visible={false}>
          <ringGeometry args={[0.06, 0.1, 40]} />
        </mesh>

        {/* neck */}
        <mesh position={[0, 1.8, 0]} material={m.metal}>
          <cylinderGeometry args={[0.12, 0.14, 0.16, 16]} />
        </mesh>

        {/* head: a cube with the maker's mark as its face */}
        <group ref={head} position={[0, 2.2, 0]}>
          <RoundedBox args={[0.72, 0.68, 0.68]} radius={0.07} material={m.paint} />
          <mesh ref={face} position={[0, 0.03, 0.342]} material={m.face}>
            <planeGeometry args={[0.46, 0.46]} />
          </mesh>
          <mesh position={[0, -0.24, 0.343]} material={m.sensor}>
            <planeGeometry args={[0.4, 0.035]} />
          </mesh>
          {variant % 2 === 0 && (
            <group position={[0.22, 0.34, 0]}>
              <mesh position={[0, 0.14, 0]} material={m.metal}>
                <cylinderGeometry args={[0.015, 0.015, 0.28, 8]} />
              </mesh>
              <mesh position={[0, 0.3, 0]} material={m.glow}>
                <sphereGeometry args={[0.04, 12, 12]} />
              </mesh>
            </group>
          )}
          {won && <Crown />}
        </group>
      </group>

      {/* speech bubble and outbursts, as HTML floating in the scene */}
      {showLabels && (
        <Html position={[0, 3.1, 0]} center distanceFactor={9} zIndexRange={[20, 0]}>
          <div className="bubble-slot3d">
            {burst && (
              <div key={burst.at} className="burst3d" style={{ '--c': color }}>
                {burst.word}
              </div>
            )}
            {(state === 'thinking' || (state === 'speaking' && !words && showWords)) && (
              <div className="bubble3d" style={{ '--c': color }}>
                <span className="dots"><i /><i /><i /></span>
              </div>
            )}
            {words && (
              <div className={`bubble3d ${isVoice ? 'bubble3d-voice' : ''}`} style={{ '--c': color }}>
                {words}
              </div>
            )}
            {dead && <div className="bubble3d bubble3d-off">offline</div>}
          </div>
        </Html>
      )}
    </group>
  );
}

export default memo(Mech3D);
