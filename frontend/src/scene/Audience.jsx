import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

/**
 * The public gallery: rows of robot spectators on the pews behind the rail,
 * facing the bench. Mostly ordinary, with a couple of quiet oddballs. They
 * react to the room: a chuckle, a lean back at a big moment, a murmur, and
 * applause at the end.
 */

const SUITS = ['#3a3f4a', '#4a4036', '#2f3b4f', '#4d4a45', '#3d3348', '#2f4540', '#5a4a3a'];
const HEADS = ['#c9c2b6', '#a9b4c2', '#d6c3a5', '#b7b0c9', '#c4cfc6', '#d2b8a8'];

function seeded(n) {
  const x = Math.sin(n * 91.7) * 10000;
  return x - Math.floor(x);
}

/** How a spectator moves, t seconds into a moment in the room. */
function reaction(type, t) {
  if (t < 0 || t > 2.4) return { y: 0, lean: 0, sway: 0, turn: 0 };
  const fade = Math.max(0, 1 - t / 2.4);
  switch (type) {
    case 'laugh':
      return { y: Math.abs(Math.sin(t * 13)) * 0.035 * fade, lean: -0.12 * fade, sway: Math.sin(t * 15) * 0.04 * fade, turn: 0 };
    case 'ooh':
      return { y: 0, lean: -0.18 * Math.min(1, t * 4) * fade, sway: 0, turn: 0.25 * fade };
    case 'gasp':
      return { y: Math.min(1, t * 6) * 0.05 * fade, lean: -0.22 * fade, sway: 0, turn: 0 };
    case 'applause':
      return { y: Math.abs(Math.sin(t * 20)) * 0.025 * fade, lean: 0, sway: Math.sin(t * 24) * 0.02 * fade, turn: 0 };
    default:
      return { y: 0, lean: 0, sway: 0, turn: 0 };
  }
}

function Spectator({ position, seed, suit, headColor, extra, crowdRef, m }) {
  const root = useRef();
  const head = useRef();
  const mats = useMemo(
    () => ({
      suit: new THREE.MeshStandardMaterial({ color: suit, roughness: 0.8 }),
      head: new THREE.MeshPhysicalMaterial({ color: headColor, roughness: 0.4, clearcoat: 0.5 }),
    }),
    [suit, headColor]
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime + seed * 20;
    const crowd = crowdRef.current;
    // everyone reacts a beat apart, like a real room
    const since = crowd ? (performance.now() - crowd.at) / 1000 - seed * 0.3 : -1;
    const r = reaction(crowd?.type, since);
    if (root.current) {
      root.current.position.y = position[1] + Math.sin(t * 0.9) * 0.006 + r.y;
      root.current.rotation.x = r.lean;
      root.current.rotation.z = r.sway;
    }
    if (head.current) {
      // the odd glance at a neighbour, more of it when something happens
      const idle = Math.sin(t * 0.37) * Math.sin(t * 0.13) * 0.35;
      head.current.rotation.y = idle + (seed > 0.5 ? r.turn : -r.turn);
    }
  });

  return (
    <group ref={root} position={position} rotation={[0, Math.PI, 0]}>
      <RoundedBox args={[0.5, 0.55, 0.34]} radius={0.1} position={[0, 0.28, 0]} material={mats.suit} castShadow />
      <group ref={head} position={[0, 0.78, 0]}>
        <mesh material={mats.head} castShadow>
          <sphereGeometry args={[0.2, 20, 20]} />
        </mesh>
        <mesh position={[0.07, 0.03, 0.18]} material={m.eye}>
          <sphereGeometry args={[0.028, 10, 10]} />
        </mesh>
        <mesh position={[-0.07, 0.03, 0.18]} material={m.eye}>
          <sphereGeometry args={[0.028, 10, 10]} />
        </mesh>
        {extra === 'hat' && (
          <>
            <mesh position={[0, 0.18, 0]} material={m.dark}>
              <cylinderGeometry args={[0.22, 0.22, 0.02, 20]} />
            </mesh>
            <mesh position={[0, 0.3, 0]} material={m.dark}>
              <cylinderGeometry args={[0.13, 0.13, 0.24, 20]} />
            </mesh>
          </>
        )}
        {extra === 'bow' && (
          <mesh position={[0.12, 0.17, 0]} rotation={[0, 0, 0.5]} material={m.bow}>
            <torusGeometry args={[0.06, 0.025, 8, 16]} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function Audience({ crowd, lite }) {
  // read every frame, without re-rendering everyone
  const crowdRef = useRef(crowd);
  crowdRef.current = crowd;

  const m = useMemo(
    () => ({
      eye: new THREE.MeshBasicMaterial({ color: '#9ff0ff', toneMapped: false }),
      dark: new THREE.MeshStandardMaterial({ color: '#141418', roughness: 0.6 }),
      bow: new THREE.MeshStandardMaterial({ color: '#c94a6a', roughness: 0.5 }),
    }),
    []
  );

  const people = useMemo(() => {
    const rows = lite ? [4.7, 6.1] : [4.7, 6.1, 7.5];
    const perSide = lite ? 3 : 4;
    const list = [];
    rows.forEach((z, r) => {
      [-1, 1].forEach((side) => {
        for (let i = 0; i < perSide; i++) {
          const n = list.length;
          // not everyone sits in a neat grid; skip a few seats
          if (seeded(n + 5) < 0.18) continue;
          const x = side * (2.0 + i * 1.55 + (seeded(n + 7) - 0.5) * 0.35);
          list.push({
            n,
            position: [x, 0.52, z],
            seed: seeded(n + 29),
            suit: SUITS[Math.floor(seeded(n + 11) * SUITS.length)],
            headColor: HEADS[Math.floor(seeded(n + 17) * HEADS.length)],
            extra: n === 3 ? 'hat' : n === 9 ? 'bow' : null,
          });
        }
      });
    });
    return list;
  }, [lite]);

  return (
    <group>
      {people.map((p) => (
        <Spectator key={p.n} {...p} crowdRef={crowdRef} m={m} />
      ))}
    </group>
  );
}

export default memo(Audience);
