import * as THREE from 'three';
import { markSvgDocument } from './marks';

const cache = new Map();

/** Turn an SVG document into a texture, once, and reuse it after that. */
export function svgTexture(key, svg, size = 256, height = size) {
  if (cache.has(key)) return cache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const img = new Image();
  img.onload = () => {
    canvas.getContext('2d').drawImage(img, 0, 0, size, height);
    texture.needsUpdate = true;
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  cache.set(key, texture);
  return texture;
}

/** A maker's mark in white, for a mech's face. */
export function markTexture(vendor) {
  return svgTexture('mark:' + vendor, markSvgDocument(vendor, '#ffffff'));
}

/** The court's seal: scales of justice inside two rings. */
export function sealTexture() {
  const gold = '#f1cf78';
  return svgTexture(
    'seal',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100" width="512" height="512">
      <circle r="46" fill="none" stroke="${gold}" stroke-width="2"/>
      <circle r="41" fill="none" stroke="${gold}" stroke-width="0.7"/>
      <g stroke="${gold}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <line x1="0" y1="-25" x2="0" y2="24"/>
        <line x1="-25" y1="-16" x2="25" y2="-16"/>
        <path d="M-14 24 H14"/>
        <line x1="-25" y1="-16" x2="-33" y2="5"/>
        <line x1="-25" y1="-16" x2="-17" y2="5"/>
        <line x1="25" y1="-16" x2="17" y2="5"/>
        <line x1="25" y1="-16" x2="33" y2="5"/>
      </g>
      <circle cx="0" cy="-28" r="3" fill="${gold}"/>
      <path d="M-35 5 Q-25 16 -15 5 Z" fill="${gold}"/>
      <path d="M15 5 Q25 16 35 5 Z" fill="${gold}"/>
    </svg>`,
    512
  );
}

// The LED mouth under the mark, one shape per mood
const MOUTHS = {
  neutral: '<path d="M30 16 H98" />',
  happy: '<path d="M24 8 Q64 34 104 8" />',
  smug: '<path d="M30 18 Q72 26 104 6" />',
  sad: '<path d="M30 26 Q64 4 98 26" />',
  annoyed: '<path d="M28 18 L46 13 L64 19 L82 13 L100 18" />',
  angry: '<path d="M26 25 L45 12 L64 25 L83 12 L102 25" />',
  shocked: '<ellipse cx="64" cy="16" rx="13" ry="11" />',
  laughing: '<path d="M22 6 Q64 42 106 6 Z" fill="#fff" />',
  talk: '<ellipse cx="64" cy="16" rx="20" ry="8" />',
  talkWide: '<ellipse cx="64" cy="16" rx="26" ry="11" />',
};

export function mouthTexture(mood) {
  const shape = MOUTHS[mood] || MOUTHS.neutral;
  return svgTexture(
    'mouth:' + mood,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 32" width="256" height="64">
      <g stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none">${shape}</g>
    </svg>`,
    256,
    64
  );
}

// --- the room's materials, painted in code ---------------------------------

/** A small deterministic random, so the wood looks the same on every visit. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Wood grain: long wavy lines in slightly different shades on a base colour.
 * Used for the bench, the tables and the wall panelling.
 */
export function woodTexture(key = 'wood', { base = '#5a3a24', dark = '#3b2416', light = '#7a5236' } = {}) {
  if (cache.has(key)) return cache.get(key);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const rand = rng(key.length * 977 + 13);

  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 140; i++) {
    const y0 = rand() * size;
    const amp = 2 + rand() * 6;
    const freq = 0.004 + rand() * 0.01;
    g.strokeStyle = rand() < 0.5 ? dark : light;
    g.globalAlpha = 0.08 + rand() * 0.22;
    g.lineWidth = 0.6 + rand() * 2.2;
    g.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const y = y0 + Math.sin(x * freq + i) * amp + Math.sin(x * freq * 3.1) * amp * 0.3;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  cache.set(key, texture);
  return texture;
}

/** A plank floor: staggered boards in varied tones with thin dark seams. */
export function floorTexture() {
  const key = 'floor';
  if (cache.has(key)) return cache.get(key);
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const rand = rng(4242);

  const boardH = 64;
  const tones = ['#6b4a30', '#5e4029', '#74513a', '#654530', '#58391f'];
  for (let row = 0; row < size / boardH; row++) {
    let x = -rand() * 300;
    while (x < size) {
      const w = 220 + rand() * 260;
      g.fillStyle = tones[Math.floor(rand() * tones.length)];
      g.fillRect(x, row * boardH, w, boardH);
      // a few grain lines along each board
      for (let k = 0; k < 6; k++) {
        g.strokeStyle = rand() < 0.5 ? '#3a2416' : '#8a6040';
        g.globalAlpha = 0.12 + rand() * 0.15;
        g.lineWidth = 1;
        const yy = row * boardH + 6 + rand() * (boardH - 12);
        g.beginPath();
        g.moveTo(x, yy);
        g.bezierCurveTo(x + w * 0.3, yy + (rand() - 0.5) * 6, x + w * 0.7, yy + (rand() - 0.5) * 6, x + w, yy);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = '#21140b';
      g.fillRect(x + w - 2, row * boardH, 2, boardH);
      x += w;
    }
    g.fillStyle = '#21140b';
    g.fillRect(0, row * boardH + boardH - 2, size, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.anisotropy = 8;
  cache.set(key, texture);
  return texture;
}

/** A soft vertical fade for shafts of daylight from the windows. */
export function shaftTexture() {
  const key = 'shaft';
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,240,215,0.55)');
  grad.addColorStop(1, 'rgba(255,240,215,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 256);
  const texture = new THREE.CanvasTexture(canvas);
  cache.set(key, texture);
  return texture;
}
