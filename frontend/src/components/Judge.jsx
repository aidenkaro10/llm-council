/**
 * One cartoon judge. Everything is drawn with plain SVG shapes so there are no
 * image files to load, and the whole thing animates with CSS.
 *
 * state: 'waiting' | 'thinking' | 'speaking' | 'done' | 'failed'
 * variant: 0-3, picks the hair/glasses/beard combo so the judges look different
 */
export default function Judge({ color, state, variant = 0, size = 96 }) {
  const dead = state === 'failed';
  const skin = dead ? '#c9c4bd' : '#f3c9a6';
  const robe = dead ? '#9aa0a6' : color;
  const happy = state === 'done';

  return (
    <svg
      className={`judge-svg judge-${state}`}
      viewBox="0 0 100 112"
      width={size}
      height={size * 1.12}
      aria-hidden="true"
    >
      {/* robe and shoulders */}
      <path d="M14 112 Q14 84 34 78 L66 78 Q86 84 86 112 Z" fill={robe} />
      {/* white collar bands */}
      <path d="M44 78 L50 96 L56 78 Z" fill="#ffffff" />
      <rect x="46" y="76" width="8" height="8" rx="2" fill={skin} />

      {/* head */}
      <ellipse cx="50" cy="48" rx="27" ry="29" fill={skin} />
      {/* ears */}
      <ellipse cx="22" cy="50" rx="5" ry="7" fill={skin} />
      <ellipse cx="78" cy="50" rx="5" ry="7" fill={skin} />

      {/* the wig: three rows of curls, white like a courtroom wig */}
      <g fill={dead ? '#e3e3e3' : '#f7f4ef'}>
        <ellipse cx="50" cy="24" rx="30" ry="15" />
        <circle cx="24" cy="36" r="10" />
        <circle cx="76" cy="36" r="10" />
        <circle cx="20" cy="50" r="9" />
        <circle cx="80" cy="50" r="9" />
        {variant !== 2 && <circle cx="22" cy="62" r="8" />}
        {variant !== 2 && <circle cx="78" cy="62" r="8" />}
        <circle cx="34" cy="18" r="11" />
        <circle cx="50" cy="14" r="12" />
        <circle cx="66" cy="18" r="11" />
      </g>

      {/* eyebrows, thicker on variant 1 for a stern judge */}
      <g stroke={dead ? '#a9a9a9' : '#6b4b35'} strokeWidth={variant === 1 ? 4 : 2.5} strokeLinecap="round">
        <line x1="36" y1={variant === 1 ? 41 : 39} x2="46" y2={variant === 1 ? 39 : 38} />
        <line x1="54" y1={variant === 1 ? 39 : 38} x2="64" y2={variant === 1 ? 41 : 39} />
      </g>

      {/* eyes: closed happy arcs when finished, X when the model failed */}
      {dead ? (
        <g stroke="#7a7a7a" strokeWidth="3" strokeLinecap="round">
          <line x1="37" y1="45" x2="45" y2="53" />
          <line x1="45" y1="45" x2="37" y2="53" />
          <line x1="55" y1="45" x2="63" y2="53" />
          <line x1="63" y1="45" x2="55" y2="53" />
        </g>
      ) : happy ? (
        <g stroke="#3a2a1d" strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M35 50 Q41 43 47 50" />
          <path d="M53 50 Q59 43 65 50" />
        </g>
      ) : (
        <>
          <ellipse cx="41" cy="48" rx="6.5" ry="7" fill="#ffffff" />
          <ellipse cx="59" cy="48" rx="6.5" ry="7" fill="#ffffff" />
          {/* pupils dart around while thinking */}
          <g className="judge-pupils" fill="#2b1d12">
            <circle cx="41" cy="49" r="3.2" />
            <circle cx="59" cy="49" r="3.2" />
          </g>
        </>
      )}

      {/* glasses on variant 0 and 3 */}
      {(variant === 0 || variant === 3) && !dead && (
        <g stroke="#4a4a4a" strokeWidth="2" fill="none" strokeLinecap="round">
          <circle cx="41" cy="48" r="9.5" />
          <circle cx="59" cy="48" r="9.5" />
          <line x1="50.5" y1="48" x2="49.5" y2="48" />
          <line x1="31.5" y1="46" x2="25" y2="44" />
          <line x1="68.5" y1="46" x2="75" y2="44" />
        </g>
      )}

      {/* mouth: opens and closes while the model is writing */}
      <g className="judge-mouth">
        {state === 'speaking' ? (
          <ellipse cx="50" cy="62" rx="7" ry="6" fill="#8c3b3b" />
        ) : happy ? (
          <path d="M42 60 Q50 69 58 60" stroke="#8c3b3b" strokeWidth="3" fill="none" strokeLinecap="round" />
        ) : dead ? (
          <path d="M43 64 Q50 59 57 64" stroke="#7a7a7a" strokeWidth="3" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M44 62 L56 62" stroke="#8c3b3b" strokeWidth="3" fill="none" strokeLinecap="round" />
        )}
      </g>

      {/* big white moustache for variant 2 */}
      {variant === 2 && !dead && (
        <path d="M38 58 Q50 54 62 58 Q50 64 38 58" fill="#f1ece4" />
      )}
    </svg>
  );
}
