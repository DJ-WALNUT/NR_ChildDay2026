import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

const tabId = (idBase: string, id: string) => `${idBase}-tab-${id}`;
const panelId = (idBase: string, id: string) => `${idBase}-panel-${id}`;

export function Tabs({
  items,
  value,
  onChange,
  idBase,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** 있으면 탭과 TabPanel 을 id 로 잇는다(aria-controls·aria-labelledby). */
  idBase?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, i: number) {
    let next: number;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
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
            id={idBase ? tabId(idBase, t.id) : undefined}
            aria-controls={idBase ? panelId(idBase, t.id) : undefined}
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

export function TabPanel({ idBase, id, children }: { idBase: string; id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={panelId(idBase, id)} aria-labelledby={tabId(idBase, id)} tabIndex={0}>
      {children}
    </div>
  );
}
