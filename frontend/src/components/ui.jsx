/**
 * Small shared pieces, so every button and card in the app looks the same.
 * Tailwind classes are kept here rather than repeated across components.
 */

export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

const BUTTON_VARIANTS = {
  primary:
    'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90',
  secondary:
    'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--accent)]',
  outline:
    'border border-[var(--border)] bg-transparent hover:bg-[var(--muted)]',
  ghost: 'bg-transparent hover:bg-[var(--muted)]',
  danger: 'bg-transparent text-[var(--danger)] hover:bg-[var(--danger)]/10',
};

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  icon: 'h-8 w-8 p-0',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius)] font-medium',
        'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        'disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]',
        className
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-[var(--border)]',
        'px-2 py-0.5 text-[11px] font-medium text-[var(--muted-foreground)]',
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full rounded-[var(--radius)] border border-[var(--input)] bg-transparent',
        'px-3 py-2 text-sm outline-none transition',
        'placeholder:text-[var(--muted-foreground)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        className
      )}
      {...props}
    />
  );
}

/** Row of model tabs, used by every stage panel. */
export function ModelTabs({ items, activeIndex, onSelect, pendingOf }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <button
          key={item.model}
          onClick={() => onSelect(i)}
          className={cn(
            'rounded-full px-3 py-1 font-mono text-[11.5px] transition-colors cursor-pointer',
            'border',
            activeIndex === i
              ? 'border-[var(--foreground)]/20 bg-[var(--foreground)] text-[var(--background)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]',
            pendingOf?.(item) && 'opacity-50'
          )}
        >
          {item.model.split('/')[1] || item.model}
        </button>
      ))}
    </div>
  );
}

/** A collapsible stage section. */
export function Panel({ step, title, hint, children, right }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] font-mono text-[11px] text-[var(--muted-foreground)]">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {hint && (
            <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
              {hint}
            </p>
          )}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}
