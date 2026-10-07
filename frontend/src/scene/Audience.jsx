import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { mouthTexture } from './textures';

/**
 * The studio audience: a gallery of odd little robots who react to the show.
 * A toaster that pops its bread when it laughs, a robo-vac in a top hat, a
 * TV-head whose screen pulls faces, a desk lamp that flickers, a drone, a mug.
 *
 * They laugh, gasp, "ooh" and applaud on the same cues as the sound, so the
 * room feels alive whether or not the sound is on.
 */

const PASTELS = ['#ff8fab', '#9bf6ff', '#fdffb6', '#caffbf', '#bdb2ff', '#ffc6a5', '#a0c4ff'];
const KINDS = ['bubble', 'toaster', 'vac', 'tv', 'lamp', 'drone', 'mug'];

// a fixed shuffle, so the crowd is the same every visit
function seeded(n) {
  let x = Math.sin(n * 91.7) * 10000;
  return x - Math.floor(x);
}

/** How a spectator reacts, t seconds into a crowd moment. */
function reaction(type, t) {
  if (t < 0 || t > 2.2) return { y: 0, lean: 0, sway: 0, spin: 1 };
  const fade = Math.max(0, 1 - t / 2.2);
  switch (type) {
    case 'laugh':
      return { y: Math.abs(Math.sin(t * 16)) * 0.09 * fade, lean: -0.15 * fade, sway: Math.sin(t * 20) * 0.08 * fade, spin: 2 };
    case 'ooh':
      return { y: 0.02 * fade, lean: -0.3 * Math.min(1, t * 4) * fade, sway: 0, spin: 1.5 };
    case 'gasp':
      return { y: t < 0.25 ? t * 0.6 : 0.15 * fade, lean: -0.35 * fade, sway: 0, spin: 3 };
    case 'applause':
      return { y: Math.abs(Math.sin(t * 24)) * 0.05 * fade, lean: 0, sway: Math.sin(t * 30) * 0.03 * fade, spin: 4 };
    default:
      return { y: 0, lean: 0, sway: 0, spin: 1 };
  }
}

