/**
 * Stylised maker's marks, drawn as SVG markup centred on (0, 0), roughly 24
 * units across. One source for both the 2D badges and the 3D head textures.
 *
 * These are simple geometric drawings for telling the judges apart, not the
 * companies' official logos.
 */

const MARKS = {
  // interlocking rosette
  openai: (c) => `
    <g stroke="${c}" stroke-width="2.4" fill="none">
      <ellipse rx="11" ry="5.5"/>
      <ellipse rx="11" ry="5.5" transform="rotate(60)"/>
      <ellipse rx="11" ry="5.5" transform="rotate(120)"/>
    </g>`,
  // three-pronged burst
  anthropic: (c) => `
    <g fill="${c}">
      <path d="M-3 0 L0 -12 L3 0 L0 4 Z"/>
      <path d="M-3 0 L0 -12 L3 0 L0 4 Z" transform="rotate(120)"/>
      <path d="M-3 0 L0 -12 L3 0 L0 4 Z" transform="rotate(240)"/>
    </g>`,
  // four-pointed spark
  google: (c) => `
    <path d="M0 -12 Q1.6 -1.6 12 0 Q1.6 1.6 0 12 Q-1.6 1.6 -12 0 Q-1.6 -1.6 0 -12 Z" fill="${c}"/>`,
  'x-ai': (c) => `
    <g stroke="${c}" stroke-width="3.4" stroke-linecap="round">
      <line x1="-9" y1="-9" x2="9" y2="9"/>
      <line x1="9" y1="-9" x2="-9" y2="9"/>
    </g>`,
  'meta-llama': (c) => `
    <g stroke="${c}" stroke-width="2.6" fill="none">
      <circle cx="-5.5" r="5.5"/>
      <circle cx="5.5" r="5.5"/>
    </g>`,
  mistralai: (c) => `
    <g fill="${c}">
      <rect x="-11" y="-10" width="22" height="5"/>
      <rect x="-11" y="-2.5" width="22" height="5"/>
      <rect x="-11" y="5" width="22" height="5"/>
    </g>`,
  deepseek: (c) => `
    <g stroke="${c}" stroke-width="2.8" fill="none" stroke-linecap="round">
      <path d="M10 -4 A 10 10 0 1 0 6 8"/>
    </g>
    <circle cx="2" cy="-1" r="2" fill="${c}"/>`,
};

// anything without a known maker gets a clean hex sigil
const FALLBACK = (c) => `
  <polygon points="0,-11 9.5,-5.5 9.5,5.5 0,11 -9.5,5.5 -9.5,-5.5"
    stroke="${c}" stroke-width="2.6" fill="none"/>`;

/** Inner SVG markup for a maker's mark. */
export function markMarkup(vendor, color) {
  return (MARKS[vendor] || FALLBACK)(color);
}

/** A complete standalone SVG document of the mark, for turning into a texture. */
export function markSvgDocument(vendor, color, size = 256) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -16 32 32" width="${size}" height="${size}">${markMarkup(vendor, color)}</svg>`;
}
