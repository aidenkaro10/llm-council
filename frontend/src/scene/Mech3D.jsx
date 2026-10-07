import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Html } from '@react-three/drei';
import { easing } from 'maath';
import * as THREE from 'three';
import { markSvgDocument } from './marks';

/**
 * A council member as a 3D mech, built from simple blocks so there are no
 * model files to download.
 *
 * state: 'waiting' | 'thinking' | 'speaking' | 'done' | 'failed'
 */

const textureCache = new Map();

/** The maker's mark, rendered once into a texture for the head's front face. */
function markTexture(vendor) {
  if (textureCache.has(vendor)) return textureCache.get(vendor);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const img = new Image();
  img.onload = () => {
    canvas.getContext('2d').drawImage(img, 0, 0, 256, 256);
    texture.needsUpdate = true;
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markSvgDocument(vendor, '#ffffff'));

  textureCache.set(vendor, texture);
  return texture;
}

/** The last few words said, for the speech bubble. Stops before the ballot. */
function lastWords(text, limit = 60) {
  if (!text) return '';
  const body = text.split(/\bFINAL\b/)[0];
  const clean = body.replace(/[#*`>_]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length <= limit ? clean : '...' + clean.slice(-limit);
}

function Crown() {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.8;
  });
  const gold = (
    <meshStandardMaterial
      color="#ffcf3f"
      emissive="#ffb000"
      emissiveIntensity={1.4}
      metalness={0.9}
      roughness={0.25}
      toneMapped={false}
    />
  );
  return (
    <group ref={ref} position={[0, 0.72, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.26, 0.045, 12, 40]} />
        {gold}
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.26, 0.13, Math.sin(a) * 0.26]}>
            <coneGeometry args={[0.055, 0.22, 8]} />
            {gold}
          </mesh>
        );
      })}
      <pointLight color="#ffc53d" intensity={3} distance={2.5} position={[0, 0.3, 0]} />
    </group>
  );
}

