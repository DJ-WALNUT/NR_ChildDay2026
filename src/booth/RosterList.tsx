import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Reservation, ReservationStatus } from "../api/types";
import { compareSlots } from "../lib/slots";
import { Button, EmptyState, Stamp } from "../ui";

type Action = { label: string; status: ReservationStatus };

function actionsFor(status: ReservationStatus): Action[] {
  switch (status) {
    case "normal":
      return [
        { label: "체험완료", status: "completed" },
        { label: "노쇼", status: "noshow" },
      ];
    case "waiting":
      return [
        { label: "확정", status: "normal" },
        { label: "노쇼", status: "noshow" },
      ];
    default:
      return [{ label: "되돌리기", status: "normal" }];
  }
}

const STAMP = { waiting: "wait", noshow: "noshow", completed: "done" } as const;

function groupBySlot(rows: Reservation[]): { slot: string; rows: Reservation[] }[] {
  const map = new Map<string, Reservation[]>();
  for (const r of rows) map.set(r.slot, [...(map.get(r.slot) ?? []), r]);
  return [...map.entries()]
    .sort(([a], [b]) => compareSlots(a, b))
    .map(([slot, list]) => ({ slot, rows: list }));
}

export function RosterList({
  reservations,
  onStatus,
  onDelete,
}: {
  reservations: Reservation[];
  onStatus: (r: Reservation, status: ReservationStatus) => void;
  onDelete: (r: Reservation) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const shown = useMemo(
    () => (q ? reservations.filter((r) => r.name.includes(q) || r.code.includes(q)) : reservations),
    [reservations, q],
  );
  const groups = useMemo(() => groupBySlot(shown), [shown]);

  if (reservations.length === 0) return <EmptyState title="아직 신청이 없어요." />;

  return (
    <div>
      <label htmlFor="roster-search" className="mb-1 block text-13 font-bold">
        이름·식별번호 검색
      </label>
      <input
        id="roster-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        className="h-11 w-full rounded-md border-2 border-muted bg-paper-2 px-3 text-15 text-ink focus:border-ink"
      />
      {groups.length === 0 && <EmptyState title="찾는 신청이 없어요." />}
      {groups.map((g) => (
        <section key={g.slot} aria-label={g.slot || "전체"} className="mt-4">
          <h3 className="flex items-baseline justify-between border-b-2 border-ink pb-1 text-15 font-extrabold">
            <span className="break-words">{g.slot || "전체"}</span>
            <span className="text-13 tabular-nums">{g.rows.length}명</span>
          </h3>
          <ul>
            {g.rows.map((r) => (
              <li
                key={r.id}
                aria-label={r.name}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule-2 py-2"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-15 font-bold break-words">
                    {r.name} {r.status !== "normal" && <Stamp kind={STAMP[r.status]} />}
                  </p>
                  <p className="text-13 text-muted tabular-nums">
                    {r.code} · {r.gender} · {r.age_group}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {actionsFor(r.status).map((a) => (
                    <Button
                      key={a.label}
                      variant={a.label === "되돌리기" ? "secondary" : "primary"}
                      aria-label={`${r.name} ${a.label}`}
                      className="min-w-16 px-3"
                      onClick={() => onStatus(r, a.status)}
                    >
                      {a.label}
                    </Button>
                  ))}
                  <Button variant="ghost" aria-label={`${r.name} 삭제`} className="px-3" onClick={() => onDelete(r)}>
                    <Trash2 aria-hidden className="size-4" />
                    삭제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
