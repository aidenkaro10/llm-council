/**
 * A council mech. Drawn entirely in SVG, no image files.
 *
 * The head is a cube carrying the model maker's mark, the armour is painted in
 * that maker's colour, and the whole thing reacts to what the model is doing.
 *
 * state: 'waiting' | 'thinking' | 'speaking' | 'done' | 'failed'
 */

/** Stylised maker's marks. Simple geometry, not copies of official artwork. */
export function Mark({ vendor, color }) {
  const stroke = { stroke: color, strokeWidth: 3, fill: 'none', strokeLinecap: 'round' };

  switch (vendor) {
    case 'openai':
      // interlocking rosette
      return (
        <g {...stroke} strokeWidth="2.4">
          <ellipse cx="0" cy="0" rx="11" ry="5.5" />
          <ellipse cx="0" cy="0" rx="11" ry="5.5" transform="rotate(60)" />
          <ellipse cx="0" cy="0" rx="11" ry="5.5" transform="rotate(120)" />
        </g>
      );
    case 'anthropic':
      // three-pronged burst
      return (
        <g fill={color}>
          {[0, 120, 240].map((angle) => (
            <path key={angle} d="M-3 0 L0 -12 L3 0 L0 4 Z" transform={`rotate(${angle})`} />
          ))}
        </g>
      );
    case 'google':
      // four-pointed spark
      return (
        <path
          d="M0 -12 Q1.6 -1.6 12 0 Q1.6 1.6 0 12 Q-1.6 1.6 -12 0 Q-1.6 -1.6 0 -12 Z"
          fill={color}
        />
      );
    case 'x-ai':
      return (
        <g {...stroke} strokeWidth="3.4">
          <line x1="-9" y1="-9" x2="9" y2="9" />
          <line x1="9" y1="-9" x2="-9" y2="9" />
        </g>
      );
    case 'meta-llama':
      return (
        <g {...stroke} strokeWidth="2.6">
          <circle cx="-5.5" cy="0" r="5.5" />
          <circle cx="5.5" cy="0" r="5.5" />
        </g>
      );
    case 'mistralai':
      return (
        <g fill={color}>
          <rect x="-11" y="-10" width="22" height="5" />
          <rect x="-11" y="-2.5" width="22" height="5" />
          <rect x="-11" y="5" width="22" height="5" />
        </g>
      );
    case 'deepseek':
      return (
        <g {...stroke} strokeWidth="2.8">
          <path d="M10 -4 A 10 10 0 1 0 6 8" />
          <circle cx="2" cy="-1" r="2" fill={color} />
        </g>
      );
    default:
      // anything else gets a clean hex sigil
      return (
        <polygon
          points="0,-11 9.5,-5.5 9.5,5.5 0,11 -9.5,5.5 -9.5,-5.5"
          {...stroke}
          strokeWidth="2.6"
        />
      );
  }
}

