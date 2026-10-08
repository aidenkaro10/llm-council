import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { sealTexture, woodTexture, floorTexture, shaftTexture } from './textures';

/**
 * A real courtroom: the judge's high bench at the front with the seal above
 * it, the witness stand and clerk's desk either side, two counsel tables, a
 * lectern, the rail with its gate, the gallery pews, wood panelling, and tall
 * windows letting daylight in from the left.
 *
 * Everything is simple shapes with materials painted in code, so there is
 * nothing to download.
 */

export const COUNSEL = { tableZ: 0.15, seatZ: 1.15, tableX: 2.7, tableHeight: 0.78 };

function useMaterials() {
  return useMemo(() => {
    const wood = woodTexture('walnut', { base: '#4a2e1c', dark: '#2e1a0e', light: '#6b4630' });
    const woodDark = woodTexture('walnut-dark', { base: '#2f1c10', dark: '#1a0e06', light: '#4a2e1c' });
    return {
      wood: new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
      woodDark: new THREE.MeshPhysicalMaterial({ map: woodDark, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35 }),
      floor: new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.55, metalness: 0.05 }),
      plaster: new THREE.MeshStandardMaterial({ color: '#cdbfa6', roughness: 0.95 }),
      ceiling: new THREE.MeshStandardMaterial({ color: '#b9ab93', roughness: 1 }),
      brass: new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.9, roughness: 0.3 }),
      leather: new THREE.MeshStandardMaterial({ color: '#2a1612', roughness: 0.7 }),
      green: new THREE.MeshStandardMaterial({ color: '#1f6b45', emissive: '#2bbf74', emissiveIntensity: 0.6, roughness: 0.3, transparent: true, opacity: 0.92 }),
      bulb: new THREE.MeshBasicMaterial({ color: '#fff3d6', toneMapped: false }),
      glass: new THREE.MeshBasicMaterial({ color: '#fff4e0', toneMapped: false }),
      shaft: new THREE.MeshBasicMaterial({
        map: shaftTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    };
  }, []);
}

/** A box that casts and catches shadows. */
function Block({ args, position, rotation, material, shadow = true }) {
  return (
    <mesh position={position} rotation={rotation} material={material} castShadow={shadow} receiveShadow>
      <boxGeometry args={args} />
    </mesh>
  );
}

/** A counsel table with chairs behind it and a green banker's lamp. */
function CounselTable({ x, width, seats, m, lite }) {
  const { tableZ, seatZ, tableHeight } = COUNSEL;
  return (
    <group>
      {/* top and modesty panel */}
      <Block args={[width, 0.07, 1.15]} position={[x, tableHeight, tableZ]} material={m.wood} />
      <Block args={[width - 0.1, tableHeight - 0.08, 0.06]} position={[x, (tableHeight - 0.08) / 2, tableZ - 0.52]} material={m.woodDark} />
      {[-1, 1].map((side) => (
        <Block key={side} args={[0.07, tableHeight, 1.0]} position={[x + side * (width / 2 - 0.08), tableHeight / 2, tableZ]} material={m.woodDark} />
      ))}
      {/* a legal pad and pen in front of each seat */}
      {seats.map((sx, i) => (
        <group key={i}>
          <mesh position={[sx, tableHeight + 0.04, tableZ + 0.15]} rotation={[-Math.PI / 2, 0, (i % 2 ? 0.15 : -0.1)]}>
            <planeGeometry args={[0.3, 0.42]} />
            <meshStandardMaterial color="#f3e6a0" roughness={0.9} />
          </mesh>
          {/* the chair back, seen from the gallery */}
          <Block args={[0.62, 0.9, 0.08]} position={[sx, 0.95, seatZ + 0.45]} material={m.leather} />
          <Block args={[0.62, 0.08, 0.55]} position={[sx, 0.5, seatZ + 0.15]} material={m.leather} />
        </group>
      ))}
      {/* banker's lamp */}
      <group position={[x + width / 2 - 0.35, tableHeight, tableZ - 0.25]}>
        <mesh position={[0, 0.03, 0]} material={m.brass}>
          <cylinderGeometry args={[0.09, 0.1, 0.05, 20]} />
        </mesh>
        <mesh position={[0, 0.2, 0]} material={m.brass}>
          <cylinderGeometry args={[0.012, 0.012, 0.32, 8]} />
        </mesh>
        <mesh position={[0, 0.36, 0.02]} rotation={[0, 0, Math.PI / 2]} material={m.green}>
          <cylinderGeometry args={[0.07, 0.11, 0.42, 20, 1, true, 0, Math.PI]} />
        </mesh>
        {!lite && <pointLight position={[0, 0.3, 0.05]} color="#ffd9a0" intensity={1.2} distance={2.2} />}
      </group>
    </group>
  );
}

