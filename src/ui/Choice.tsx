import { useId, useRef } from "react";
import type { KeyboardEvent } from "react";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
  /** 같은 값끼리 한 줄로 묶어 이름을 한 번만 보인다(시간표). 그때 칸에는 short·shortHint 만 보이고 읽을 때는 label·hint 전체를 읽는다. */
  group?: string;
  short?: string;
  shortHint?: string;
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  onDark = false,
  error,
  note,
}: {
  label: string;
  value: T | null;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  onDark?: boolean;
  /** 오류 문구. 라디오 묶음에 aria-invalid/aria-describedby 로 이어져요(읽어주기 알림은 화면이 한 곳에서 맡아요). */
  error?: string;
  /** 제목 줄 오른쪽의 짧은 설명 */
  note?: string;
}) {
  const labelId = useId();
  const errorId = useId();
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

  function cell(o: ChoiceOption<T>, i: number) {
    const checked = i === selectedIdx;
    const grouped = o.group !== undefined;
    const tone = checked
      ? "border-ink bg-ticket text-ink"
      : onDark
        ? "border-paper bg-transparent text-paper"
        : grouped
          ? "border-rule bg-paper-2 text-ink"
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
        aria-label={grouped ? [o.label, o.hint].filter(Boolean).join(" ") : undefined}
        disabled={o.disabled}
        tabIndex={i === tabStop ? 0 : -1}
        onClick={() => !o.disabled && onChange(o.value)}
        onKeyDown={(e) => onKeyDown(e, i)}
        className={`rounded-md border-2 text-15 font-bold disabled:cursor-not-allowed disabled:opacity-50 ${grouped ? "min-h-12 min-w-0 px-0.5" : "min-h-11 min-w-16 px-3"} ${tone}`}
      >
        {grouped ? o.short : o.label}
        {(grouped ? o.shortHint : o.hint) && (
          <span className="block text-12 font-medium tabular-nums">{grouped ? o.shortHint : o.hint}</span>
        )}
      </button>
    );
  }

  const groups = new Map<string, { o: ChoiceOption<T>; i: number }[]>();
  options.forEach((o, i) => {
    if (o.group !== undefined) groups.set(o.group, [...(groups.get(o.group) ?? []), { o, i }]);
  });
  const columns = Math.max(0, ...[...groups.values()].map((g) => g.length));

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span id={labelId} className="block text-13 font-bold">
          {label}
        </span>
        {note && <span className="text-12 text-muted">{note}</span>}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={groups.size > 0 ? "divide-y divide-rule" : "flex flex-wrap gap-2"}
      >
        {groups.size > 0
          ? [...groups].map(([name, cells]) => (
              <div key={name} className="flex items-center gap-2 py-1.5">
                <span aria-hidden className="w-10 shrink-0 text-15 font-extrabold tabular-nums">
                  {name}
                </span>
                <div className="grid min-w-0 flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                  {cells.map(({ o, i }) => cell(o, i))}
                </div>
              </div>
            ))
          : options.map((o, i) => cell(o, i))}
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-13 font-bold">
          {error}
        </p>
      )}
    </div>
  );
}
