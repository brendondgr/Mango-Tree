interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  ariaLabel: string;
}

// Lightweight SVG bar chart (Recharts is not a project dependency).
export function BarChart({ data, ariaLabel }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const width = 100;
  const gap = data.length > 1 ? 100 / (data.length * 1.5) : 0;
  const barWidth = data.length > 0 ? (width - gap * (data.length - 1)) / data.length : 0;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className="h-32 w-full"
    >
      {data.map((point, index) => {
        const height = (point.value / max) * 36;
        const x = index * (barWidth + gap);
        return (
          <rect
            key={point.label + index}
            x={x}
            y={40 - height}
            width={barWidth}
            height={height}
            rx={0.6}
            className="fill-primary"
          >
            <title>{`${point.label}: ${point.value}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
