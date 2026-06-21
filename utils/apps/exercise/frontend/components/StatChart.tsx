import { useState } from "react";

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
  const [hovered, setHovered] = useState<number | null>(null);

  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] || 0), 0));
  const maxTotal = niceCeil(Math.max(1, ...totals));

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const step = plotW / Math.max(n, 1);
  const barW = Math.min(38, step * 0.6);

  const yFor = (v: number) => PAD.top + plotH - (v / maxTotal) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => +(maxTotal * t).toFixed(maxTotal < 10 ? 1 : 0));
  const labelEvery = n > 14 ? Math.ceil(n / 12) : 1;
  const fmt = formatValue ?? ((v: number) => String(v));

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-72 w-full" preserveAspectRatio="none">
        {/* gridlines + y labels */}
        {ticks.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="exercise-grid" strokeWidth={1} />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" className="exercise-axis-text">
                {fmt(t)}
              </text>
            </g>
          );
        })}

        {/* bars (stacked) */}
        {labels.map((label, i) => {
          const cx = PAD.left + step * i + step / 2;
          let acc = 0;
          const dim = hovered !== null && hovered !== i;
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
              {/* hover hit area */}
              <rect
                x={PAD.left + step * i}
                y={PAD.top}
                width={step}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
              {i % labelEvery === 0 && (
                <text x={cx} y={H - PAD.bottom + 18} textAnchor="middle" className="exercise-axis-text">
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* legend */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
        {series.map((ser) => (
          <div key={ser.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("exercise-dot", ser.colorClass)} />
            {ser.label}
          </div>
        ))}
      </div>

      {/* tooltip */}
      {hovered !== null && (
        <div
          className="exercise-glass pointer-events-none absolute top-2 z-10 rounded-[var(--radius-md)] px-3 py-2 text-xs"
          style={{
            left: `${((PAD.left + step * hovered + step / 2) / W) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="mb-1 font-semibold text-foreground">{labels[hovered]}</p>
          {series.map((ser) => (
            <p key={ser.key} className="flex items-center gap-1.5 text-muted-foreground">
              <span className={cn("exercise-dot", ser.colorClass)} />
              {ser.label}: <span className="font-medium text-foreground">{fmt(ser.values[hovered] || 0)} {unit}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