export default function Judge({ color, vendor, state, variant = 0, size = 118 }) {
  const dead = state === 'failed';

  // Painted armour, plus darker and lighter shades of it for depth
  const paint = dead ? '#555c66' : color;
  const shade = dead ? '#3d434b' : `color-mix(in srgb, ${color} 58%, #000)`;
  const deep = dead ? '#30353c' : `color-mix(in srgb, ${color} 35%, #000)`;
  const light = dead ? '#6d747e' : `color-mix(in srgb, ${color} 50%, #fff)`;
  const metal = dead ? '#3a3f46' : '#262b33';
  const metalLight = dead ? '#4f555d' : '#3a414c';
  const glow = dead ? '#6b7280' : color;

  return (
    <svg
      className={`mech mech-${state}`}
      viewBox="0 0 152 152"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {/* ---------- legs, mostly hidden by the bench ---------- */}
      <path d="M50 152 L52 124 L66 124 L64 152 Z" fill={metal} />
      <path d="M90 152 L88 124 L74 124 L76 152 Z" fill={metal} />

      {/* ---------- left arm, hanging ---------- */}
      <path d="M26 86 L42 86 L40 112 L28 112 Z" fill={metalLight} />
      <rect x="26" y="110" width="16" height="16" rx="4" fill={paint} />
      <rect x="28" y="124" width="12" height="9" rx="3" fill={metal} />

      {/* ---------- torso ---------- */}
      <path d="M46 64 L94 64 L98 76 L90 122 L50 122 L42 76 Z" fill={paint} />
      {/* chest plate, a V of darker armour */}
      <path d="M50 70 L90 70 L84 98 L70 104 L56 98 Z" fill={shade} />
      <path d="M50 70 L90 70 L88 76 L52 76 Z" fill={light} opacity="0.35" />
      {/* power core, pulses while the model works */}
      <circle className="mech-core" cx="70" cy="85" r="7.5" fill={glow} />
      <circle cx="70" cy="85" r="3.2" fill="#fff" opacity={dead ? 0.25 : 0.9} />
      {/* abdominal plates */}
      <rect x="56" y="106" width="28" height="5" rx="1.5" fill={deep} />
      <rect x="58" y="113" width="24" height="5" rx="1.5" fill={deep} />
      {/* belt */}
      <rect x="48" y="119" width="44" height="6" rx="2" fill={metal} />

      {/* ---------- shoulder pauldrons ---------- */}
      <path d="M18 74 Q18 62 32 60 L48 62 L46 88 L24 90 Q18 84 18 74 Z" fill={paint} />
      <path d="M122 74 Q122 62 108 60 L92 62 L94 88 L116 90 Q122 84 122 74 Z" fill={paint} />
      <path d="M21 70 Q23 64 32 63 L45 64" stroke={light} strokeWidth="3" fill="none" opacity="0.55" />
      <path d="M119 70 Q117 64 108 63 L95 64" stroke={light} strokeWidth="3" fill="none" opacity="0.55" />
      {variant >= 2 && (
        <g stroke={deep} strokeWidth="2" strokeLinecap="round">
          <line x1="24" y1="76" x2="40" y2="77" />
          <line x1="24" y1="82" x2="40" y2="83" />
          <line x1="116" y1="76" x2="100" y2="77" />
          <line x1="116" y1="82" x2="100" y2="83" />
        </g>
      )}

      {/* ---------- right arm, holding the gavel out to the side ---------- */}
      <path d="M108 86 L120 84 L132 100 L124 106 Z" fill={metalLight} />

      {/* ---------- the gavel ---------- */}
      <g className="mech-weapon">
        <rect x="128" y="48" width="5.5" height="74" rx="2.75" fill={metalLight} />
        <rect x="116" y="36" width="30" height="16" rx="3.5" fill={paint} />
        <rect x="116" y="36" width="30" height="5" rx="2.5" fill={light} opacity="0.6" />
        <rect x="114" y="38" width="4" height="12" rx="1.5" fill={deep} />
        <rect x="144" y="38" width="4" height="12" rx="1.5" fill={deep} />
      </g>
      {/* the fist goes over the haft so it reads as gripped */}
      <rect x="122" y="96" width="16" height="13" rx="4" fill={paint} />
      <rect x="122" y="96" width="16" height="4" rx="2" fill={light} opacity="0.4" />

      {/* ---------- neck ---------- */}
      <rect x="62" y="54" width="16" height="12" fill={metal} />
      <rect x="62" y="58" width="16" height="2" fill={metalLight} />

      {/* ---------- head: a cube, mostly front-on so the mark reads ---------- */}
      <g className="mech-head">
        {/* top face */}
        <path d="M42 10 L50 3 L106 3 L98 10 Z" fill={light} />
        {/* side face */}
        <path d="M98 10 L106 3 L106 50 L98 57 Z" fill={shade} />
        {/* front face */}
        <rect x="42" y="10" width="56" height="47" rx="3" fill={paint} />
        <rect x="42" y="10" width="56" height="47" rx="3" fill="none" stroke={light} strokeOpacity="0.35" strokeWidth="1.5" />

        {/* the maker's mark is the face */}
        <g transform="translate(70, 31) scale(1.45)">
          <Mark vendor={vendor} color={dead ? '#8b919a' : '#ffffff'} />
        </g>

        {/* sensor strip under the mark, flickers while working */}
        <rect
          className="mech-sensor"
          x="52"
          y="49"
          width="36"
          height="3"
          rx="1.5"
          fill={dead ? '#6b7280' : '#ffffff'}
          opacity={dead ? 0.25 : 0.75}
        />

        {/* antenna on every other mech */}
        {variant % 2 === 0 && (
          <g strokeLinecap="round">
            <line x1="92" y1="3" x2="96" y2="-8" stroke={metalLight} strokeWidth="2.5" />
            <circle cx="96" cy="-8" r="3" fill={glow} />
          </g>
        )}
      </g>
    </svg>
  );
}
