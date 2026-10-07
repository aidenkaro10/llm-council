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
