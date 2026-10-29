import { useRef } from "react";
import type { KeyboardEvent } from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({ items, value, onChange }: { items: TabItem[]; value: string; onChange: (id: string) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + items.length) % items.length;
    onChange(items[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-rule-2">
      {items.map((t, i) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`min-h-11 whitespace-nowrap border-b-4 px-3 text-15 ${on ? "border-ticket font-extrabold text-ink" : "border-transparent font-bold text-muted"}`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1 tabular-nums">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
