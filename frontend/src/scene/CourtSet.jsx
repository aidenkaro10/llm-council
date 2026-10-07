import { memo, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { sealTexture } from './textures';

/**
 * The courtroom around the council: judges' bench, the chairman's high bench,
 * columns and the seal on the back wall, the bar, the aisle and the lectern.
 * Everything is simple shapes, so there is nothing to download.
 */

const WOOD = '#2a1912';
const WOOD_DARK = '#1a0f0a';
const BRASS = '#c9a24a';
const MARBLE = '#16181e';

// Bench sizes in a mech's own units, scaled up for the chairman
export const BENCH = { height: 1.06, depth: 0.55, offset: 0.68, width: 1.75 };

function useMaterials() {
  return useMemo(
    () => ({
      wood: new THREE.MeshPhysicalMaterial({ color: WOOD, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.25 }),
      woodDark: new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.6 }),
      brass: new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.9, roughness: 0.28 }),
      marble: new THREE.MeshStandardMaterial({ color: MARBLE, roughness: 0.32, metalness: 0.25 }),
      carpet: new THREE.MeshStandardMaterial({ color: '#4a0b11', roughness: 0.95 }),
      wall: new THREE.MeshStandardMaterial({ color: '#0a0b10', roughness: 0.85 }),
      slat: new THREE.MeshStandardMaterial({ color: '#140d09', roughness: 0.55, metalness: 0.1 }),
      glowWarm: new THREE.MeshBasicMaterial({ color: '#ffb35c', toneMapped: false }),
      goldLine: new THREE.MeshBasicMaterial({ color: '#c9a24a', toneMapped: false, transparent: true, opacity: 0.7 }),
    }),
    []
  );
}

/** One section of the judges' bench, with a coloured strip and a nameplate. */
function BenchSection({ position, yaw, width, color, label, cost, m }) {
  const { height, depth } = BENCH;
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, height / 2, 0]} material={m.wood}>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      {/* recessed front panel */}
      <mesh position={[0, height * 0.48, depth / 2 + 0.005]} material={m.woodDark}>
        <boxGeometry args={[width * 0.86, height * 0.62, 0.02]} />
      </mesh>
      {/* brass top edge */}
      <mesh position={[0, height + 0.025, 0.02]} material={m.brass}>
        <boxGeometry args={[width + 0.08, 0.05, depth + 0.1]} />
      </mesh>
      {/* the judge's colour, glowing along the front */}
      {color && (
        <mesh position={[0, height * 0.86, depth / 2 + 0.02]}>
          <boxGeometry args={[width * 0.8, 0.03, 0.01]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
      {label && (
        <Html position={[0, height * 0.42, depth / 2 + 0.03]} center distanceFactor={9} zIndexRange={[10, 0]}>
          <div className="plate3d" style={{ '--c': color }}>
            <span>{label}</span>
            {cost > 0 && <em>${cost.toFixed(3)}</em>}
          </div>
        </Html>
      )}
    </group>
  );
}

function Column({ x, z, m }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.2, 0]} material={m.marble}>
        <boxGeometry args={[1.15, 0.4, 1.15]} />
      </mesh>
      <mesh position={[0, 4.6, 0]} material={m.marble}>
        <cylinderGeometry args={[0.4, 0.44, 8.4, 24]} />
      </mesh>
      <mesh position={[0, 8.95, 0]} material={m.marble}>
        <boxGeometry args={[1.15, 0.35, 1.15]} />
      </mesh>
      {/* warm uplight glow at the foot of each column */}
      <mesh position={[0, 0.42, 0.6]} material={m.glowWarm}>
        <boxGeometry args={[0.7, 0.03, 0.03]} />
      </mesh>
    </group>
  );
}

