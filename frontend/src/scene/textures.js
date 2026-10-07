import * as THREE from 'three';
import { markSvgDocument } from './marks';

const cache = new Map();

/** Turn an SVG document into a texture, once, and reuse it after that. */
export function svgTexture(key, svg, size = 256) {
  if (cache.has(key)) return cache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const img = new Image();
  img.onload = () => {
    canvas.getContext('2d').drawImage(img, 0, 0, size, size);
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
