import { ChevronDown, Crown } from 'lucide-react';
import { Mark } from './Judge';
import { colorFor, vendorOf, shortName } from './brand';
import { money } from '../lib/cost';
import { cn } from './ui';

/** One judge's head as a small badge: the cube face with the maker's mark. */
function Head({ model, won, failed }) {
  return (
    <span
      className="relative inline-block"
      title={won ? `${shortName(model)}, ranked best by the other judges` : shortName(model)}
    >
      {won && (
        <Crown
          className="absolute -top-2.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 text-amber-400"
          fill="currentColor"
          strokeWidth={1.5}
        />
      )}
      <svg
        viewBox="-16 -16 32 32"
        width="24"
        height="24"
        className={cn(
          'rounded-[6px] ring-2 ring-[var(--background)]',
          failed && 'opacity-40 grayscale'
        )}
      >
        <rect x="-16" y="-16" width="32" height="32" rx="7" fill={colorFor(model)} />
        <g transform="scale(0.85)">
          <Mark vendor={vendorOf(model)} color="#ffffff" />
        </g>
      </svg>
    </span>
  );
}

/**
 * Once the verdict is in, the whole deliberation folds into this one line.
 * The full arena and every judge's words are behind the toggle.
 */
export default function CouncilStrip({ message, open, onToggle }) {
  const judges = message.stage1 || [];
  const winner = message.metadata?.aggregate_rankings?.[0]?.model;

  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-[var(--radius)] px-1 py-1.5 text-left text-[12.5px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] cursor-pointer"
    >
      <span className="flex items-center gap-1.5 pt-1">
        {judges.map((j) => (
          <Head key={j.model} model={j.model} won={j.model === winner} failed={Boolean(j.error)} />
        ))}
      </span>

      {message.cost > 0 && <span className="font-mono">{money(message.cost)}</span>}

      <span className="ml-auto flex items-center gap-1">
        How they got there
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </span>
    </button>
  );
}
