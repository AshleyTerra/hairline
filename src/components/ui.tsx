import type { ReactNode } from "react";

/** Page heading with an optional eyebrow and right-hand slot. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-taupe">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-light text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mutedink">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={`rounded border border-hairline bg-card ${className}`}>{children}</Tag>
  );
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline-soft px-4 py-3">
      <h2 className="text-sm font-semibold text-ink">{children}</h2>
      {right}
    </div>
  );
}

type Tone = "neutral" | "good" | "warn" | "crit" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-chip text-taupe-deep",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  crit: "bg-crit-soft text-crit",
  accent: "bg-taupe text-white",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-10 text-center text-sm text-mutedink">{children}</p>
  );
}

/** Wraps wide content so the page body never scrolls sideways. */
export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}