function Spectator({ kind, color, position, yaw, seed, crowdRef, m }) {
  const root = useRef();
  const extra = useRef();
  const screen = useRef();
  const shownFace = useRef('neutral');

  const paint = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.3 }),
    [color]
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime + seed * 10;
    const crowd = crowdRef.current;
    // everyone reacts a beat apart, like a real room
    const since = crowd ? (performance.now() - crowd.at) / 1000 - seed * 0.25 : -1;
    const r = reaction(crowd?.type, since);

    if (root.current) {
      root.current.position.y = position[1] + Math.sin(t * 1.3) * 0.012 + r.y;
      root.current.rotation.x = r.lean;
      root.current.rotation.z = r.sway;
    }

    if (extra.current) {
      if (kind === 'toaster') {
        // the bread pops up when it laughs
        const pop = crowd?.type === 'laugh' && since > 0 && since < 1.6 ? Math.sin(Math.min(1, since * 3) * Math.PI / 2) : 0;
        extra.current.position.y = 0.42 + pop * 0.22;
      } else if (kind === 'drone') {
        extra.current.rotation.y += 0.4 * r.spin;
      } else if (kind === 'lamp') {
        const flicker = crowd?.type === 'laugh' && since > 0 && since < 1.6 ? (Math.sin(t * 40) > 0 ? 3 : 0.4) : 1.6;
        m.bulb.emissiveIntensity = flicker;
      }
    }

    // the TV-head's screen pulls a face to match the moment
    if (screen.current) {
      const face =
        since > 0 && since < 2
          ? { laugh: 'laughing', ooh: 'shocked', gasp: 'shocked', applause: 'happy' }[crowd.type] || 'neutral'
          : 'neutral';
      if (face !== shownFace.current) {
        shownFace.current = face;
        screen.current.material.map = mouthTexture(face);
        screen.current.material.needsUpdate = true;
      }
    }
  });

  return (
    <group ref={root} position={position} rotation={[0, yaw, 0]}>
      {kind === 'bubble' && (
        <>
          <mesh position={[0, 0.28, 0]} material={paint}>
            <sphereGeometry args={[0.28, 24, 24]} />
          </mesh>
          <mesh position={[0, 0.66, 0]} material={paint}>
            <sphereGeometry args={[0.2, 24, 24]} />
          </mesh>
          <mesh position={[0.07, 0.69, 0.17]} material={m.eye}>
            <sphereGeometry args={[0.035, 12, 12]} />
          </mesh>
          <mesh position={[-0.07, 0.69, 0.17]} material={m.eye}>
            <sphereGeometry args={[0.035, 12, 12]} />
          </mesh>
          <mesh position={[0, 0.95, 0]} material={m.dark}>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 6]} />
          </mesh>
        </>
      )}

      {kind === 'toaster' && (
        <>
          <RoundedBox args={[0.5, 0.42, 0.32]} radius={0.08} position={[0, 0.21, 0]} material={paint} />
          <mesh position={[-0.1, 0.43, 0]} material={m.dark}>
            <boxGeometry args={[0.08, 0.02, 0.22]} />
          </mesh>
          <mesh position={[0.1, 0.43, 0]} material={m.dark}>
            <boxGeometry args={[0.08, 0.02, 0.22]} />
          </mesh>
          <group ref={extra} position={[0, 0.42, 0]}>
            <RoundedBox args={[0.07, 0.18, 0.2]} radius={0.02} position={[-0.1, 0, 0]} material={m.bread} />
            <RoundedBox args={[0.07, 0.18, 0.2]} radius={0.02} position={[0.1, 0, 0]} material={m.bread} />
          </group>
          <mesh position={[0.1, 0.25, 0.165]} material={m.eye}>
            <sphereGeometry args={[0.03, 12, 12]} />
          </mesh>
          <mesh position={[-0.1, 0.25, 0.165]} material={m.eye}>
            <sphereGeometry args={[0.03, 12, 12]} />
          </mesh>
        </>
      )}

      {kind === 'vac' && (
        <>
          <mesh position={[0, 0.07, 0]} material={paint}>
            <cylinderGeometry args={[0.32, 0.34, 0.14, 32]} />
          </mesh>
          <mesh position={[0, 0.15, 0.2]} material={m.eye}>
            <boxGeometry args={[0.16, 0.025, 0.04]} />
          </mesh>
          {/* the top hat */}
          <mesh position={[0, 0.16, 0]} material={m.dark}>
            <cylinderGeometry args={[0.2, 0.2, 0.02, 24]} />
          </mesh>
          <mesh position={[0, 0.3, 0]} material={m.dark}>
            <cylinderGeometry args={[0.12, 0.12, 0.26, 24]} />
          </mesh>
        </>
      )}

      {kind === 'tv' && (
        <>
          <mesh position={[0, 0.25, 0]} material={paint}>
            <cylinderGeometry args={[0.13, 0.18, 0.5, 16]} />
          </mesh>
          <RoundedBox args={[0.5, 0.38, 0.3]} radius={0.05} position={[0, 0.7, 0]} material={m.dark} />
          <mesh ref={screen} position={[0, 0.7, 0.152]}>
            <planeGeometry args={[0.38, 0.12]} />
            <meshBasicMaterial map={mouthTexture('neutral')} color={color} transparent toneMapped={false} />
          </mesh>
          <mesh position={[0.12, 0.98, 0]} rotation={[0, 0, -0.5]} material={m.dark}>
            <cylinderGeometry args={[0.01, 0.01, 0.22, 6]} />
          </mesh>
          <mesh position={[-0.12, 0.98, 0]} rotation={[0, 0, 0.5]} material={m.dark}>
            <cylinderGeometry args={[0.01, 0.01, 0.22, 6]} />
          </mesh>
        </>
      )}

      {kind === 'lamp' && (
        <group ref={extra}>
          <mesh position={[0, 0.03, 0]} material={paint}>
            <cylinderGeometry args={[0.2, 0.22, 0.06, 24]} />
          </mesh>
          <mesh position={[0, 0.4, 0]} material={m.dark}>
            <cylinderGeometry args={[0.02, 0.02, 0.75, 8]} />
          </mesh>
          <mesh position={[0, 0.82, 0.04]} rotation={[0.5, 0, 0]} material={paint}>
            <coneGeometry args={[0.2, 0.26, 24, 1, true]} />
          </mesh>
          <mesh position={[0, 0.76, 0.08]} material={m.bulb}>
            <sphereGeometry args={[0.06, 12, 12]} />
          </mesh>
        </group>
      )}

      {kind === 'drone' && (
        <group position={[0, 0.7, 0]}>
          <RoundedBox args={[0.3, 0.12, 0.3]} radius={0.04} material={paint} />
          <mesh position={[0, -0.02, 0.16]} material={m.eye}>
            <sphereGeometry args={[0.04, 12, 12]} />
          </mesh>
          <group ref={extra}>
            {[0, 1, 2, 3].map((i) => {
              const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
              return (
                <mesh key={i} position={[Math.cos(a) * 0.24, 0.08, Math.sin(a) * 0.24]} material={m.dark}>
                  <boxGeometry args={[0.22, 0.01, 0.04]} />
                </mesh>
              );
            })}
          </group>
        </group>
      )}

      {kind === 'mug' && (
        <>
          <mesh position={[0, 0.24, 0]} material={paint}>
            <cylinderGeometry args={[0.2, 0.18, 0.48, 24]} />
          </mesh>
          <mesh position={[0.23, 0.26, 0]} rotation={[0, 0, Math.PI / 2]} material={paint}>
            <torusGeometry args={[0.1, 0.03, 8, 20]} />
          </mesh>
          <mesh position={[0, 0.48, 0]} material={m.coffee}>
            <cylinderGeometry args={[0.17, 0.17, 0.01, 24]} />
          </mesh>
          <mesh position={[0.07, 0.3, 0.19]} material={m.eye}>
            <sphereGeometry args={[0.03, 12, 12]} />
          </mesh>
          <mesh position={[-0.07, 0.3, 0.19]} material={m.eye}>
            <sphereGeometry args={[0.03, 12, 12]} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Audience({ crowd, lite }) {
  // the crowd moment is read every frame, without re-rendering everyone
  const crowdRef = useRef(crowd);
  crowdRef.current = crowd;

  const m = useMemo(
    () => ({
      eye: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      dark: new THREE.MeshStandardMaterial({ color: '#1c1d24', roughness: 0.5, metalness: 0.4 }),
      bread: new THREE.MeshStandardMaterial({ color: '#d9a35b', roughness: 0.9 }),
      coffee: new THREE.MeshStandardMaterial({ color: '#3b2314', roughness: 0.3 }),
      bulb: new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 1.6, toneMapped: false }),
      pew: new THREE.MeshPhysicalMaterial({ color: '#2a1912', roughness: 0.45, clearcoat: 0.6 }),
    }),
    []
  );

  // Two galleries angled in from the sides, two short rows each, plus a front
  // row seen from behind, like the heads in front of you at a TV taping
  const seats = useMemo(() => {
    const list = [];
    const perRow = lite ? 3 : 5;
    [-1, 1].forEach((side) => {
      for (let row = 0; row < (lite ? 1 : 2); row++) {
        for (let i = 0; i < perRow; i++) {
          const n = list.length;
          list.push({
            // sitting on the pew, turned in towards the bench
            position: [side * (6.3 + row * 1.1), 0.4 + row * 0.35, 0.6 + i * 1.05],
            yaw: side < 0 ? Math.PI / 2 + 0.35 : -Math.PI / 2 - 0.35,
            n,
          });
        }
      }
    });
    if (!lite) {
      [-3.4, -2.3, 2.3, 3.4].forEach((x) => {
        const n = list.length;
        list.push({ position: [x, 0, 6.4], yaw: Math.PI, n });
      });
    }
    return list.map((seat) => ({
      ...seat,
      kind: KINDS[Math.floor(seeded(seat.n + 3) * KINDS.length)],
      color: PASTELS[Math.floor(seeded(seat.n + 11) * PASTELS.length)],
      seed: seeded(seat.n + 29),
    }));
  }, [lite]);

  return (
    <group>
      {/* pews for the side galleries */}
      {[-1, 1].map((side) =>
        Array.from({ length: lite ? 1 : 2 }, (_, row) => (
          <mesh
            key={`${side}${row}`}
            position={[side * (6.3 + row * 1.1), 0.2 + row * 0.175, 2.7]}
            material={m.pew}
          >
            <boxGeometry args={[0.7, 0.4 + row * 0.35, (lite ? 3 : 5) * 1.05 + 0.4]} />
          </mesh>
        ))
      )}
      {seats.map((s) => (
        <Spectator key={s.n} {...s} crowdRef={crowdRef} m={m} />
      ))}
    </group>
  );
}

export default memo(Audience);
