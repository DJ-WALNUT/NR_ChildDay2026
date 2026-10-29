import { useId, useRef } from "react";
import type { KeyboardEvent } from "react";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  onDark = false,
}: {
  label: string;
  value: T | null;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  onDark?: boolean;
}) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const selectedIdx = options.findIndex((o) => o.value === value && !o.disabled);
  const tabStop = selectedIdx >= 0 ? selectedIdx : (enabled[0] ?? -1);

  function move(from: number, step: 1 | -1) {
    if (enabled.length === 0) return;
    const pos = enabled.indexOf(from);
    const next = enabled[(pos + step + enabled.length) % enabled.length];
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  function onKeyDown(e: KeyboardEvent, index: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(index, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(index, -1);
    }
  }

  return (
    <div>
      <span id={labelId} className="mb-1 block text-13 font-bold">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {options.map((o, i) => {
          const checked = i === selectedIdx;
          const tone = checked
            ? "border-ink bg-ticket text-ink"
            : onDark
              ? "border-paper bg-transparent text-paper"
              : "border-muted bg-paper-2 text-ink";
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={o.disabled}
              tabIndex={i === tabStop ? 0 : -1}
              onClick={() => !o.disabled && onChange(o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`min-h-11 min-w-16 rounded-md border-2 px-3 text-15 font-bold disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
            >
              {o.label}
              {o.hint && <span className="block text-12 font-medium">{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