export default function Mech3D({
  model,
  color,
  vendor,
  state = 'waiting',
  variant = 0,
  won = false,
  text,
  cost,
  label,
  position = [0, 0, 0],
  lookAt = [0, 10],
  scale = 1,
  phaseOffset = 0,
  onSelect,
  showLabels = true,
  // false hides this mech's words (on narrow screens only one speaks at a time)
  showWords = true,
}) {
  const root = useRef();
  const body = useRef();
  const head = useRef();
  const core = useRef();
  const face = useRef();
  const gavel = useRef();

  const dead = state === 'failed';
  const texture = useMemo(() => markTexture(vendor), [vendor]);

  const paint = dead ? '#4d535c' : color;
  const shade = useMemo(
    () => (dead ? '#353a41' : new THREE.Color(color).multiplyScalar(0.45).getStyle()),
    [color, dead]
  );

  useFrame((frame, dt) => {
    const t = frame.clock.elapsedTime + phaseOffset;

    // turn smoothly to face whatever it should be looking at
    if (root.current) {
      const yaw = Math.atan2(lookAt[0] - position[0], lookAt[1] - position[2]);
      easing.dampAngle(root.current.rotation, 'y', yaw, 0.6, dt);
    }

    // how much it bobs, and how fast, depends on what the model is doing
    const bob =
      state === 'speaking' ? Math.sin(t * 7) * 0.035 :
      state === 'thinking' ? Math.sin(t * 2.2) * 0.02 :
      dead ? 0 :
      Math.sin(t * 1.4) * 0.015;
    if (body.current) body.current.position.y = bob;

    // a failed mech slumps forward
    if (body.current) easing.damp(body.current.rotation, 'x', dead ? 0.22 : 0, 0.4, dt);

    if (head.current) {
      const scan = state === 'thinking' ? Math.sin(t * 1.7) * 0.4 : 0;
      const nod = state === 'speaking' ? Math.sin(t * 9) * 0.06 : 0;
      easing.damp(head.current.rotation, 'y', scan, 0.25, dt);
      easing.damp(head.current.rotation, 'x', nod, 0.1, dt);
    }

    // the power core and the mark glow brighter while the model works
    const working = state === 'thinking' || state === 'speaking';
    if (core.current) {
      const target = dead ? 0 : working ? 3 + Math.sin(t * 8) * 1.5 : 1.4;
      easing.damp(core.current.material, 'emissiveIntensity', target, 0.15, dt);
    }
    if (face.current) {
      const target = dead ? 0.1 : state === 'speaking' ? 2.4 + Math.sin(t * 14) * 0.4 : won ? 2.2 : 1.5;
      easing.damp(face.current.material, 'emissiveIntensity', target, 0.15, dt);
    }

    // the gavel lifts while speaking, and rests otherwise
    if (gavel.current) {
      const lift = state === 'speaking' ? -0.35 + Math.sin(t * 5) * 0.15 : 0;
      easing.damp(gavel.current.rotation, 'z', lift, 0.3, dt);
    }
  });

  const paintMat = (
    <meshPhysicalMaterial
      color={paint}
      roughness={0.32}
      metalness={0.12}
      clearcoat={1}
      clearcoatRoughness={0.18}
    />
  );
  const shadeMat = <meshPhysicalMaterial color={shade} roughness={0.45} metalness={0.2} clearcoat={0.5} />;
  const metalMat = <meshStandardMaterial color="#1b1f26" roughness={0.42} metalness={0.75} />;

  const words = state === 'speaking' && showWords ? lastWords(text) : '';

  return (
    <group
      ref={root}
      position={position}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(model);
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {/* a glowing ring on the floor in the maker's colour */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.62, 0.7, 48]} />
        <meshBasicMaterial color={dead ? '#3a3f46' : color} toneMapped={false} transparent opacity={dead ? 0.3 : 0.9} />
      </mesh>
      {/* coloured backlight, gives each mech a rim of its own colour */}
      {!dead && <pointLight color={color} intensity={6} distance={3.2} position={[0, 1.6, -0.9]} />}

      <group ref={body}>
        {/* legs */}
        <mesh position={[-0.2, 0.36, 0]}>
          <boxGeometry args={[0.26, 0.72, 0.3]} />
          {metalMat}
        </mesh>
        <mesh position={[0.2, 0.36, 0]}>
          <boxGeometry args={[0.26, 0.72, 0.3]} />
          {metalMat}
        </mesh>
        <RoundedBox args={[0.3, 0.16, 0.38]} radius={0.05} position={[-0.2, 0.08, 0.04]}>
          {paintMat}
        </RoundedBox>
        <RoundedBox args={[0.3, 0.16, 0.38]} radius={0.05} position={[0.2, 0.08, 0.04]}>
          {paintMat}
        </RoundedBox>

        {/* hips and torso */}
        <RoundedBox args={[0.72, 0.2, 0.42]} radius={0.06} position={[0, 0.8, 0]}>
          {metalMat}
        </RoundedBox>
        <RoundedBox args={[0.96, 0.82, 0.56]} radius={0.1} position={[0, 1.3, 0]}>
          {paintMat}
        </RoundedBox>
        <RoundedBox args={[0.6, 0.46, 0.1]} radius={0.04} position={[0, 1.36, 0.27]}>
          {shadeMat}
        </RoundedBox>
        <mesh ref={core} position={[0, 1.36, 0.33]}>
          <sphereGeometry args={[0.085, 24, 24]} />
          <meshStandardMaterial color={paint} emissive={dead ? '#000' : color} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>

        {/* shoulders */}
        <RoundedBox args={[0.42, 0.34, 0.52]} radius={0.12} position={[-0.66, 1.6, 0]}>
          {paintMat}
        </RoundedBox>
        <RoundedBox args={[0.42, 0.34, 0.52]} radius={0.12} position={[0.66, 1.6, 0]}>
          {paintMat}
        </RoundedBox>

        {/* left arm, hanging */}
        <mesh position={[-0.7, 1.2, 0]}>
          <boxGeometry args={[0.2, 0.46, 0.22]} />
          {metalMat}
        </mesh>
        <RoundedBox args={[0.26, 0.38, 0.28]} radius={0.06} position={[-0.72, 0.82, 0.02]}>
          {paintMat}
        </RoundedBox>

        {/* right arm, holding the gavel */}
        <mesh position={[0.7, 1.2, 0]}>
          <boxGeometry args={[0.2, 0.46, 0.22]} />
          {metalMat}
        </mesh>
        <group ref={gavel} position={[0.74, 0.86, 0.1]}>
          <RoundedBox args={[0.26, 0.24, 0.28]} radius={0.06}>
            {paintMat}
          </RoundedBox>
          <mesh position={[0.02, 0.5, 0.08]}>
            <cylinderGeometry args={[0.035, 0.035, 1.05, 12]} />
            {metalMat}
          </mesh>
          <RoundedBox args={[0.44, 0.2, 0.2]} radius={0.05} position={[0.02, 1.04, 0.08]}>
            {paintMat}
          </RoundedBox>
        </group>

        {/* neck */}
        <mesh position={[0, 1.8, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.16, 16]} />
          {metalMat}
        </mesh>

        {/* head: a cube with the maker's mark as its face */}
        <group ref={head} position={[0, 2.2, 0]}>
          <RoundedBox args={[0.72, 0.68, 0.68]} radius={0.07}>
            {paintMat}
          </RoundedBox>
          <mesh ref={face} position={[0, 0.03, 0.342]}>
            <planeGeometry args={[0.46, 0.46]} />
            <meshStandardMaterial
              map={texture}
              emissiveMap={texture}
              emissive="#ffffff"
              emissiveIntensity={1.5}
              transparent
              toneMapped={false}
            />
          </mesh>
          {/* sensor strip under the mark */}
          <mesh position={[0, -0.24, 0.343]}>
            <planeGeometry args={[0.4, 0.035]} />
            <meshBasicMaterial color={dead ? '#444' : '#ffffff'} toneMapped={false} />
          </mesh>
          {variant % 2 === 0 && (
            <group position={[0.22, 0.34, 0]}>
              <mesh position={[0, 0.14, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 0.28, 8]} />
                {metalMat}
              </mesh>
              <mesh position={[0, 0.3, 0]}>
                <sphereGeometry args={[0.04, 12, 12]} />
                <meshBasicMaterial color={dead ? '#333' : color} toneMapped={false} />
              </mesh>
            </group>
          )}
          {won && <Crown />}
        </group>
      </group>

      {/* speech bubble and nameplate float in the scene as HTML */}
      {showLabels && (
        <>
          <Html position={[0, 3.05, 0]} center distanceFactor={9} zIndexRange={[20, 0]}>
            {(state === 'thinking' || (state === 'speaking' && !words && showWords)) && (
              <div className="bubble3d" style={{ '--c': color }}>
                <span className="dots"><i /><i /><i /></span>
              </div>
            )}
            {words && (
              <div className="bubble3d" style={{ '--c': color }}>
                {words}
              </div>
            )}
            {dead && <div className="bubble3d bubble3d-off">offline</div>}
          </Html>
          <Html position={[0, -0.3, 0]} center distanceFactor={9} zIndexRange={[20, 0]}>
            <div className="plate3d" style={{ '--c': color }}>
              <span>{label}</span>
              {cost > 0 && <em>${cost.toFixed(3)}</em>}
            </div>
          </Html>
        </>
      )}
    </group>
  );
}
