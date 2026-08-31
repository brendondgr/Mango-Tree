import { useId } from "react";

/**
 * One 0–5 criterion: name, range, live value.
 *
 * The row is a container query on itself, not on the viewport: side by side
 * where there is room, and label-over-slider below ~22rem. Laid out inline at
 * every width the range collapsed to about 108px inside a dialog on a 360px
 * screen, which is 21px of travel per half-point step.
 *
 * The 44px grab strip steps down to the dense desktop scale at the shell
 * breakpoint — that one IS a viewport question, since it is about the pointer,
 * not the space. The visible 4px track and the thumb are pseudo-elements
 * styled in styles/imdbspy.css, the one thing utilities cannot reach.
 */
export function CriterionSlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div style={{ containerType: "inline-size" }}>
      <div className="flex flex-wrap items-center gap-x-3">
        <label
          htmlFor={id}
          className="order-1 min-w-0 flex-1 truncate text-sm font-medium capitalize text-foreground @[22rem]:w-28 @[22rem]:flex-none"
        >
          {label}
        </label>
        <output
          htmlFor={id}
          className="order-2 w-8 shrink-0 text-right text-sm font-bold tabular-nums text-primary-emphasis @[22rem]:order-3"
        >
          {value}
        </output>
        <input
          id={id}
          type="range"
          className="imdbspy-range order-3 h-11 w-full app:h-6 @[22rem]:order-2 @[22rem]:w-auto @[22rem]:flex-1"
          min={0}
          max={5}
          step={0.5}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}