function CourtSet({ seats, yaws, council, compact, chairSpot, chairScale, chairColor, chairLabel, chairCost, lite }) {
  const m = useMaterials();
  const seal = useMemo(() => sealTexture(), []);

  const chairTop = chairSpot[1] + BENCH.height * chairScale;
  const chairFrontZ = chairSpot[2] + BENCH.offset * chairScale;

  // Wide screens: a bench section in front of each judge, following the arc.
  // Narrow screens: one straight bench in front of the whole squad.
  const sections = compact
    ? (() => {
        const xs = seats.map(([x]) => x);
        const front = Math.max(...seats.map(([, , z]) => z)) + BENCH.offset + 0.1;
        return [
          {
            key: 'all',
            position: [0, 0, front],
            yaw: 0,
            width: Math.max(...xs) - Math.min(...xs) + 1.9,
          },
        ];
      })()
    : seats.map(([x, , z], i) => ({
        key: council[i]?.model + i,
        position: [x + Math.sin(yaws[i]) * BENCH.offset, 0, z + Math.cos(yaws[i]) * BENCH.offset],
        yaw: yaws[i],
        width: BENCH.width,
        color: council[i]?.color,
        label: council[i]?.label,
        cost: council[i]?.cost,
      }));

  const columns = lite ? [-5.2, 5.2, -8.4, 8.4] : [-4.8, 4.8, -7.6, 7.6, -10.4, 10.4];

  return (
    <group>
      {sections.map(({ key, ...s }) => (
        <BenchSection key={key} m={m} {...s} />
      ))}

      {/* the chairman's high bench, with the seal on its front */}
      <group position={[chairSpot[0], 0, chairFrontZ]}>
        <mesh position={[0, chairTop / 2, 0]} material={m.wood}>
          <boxGeometry args={[2.8, chairTop, 0.8]} />
        </mesh>
        <mesh position={[0, chairTop + 0.03, 0.03]} material={m.brass}>
          <boxGeometry args={[2.92, 0.06, 0.92]} />
        </mesh>
        <mesh position={[0, chairTop * 0.55, 0.41]}>
          <circleGeometry args={[0.55, 48]} />
          <meshBasicMaterial map={seal} transparent toneMapped={false} />
        </mesh>
        {/* the sound block the chairman's gavel lands on */}
        <mesh position={[0.95, chairTop + 0.1, 0.12]} material={m.woodDark}>
          <cylinderGeometry args={[0.2, 0.22, 0.09, 32]} />
        </mesh>
        <Html position={[0, chairTop * 0.2, 0.42]} center distanceFactor={9} zIndexRange={[10, 0]}>
          <div className="plate3d" style={{ '--c': chairColor }}>
            <span>{chairLabel}</span>
            {chairCost > 0 && <em>${chairCost.toFixed(3)}</em>}
          </div>
        </Html>
      </group>

      {/* back wall with dark wood slats */}
      <mesh position={[0, 7, -10.5]} material={m.wall}>
        <planeGeometry args={[44, 16]} />
      </mesh>
      {Array.from({ length: lite ? 0 : 15 }, (_, i) => (
        <mesh key={i} position={[-14 + i * 2, 5, -10.4]} material={m.slat}>
          <boxGeometry args={[0.18, 10, 0.12]} />
        </mesh>
      ))}

      {columns.map((x) => (
        <Column key={x} x={x} z={-8.4} m={m} />
      ))}

      {/* the seal, high on the back wall inside the halo */}
      <mesh position={[0, 3.9, -6.65]}>
        <circleGeometry args={[1.6, 64]} />
        <meshBasicMaterial map={seal} transparent opacity={0.85} toneMapped={false} />
      </mesh>

      {/* the bar: a low brass-topped rail with a gap for the aisle */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 4.1, 0, 4.6]}>
          <mesh position={[0, 0.42, 0]} material={m.wood}>
            <boxGeometry args={[5.6, 0.84, 0.16]} />
          </mesh>
          <mesh position={[0, 0.87, 0]} material={m.brass}>
            <boxGeometry args={[5.7, 0.06, 0.22]} />
          </mesh>
        </group>
      ))}

      {/* the aisle carpet, leading from you to the council */}
      <mesh position={[0, 0.006, 10]} rotation={[-Math.PI / 2, 0, 0]} material={m.carpet}>
        <planeGeometry args={[1.9, 16]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.92, 0.008, 10]} rotation={[-Math.PI / 2, 0, 0]} material={m.goldLine}>
          <planeGeometry args={[0.04, 16]} />
        </mesh>
      ))}

      {/* the lectern, where the case is put to the council */}
      <group position={[0, 0, 3.2]}>
        <mesh position={[0, 0.55, 0]} material={m.wood}>
          <boxGeometry args={[0.85, 1.1, 0.55]} />
        </mesh>
        <mesh position={[0, 1.16, 0.02]} rotation={[0.35, 0, 0]} material={m.brass}>
          <boxGeometry args={[0.95, 0.05, 0.6]} />
        </mesh>
      </group>
    </group>
  );
}

export default memo(CourtSet);
