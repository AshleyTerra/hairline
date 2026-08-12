"use client";

import { useId, useState } from "react";
import { monthLabel, zar0, zarCompact } from "@/lib/format";

/**
 * Chart palette.
 *
 * Single-series charts use the brand taupe as a sequential hue. The one genuine
 * two-series chart (service vs retail) uses a bronze/teal pair validated for
 * colour-vision separation: normal ΔE 24.0, protan ΔE 18.4, chroma >= 0.1.
 */
export const SERIES = {
  primary: "#8a7f6f",
  primaryDeep: "#6e6455",
  service: "#c08428",
  retail: "#0a86a8",
  track: "#edeae4",
  grid: "#e2ded7",
  surface: "#ffffff",
} as const;

const AXIS_TEXT = "#7a7264";

// ------------------------------------------------------------ column chart

interface ColumnDatum {
  label: string;
  value: number;
  emphasis?: boolean;
}

/** Single-series columns: magnitude across discrete periods. */
export function ColumnChart({
  data,
  height = 200,
  format = zarCompact,
  labelEvery = 1,
}: {
  data: ColumnDatum[];
  height?: number;
  format?: (n: number) => string;
  labelEvery?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const clipId = useId();

  const max = Math.max(...data.map((d) => d.value), 1);
  const padTop = 18;
  const padBottom = 24;
  const plot = height - padTop - padBottom;
  const slot = 100 / data.length;
  const barWidth = Math.min(slot * 0.62, 7);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="h-[var(--h)] w-full"
        style={{ ["--h" as string]: `${height}px` }}
        role="img"
        aria-label={`Column chart, ${data.length} periods, highest ${format(max)}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width="100" height={height} />
          </clipPath>
        </defs>

        {/* Recessive gridlines at quarter steps */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1="0"
            x2="100"
            y1={padTop + plot * (1 - f)}
            y2={padTop + plot * (1 - f)}
            stroke={SERIES.grid}
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * plot);
          const x = i * slot + (slot - barWidth) / 2;
          const y = padTop + plot - h;
          const active = hover === i;
          return (
            /* Keyed by slot, not label: a thirteen-month window has two Julys. */
            <g key={i} clipPath={`url(#${clipId})`}>
              {/* 4px rounded data-end, square at the baseline */}
              <path
                d={`M${x},${padTop + plot} L${x},${y + 3} Q${x},${y} ${x + 3},${y} L${x + barWidth - 3},${y} Q${x + barWidth},${y} ${x + barWidth},${y + 3} L${x + barWidth},${padTop + plot} Z`}
                fill={d.emphasis || active ? SERIES.primaryDeep : SERIES.primary}
                opacity={hover === null || active ? 1 : 0.55}
              />
              <rect
                x={i * slot}
                y={padTop}
                width={slot}
                height={plot}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* Axis labels sit in HTML so they never distort with preserveAspectRatio */}
      <div className="flex" aria-hidden="true">
        {data.map((d, i) => (
          <span
            key={i}
            className="min-w-0 flex-1 truncate text-center text-[10px]"
            style={{ color: AXIS_TEXT }}
          >
            {i % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>

      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded border border-hairline bg-card px-2 py-1 text-xs shadow-sm"
          style={{
            left: `${Math.min(80, Math.max(0, hover * slot))}%`,
          }}
        >
          <span className="block font-semibold text-ink">{format(data[hover].value)}</span>
          <span className="block text-[10px] text-mutedink">{data[hover].label}</span>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- month line

/** Area + line for a monthly series, with a crosshair tooltip. */
export function MonthAreaChart({
  data,
  height = 190,
}: {
  data: { ym: string; revenue: number }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId();

  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.revenue), 1);
  const min = 0;
  const padTop = 16;
  const padBottom = 22;
  const plot = height - padTop - padBottom;

  const x = (i: number) => (data.length === 1 ? 50 : (i / (data.length - 1)) * 100);
  const y = (v: number) => padTop + plot - ((v - min) / (max - min)) * plot;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.revenue)}`).join(" ");
  const areaPath = `${linePath} L100,${padTop + plot} L0,${padTop + plot} Z`;
  const last = data.length - 1;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: `${height}px` }}
        role="img"
        aria-label={`Monthly revenue, ${data.length} months, peak ${zarCompact(max)}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES.primary} stopOpacity="0.18" />
            <stop offset="100%" stopColor={SERIES.primary} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0.5, 1].map((f) => (
          <line
            key={f}
            x1="0"
            x2="100"
            y1={padTop + plot * (1 - f)}
            y2={padTop + plot * (1 - f)}
            stroke={SERIES.grid}
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={SERIES.primary}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Crosshair */}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={padTop}
            y2={padTop + plot}
            stroke={SERIES.primaryDeep}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* End marker with a surface ring */}
        <circle
          cx={x(last)}
          cy={y(data[last].revenue)}
          r="4"
          fill={SERIES.primaryDeep}
          stroke={SERIES.surface}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />

        {data.map((d, i) => (
          <rect
            key={d.ym}
            x={i === 0 ? 0 : x(i) - 100 / (data.length - 1) / 2}
            y={padTop}
            width={100 / (data.length - 1)}
            height={plot}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      <div className="flex justify-between px-0.5" aria-hidden="true">
        <span className="text-[10px]" style={{ color: AXIS_TEXT }}>
          {monthLabel(data[0].ym)}
        </span>
        <span className="text-[10px]" style={{ color: AXIS_TEXT }}>
          {monthLabel(data[last].ym)}
        </span>
      </div>

      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded border border-hairline bg-card px-2 py-1 text-xs shadow-sm"
          style={{ left: `${Math.min(78, Math.max(0, x(hover) - 8))}%` }}
        >
          <span className="block font-semibold text-ink">{zar0(data[hover].revenue)}</span>
          <span className="block text-[10px] text-mutedink">{monthLabel(data[hover].ym)}</span>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- ranked bars

/** Horizontal ranked bars — one hue, magnitude by length. */
export function RankedBars({
  data,
  format = zar0,
}: {
  data: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-body">{d.label}</span>
            <span className="tnum shrink-0 text-sm font-semibold text-ink">{format(d.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: SERIES.track }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, background: SERIES.primary }}
            />
          </div>
          {d.hint && <p className="mt-0.5 text-[11px] text-mutedink">{d.hint}</p>}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------- two-series stacks

/**
 * Service vs retail per year. Two identities, so the validated bronze/teal pair
 * plus a legend and a 2px surface gap between the segments.
 */
export function MixBars({
  data,
}: {
  data: { year: number; service: number; retail: number; retailShare: number; partial: boolean }[];
}) {
  const max = Math.max(...data.map((d) => d.service + d.retail), 1);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs">
        {[
          { label: "Services", color: SERIES.service },
          { label: "Retail products", color: SERIES.retail },
        ].map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-body">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            {s.label}
          </span>
        ))}
      </div>

      <ul className="flex flex-col gap-3">
        {data.map((d) => {
          const total = d.service + d.retail;
          const servicePct = (d.service / max) * 100;
          const retailPct = (d.retail / max) * 100;
          return (
            <li key={d.year}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className="tnum font-semibold text-ink">
                  {d.year}
                  {d.partial && <span className="ml-1 font-normal text-mutedink">part year</span>}
                </span>
                <span className="text-mutedink">
                  {zarCompact(total)} · retail {d.retailShare}%
                </span>
              </div>
              <div className="flex h-3 items-stretch" role="img" aria-label={`${d.year}: services ${zar0(d.service)}, retail ${zar0(d.retail)}`}>
                <div
                  className="rounded-l-sm"
                  style={{ width: `${servicePct}%`, background: SERIES.service }}
                />
                {/* 2px surface gap separates the segments */}
                <div className="w-0.5 shrink-0 bg-card" />
                <div
                  className="rounded-r-sm"
                  style={{ width: `${retailPct}%`, background: SERIES.retail }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --------------------------------------------------------------- sparkline

export function Sparkline({
  values,
  width = 120,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke={SERIES.primary}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={x(values.length - 1)}
        cy={y(values[values.length - 1])}
        r="3"
        fill={SERIES.primaryDeep}
        stroke={SERIES.surface}
        strokeWidth="2"
      />
    </svg>
  );
}

// -------------------------------------------------------------- stat tiles

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "crit";
}) {
  const toneClass = {
    neutral: "text-ink",
    good: "text-good",
    warn: "text-warn",
    crit: "text-crit",
  }[tone];

  return (
    <div className="rounded border border-hairline bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.1em] text-mutedink">{label}</p>
      {/* Proportional figures: a display-size number should not be tabular */}
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-mutedink">{hint}</p>}
    </div>
  );
}

/** Meter: fill carries severity, track is a lighter step of the same ramp. */
export function Meter({
  value,
  target,
  tone = "primary",
}: {
  value: number;
  target: number;
  tone?: "primary" | "good" | "warn";
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const fill = { primary: SERIES.primary, good: "#4c7a5a", warn: "#a8762a" }[tone];
  return (
    <div
      className="h-2 overflow-hidden rounded-full"
      style={{ background: SERIES.track }}
      role="img"
      aria-label={`${Math.round(pct)}% of target`}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
    </div>
  );
}