function CourtSet({ seats, compact, chairSpot, chairScale, lite }) {
  const m = useMaterials();
  const seal = useMemo(() => sealTexture(), []);

  const benchTop = chairSpot[1] + 1.06 * chairScale;
  const benchFront = chairSpot[2] + 0.68 * chairScale + 0.1;

  // counsel tables sized to whoever sits at them
  const left = seats.filter(([x]) => x < 0).map(([x]) => x);
  const right = seats.filter(([x]) => x >= 0).map(([x]) => x);
  const tableFor = (xs) =>
    xs.length ? { x: (Math.min(...xs) + Math.max(...xs)) / 2, width: Math.max(...xs) - Math.min(...xs) + 1.5 } : null;
  const tables = [tableFor(left), tableFor(right)].filter(Boolean);

  const windows = lite ? [-1.5, 3.5] : [-3.5, 0.5, 4.5];

  return (
    <group>
      {/* floor and ceiling */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]} material={m.floor} receiveShadow>
        <planeGeometry args={[24, 28]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 9.5, 2]} material={m.ceiling}>
        <planeGeometry args={[24, 28]} />
      </mesh>

      {/* back wall: panelling below, plaster above, the seal over the judge */}
      <Block args={[24, 3.2, 0.2]} position={[0, 1.6, -8]} material={m.wood} shadow={false} />
      <Block args={[24, 6.4, 0.2]} position={[0, 6.4, -8.05]} material={m.plaster} shadow={false} />
      <Block args={[24, 0.12, 0.3]} position={[0, 3.24, -7.95]} material={m.brass} shadow={false} />
      <Block args={[5.6, 4.2, 0.16]} position={[0, 4.6, -7.88]} material={m.woodDark} shadow={false} />
      <mesh position={[0, 4.7, -7.78]}>
        <circleGeometry args={[1.5, 64]} />
        <meshStandardMaterial map={seal} transparent emissiveMap={seal} emissive="#c9a24a" emissiveIntensity={0.35} metalness={0.6} roughness={0.35} />
      </mesh>
      {/* fluted pilasters either side of the seal */}
      {[-3.4, 3.4, -7, 7].map((x) => (
        <group key={x}>
          <Block args={[0.42, 6.2, 0.18]} position={[x, 3.1, -7.86]} material={m.wood} shadow={false} />
          {/* a brass capital on top, like the rail */}
          <Block args={[0.54, 0.14, 0.26]} position={[x, 6.27, -7.84]} material={m.brass} shadow={false} />
        </group>
      ))}

      {/* right wall: panelled */}
      <Block args={[0.2, 3.2, 28]} position={[11.5, 1.6, 2]} material={m.wood} shadow={false} />
      <Block args={[0.2, 6.4, 28]} position={[11.55, 6.4, 2]} material={m.plaster} shadow={false} />

      {/* left wall: panelling with tall windows letting the daylight in */}
      <Block args={[0.2, 2.2, 28]} position={[-11.5, 1.1, 2]} material={m.wood} shadow={false} />
      <Block args={[0.2, 1.2, 28]} position={[-11.55, 8.9, 2]} material={m.plaster} shadow={false} />
      {windows.map((z) => (
        <group key={z} position={[-11.45, 5.1, z]}>
          <mesh rotation={[0, Math.PI / 2, 0]} material={m.glass}>
            <planeGeometry args={[2.2, 5.2]} />
          </mesh>
          {/* mullions */}
          <Block args={[0.08, 5.2, 0.08]} position={[0.05, 0, 0]} material={m.woodDark} shadow={false} />
          <Block args={[0.08, 0.08, 2.2]} position={[0.05, 0.6, 0]} material={m.woodDark} shadow={false} />
          {/* a shaft of daylight falling into the room */}
          {!lite && (
            <mesh position={[3.75, -2.6, 0.4]} rotation={[0, 0, 0.88]} material={m.shaft}>
              <planeGeometry args={[2.0, 11]} />
            </mesh>
          )}
        </group>
      ))}
      {/* plaster between the windows */}
      <Block args={[0.2, 6.6, 28]} position={[-11.6, 5.1, 2]} material={m.plaster} shadow={false} />

      {/* the judge's high bench */}
      <group position={[chairSpot[0], 0, benchFront]}>
        <Block args={[4.4, benchTop, 1.0]} position={[0, benchTop / 2, 0]} material={m.wood} />
        <Block args={[4.6, 0.08, 1.2]} position={[0, benchTop + 0.04, 0.05]} material={m.woodDark} />
        {/* raised panels on the front */}
        {[-1.4, 0, 1.4].map((x) => (
          <Block key={x} args={[1.15, benchTop * 0.62, 0.05]} position={[x, benchTop * 0.45, 0.52]} material={m.woodDark} />
        ))}
        <Block args={[4.5, 0.06, 0.08]} position={[0, benchTop - 0.12, 0.54]} material={m.brass} shadow={false} />
        {/* the sound block */}
        <mesh position={[1.05, benchTop + 0.13, 0.22]} material={m.woodDark} castShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.09, 32]} />
        </mesh>
      </group>

      {/* witness stand (judge's right) and clerk's desk (judge's left) */}
      <group position={[4.1, 0, -3.1]}>
        <Block args={[1.8, 1.25, 1.6]} position={[0, 0.62, 0]} material={m.wood} />
        <Block args={[1.95, 0.07, 1.75]} position={[0, 1.28, 0]} material={m.woodDark} />
      </group>
      <group position={[-4.1, 0, -2.9]}>
        <Block args={[2.4, 1.0, 1.1]} position={[0, 0.5, 0]} material={m.wood} />
        <Block args={[2.5, 0.06, 1.2]} position={[0, 1.03, 0]} material={m.woodDark} />
      </group>

      {/* counsel tables */}
      {tables.map((t, i) => (
        <CounselTable
          key={i}
          x={t.x}
          width={t.width}
          seats={seats.map(([x]) => x).filter((x) => (i === 0 ? x < 0 : x >= 0) || tables.length === 1)}
          m={m}
          lite={lite}
        />
      ))}

      {/* the lectern, facing the bench */}
      <group position={[0, 0, -1.1]}>
        <Block args={[0.8, 1.15, 0.55]} position={[0, 0.58, 0]} material={m.wood} />
        <Block args={[0.9, 0.05, 0.62]} position={[0, 1.18, -0.02]} rotation={[-0.25, 0, 0]} material={m.woodDark} />
      </group>

      {/* the bar: a rail with balusters and a gate in the middle */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block args={[8.2, 0.1, 0.2]} position={[side * 5.1, 1.0, 3.4]} material={m.wood} />
          <Block args={[8.2, 0.1, 0.2]} position={[side * 5.1, 0.12, 3.4]} material={m.wood} />
          {Array.from({ length: lite ? 8 : 16 }, (_, i) => (
            <mesh key={i} position={[side * (1.2 + i * (lite ? 1.0 : 0.5)), 0.56, 3.4]} material={m.woodDark} castShadow>
              <cylinderGeometry args={[0.035, 0.045, 0.85, 8]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* gallery pews */}
      {[4.7, 6.1, 7.5].slice(0, lite ? 2 : 3).map((z) =>
        [-1, 1].map((side) => (
          <group key={`${z}${side}`} position={[side * 4.9, 0, z]}>
            <Block args={[7.2, 0.08, 0.6]} position={[0, 0.48, 0]} material={m.wood} />
            <Block args={[7.2, 0.85, 0.08]} position={[0, 0.88, 0.32]} material={m.wood} />
            <Block args={[0.08, 0.48, 0.6]} position={[-3.55, 0.24, 0]} material={m.woodDark} />
            <Block args={[0.08, 0.48, 0.6]} position={[3.55, 0.24, 0]} material={m.woodDark} />
          </group>
        ))
      )}

      {/* hanging pendant lights */}
      {!lite &&
        [-5, 0, 5].map((x) => (
          <group key={x} position={[x, 7.4, -1]}>
            <mesh position={[0, 1.05, 0]} material={m.brass}>
              <cylinderGeometry args={[0.01, 0.01, 2.1, 6]} />
            </mesh>
            <mesh material={m.brass}>
              <cylinderGeometry args={[0.15, 0.5, 0.35, 24, 1, true]} />
            </mesh>
            <mesh position={[0, -0.12, 0]} material={m.bulb}>
              <sphereGeometry args={[0.12, 16, 16]} />
            </mesh>
          </group>
        ))}
    </group>
  );
}

export default memo(CourtSet);
