import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
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

const STATUS_LABEL: Record<ReservationStatus, string> = {
  normal: "입장 가능",
  waiting: "대기",
  noshow: "노쇼",
  completed: "체험완료",
};

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
  pending,
  removed,
  fallbackFocus,
  onStatus,
  onDelete,
}: {
  reservations: Reservation[];
  /** 서버 응답을 기다리는 신청 번호. 그 행의 버튼은 잠긴다. */
  pending: ReadonlySet<number>;
  /** 방금 삭제된 신청. 포커스를 이웃 행으로 옮기는 신호(객체가 바뀔 때마다 한 번). */
  removed: { rid: number } | null;
  /** 옮길 행이 없을 때 포커스를 받을 곳(명단 제목) */
  fallbackFocus: RefObject<HTMLElement | null>;
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
  const flat = useMemo(() => groups.flatMap((g) => g.rows.map((r) => r.id)), [groups]);

  // 행 이름표(li)가 포커스를 받는다: 눌렀던 버튼은 상태가 바뀌면 사라지기 때문이다.
  const rowEls = useRef(new Map<number, HTMLLIElement>());
  const focusRid = useRef<number | null>(null);
  const prevFlat = useRef<number[]>([]);
  useEffect(() => {
    if (focusRid.current === null) return;
    const el = rowEls.current.get(focusRid.current);
    if (el) {
      el.focus();
      focusRid.current = null;
    }
  });
  useEffect(() => {
    if (!removed) return;
    const at = prevFlat.current.indexOf(removed.rid);
    const target = flat[at] ?? flat[at - 1]; // 다음 행, 없으면 이전 행
    const el = target === undefined ? undefined : rowEls.current.get(target);
    (el ?? fallbackFocus.current)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removed]);
  useEffect(() => {
    prevFlat.current = flat;
  });

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
                ref={(el) => {
                  if (el) rowEls.current.set(r.id, el);
                  else rowEls.current.delete(r.id);
                }}
                tabIndex={-1}
                aria-label={`${r.name} ${STATUS_LABEL[r.status]}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule-2 py-2 outline-offset-2"
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
                      disabled={pending.has(r.id)}
                      onClick={() => {
                        focusRid.current = r.id;
                        onStatus(r, a.status);
                      }}
                    >
                      {a.label}
                    </Button>
                  ))}
                  <Button variant="ghost" aria-label={`${r.name} 삭제`} className="px-3" disabled={pending.has(r.id)} onClick={() => onDelete(r)}>
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
