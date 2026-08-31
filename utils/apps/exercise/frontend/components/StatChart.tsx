import { useId, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";
import type { Series } from "@exercise/utils/stats";

interface StatChartProps {
  labels: string[];
  series: Series[];
  unit: string;
  formatValue?: (value: number) => string;
}

const W = 760;
const H = 320;
const PAD = { top: 16, right: 16, bottom: 34, left: 44 };

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const f = value / pow;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * pow;
}

export function StatChart({ labels, series, unit, formatValue }: StatChartProps) {
  // A single index drives both the pointer hover and the keyboard cursor, so
  // both paths surface exactly the same read-out. Previously the per-period
  // values were reachable only by hovering an invisible SVG rect.
  const [active, setActive] = useState<number | null>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  const n = labels.length;
  const totals = labels.map((_, i) =>
    series.reduce((s, ser) => s + (ser.values[i] || 0), 0),
  );
  const maxTotal = niceCeil(Math.max(1, ...totals));

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const step = plotW / Math.max(n, 1);
  const barW = Math.min(38, step * 0.6);

  const yFor = (v: number) => PAD.top + plotH - (v / maxTotal) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(
    (t) => +(maxTotal * t).toFixed(maxTotal < 10 ? 1 : 0),
  );
  const labelEvery = n > 14 ? Math.ceil(n / 12) : 1;
  const fmt = formatValue ?? ((v: number) => String(v));

  const describe = (i: number) =>
    `${labels[i]}: ${series
      .map((ser) => `${ser.label} ${fmt(ser.values[i] || 0)} ${unit}`)
      .join(", ")}`;

  /** Move the cursor and keep the selected period inside the scrolled view. */
  const cursorTo = (index: number) => {
    setActive(index);
    const region = regionRef.current;
    if (!region) return;
    const centre =
      ((PAD.left + step * index + step / 2) / W) * region.scrollWidth;
    region.scrollLeft = Math.max(0, centre - region.clientWidth / 2);
  };

  // Arrow keys walk the periods. One large focusable region rather than n tiny
  // hit targets, which keeps every target well clear of the size floor however
  // many buckets the range produces — and moving the cursor scrolls the region,
  // so the keyboard can reach the far end of a wide chart.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return;
    const current = active ?? -1;
    let next: number;
    if (event.key === "ArrowRight") next = Math.min(n - 1, current + 1);
    else if (event.key === "ArrowLeft") next = current <= 0 ? 0 : current - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = n - 1;
    else if (event.key === "Escape") {
      if (active === null) return;
      setActive(null);
      event.preventDefault();
      return;
    } else return;

    event.preventDefault();
    cursorTo(next);
  };

  const readout = active === null ? null : describe(active);

  return (
    <div className="flex flex-col gap-2">
      {/* The chart keeps its aspect ratio rather than being squashed flat in a
          narrow pane; the region scrolls, and it is focusable so it is both
          keyboard-scrollable and keyboard-readable. */}
      <div
        ref={regionRef}
        className="scroll-region -mx-1 rounded-[var(--radius-md)] px-1"
        tabIndex={0}
        role="group"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <p id={descId} className="sr-only">
          Use the left and right arrow keys to step through each period.
        </p>
        <div className="relative min-w-[32rem]">
          {/* The rendered box is given the viewBox's own ratio and the default
              `xMidYMid meet` scaling is kept, so x and y scale by the same
              factor. Stretching them independently (`preserveAspectRatio
              ="none"`) distorted every label — squashed in a narrow pane,
              stretched in a wide one — and turned the rounded bar corners into
              ellipses. */}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block h-auto w-full"
            style={{ aspectRatio: `${W} / ${H}` }}
            aria-hidden
          >
            {/* gridlines + y labels */}
            {ticks.map((t, i) => {
              const y = yFor(t);
              return (
                <g key={i}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={y}
                    y2={y}
                    className="exercise-grid"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="exercise-axis-text"
                  >
                    {fmt(t)}
                  </text>
                </g>
              );
            })}

            {/* bars (stacked) */}
            {labels.map((label, i) => {
              const cx = PAD.left + step * i + step / 2;
              let acc = 0;
              const dim = active !== null && active !== i;
              return (
                <g key={label + i}>
                  {series.map((ser) => {
                    const v = ser.values[i] || 0;
                    if (v <= 0) return null;
                    const h = (v / maxTotal) * plotH;
                    const y = yFor(acc + v);
                    acc += v;
                    return (
                      <rect
                        key={ser.key}
                        x={cx - barW / 2}
                        y={y}
                        width={barW}
                        height={Math.max(h, 0)}
                        rx={3}
                        className={cn("exercise-bar", ser.colorClass)}
                        style={{ opacity: dim ? 0.35 : 1 }}
                      />
                    );
                  })}
                  {/* pointer hit area */}
                  <rect
                    x={PAD.left + step * i}
                    y={PAD.top}
                    width={step}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive((c) => (c === i ? null : c))}
                  />
                  {i % labelEvery === 0 && (
                    <text
                      x={cx}
                      y={H - PAD.bottom + 18}
                      textAnchor="middle"
                      className="exercise-axis-text"
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* read-out */}
          {active !== null && (
            <div
              className={cn(
                "pointer-events-none absolute top-2 z-[var(--z-header)] w-56",
                "rounded-[var(--radius-md)] border border-border bg-popover px-3 py-2",
                "text-xs text-popover-foreground shadow-md",
              )}
              style={{
                left: `clamp(0px, calc(${(
                  ((PAD.left + step * active + step / 2) / W) *
                  100
                ).toFixed(2)}% - 7rem), calc(100% - 14rem))`,
              }}
            >
              <p className="mb-1 font-semibold text-foreground">
                {labels[active]}
              </p>
              {series.map((ser) => (
                <p
                  key={ser.key}
                  className="flex items-center gap-1.5 text-muted-foreground"
                >
                  <span className={cn("exercise-dot", ser.colorClass)} />
                  {ser.label}:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {fmt(ser.values[active] || 0)} {unit}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Announced to assistive technology as the keyboard cursor moves. */}
      <p className="sr-only" role="status" aria-live="polite">
        {readout}
      </p>

      {/* legend */}
      <ul
        id={titleId}
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5"
      >
        <li className="sr-only">{`Chart of totals per period in ${unit}`}</li>
        {series.map((ser) => (
          <li
            key={ser.key}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span className={cn("exercise-dot", ser.colorClass)} />
            {ser.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
