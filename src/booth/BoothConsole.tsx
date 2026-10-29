import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { ApiError } from "../api/client";
import { messageFor } from "../api/messages";
import type { Reservation, ReservationStatus } from "../api/types";
import { downloadBlob } from "../lib/download";
import { buildRosterWorkbook, rosterFileName } from "../lib/excel";
import { Button, ConfirmDialog, Notice, Spinner, Stamp } from "../ui";
import { linksOf } from "./BoothSource";
import type { BoothDetail, BoothSource } from "./BoothSource";
import { QrPanel } from "./QrPanel";
import { RosterList } from "./RosterList";
import { SettingsForm } from "./SettingsForm";
import { StatsTable } from "./StatsTable";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Msg = { tone: "info" | "error" | "warn"; text: string };

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border-2 border-rule bg-paper-2 p-3 text-center">
      <dt className="text-13 font-bold text-muted">{label}</dt>
      <dd className="text-28 font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}

function clock(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function BoothConsole({
  source,
  access,
  extraOwnActions,
  notFound,
}: {
  source: BoothSource;
  access: "own" | "manage";
  extraOwnActions?: ReactNode;
  /** 404 일 때 오류 대신 보여줄 화면 */
  notFound?: ReactNode;
}) {
  const qc = useQueryClient();
  const key = source.key;
  // 상태 변경이 진행 중인 동안에는 자동 갱신·창 포커스 갱신·새로고침을 멈춘다.
  // 서버가 아직 모르는 낙관적 값을 옛 값으로 덮어쓰지 않게 하려는 거예요. 끝나면 onSettled 가 한 번 맞춰요.
  const statusKey = ["booth-status", ...key];
  const busy = useIsMutating({ mutationKey: statusKey }) > 0;
  const q = useQuery({
    queryKey: key,
    queryFn: () => source.get(),
    refetchInterval: busy ? false : 15_000,
    refetchOnWindowFocus: !busy,
  });
  const [msg, setMsg] = useState<Msg | null>(null);
  const [pendingRids, setPendingRids] = useState<ReadonlySet<number>>(new Set());
  const [removed, setRemoved] = useState<{ rid: number } | null>(null);
  const [clearedAt, setClearedAt] = useState(0);
  const rosterHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (clearedAt > 0) rosterHeading.current?.focus();
  }, [clearedAt]);
  const [deleting, setDeleting] = useState<Reservation | null>(null);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const patchDetail = (fn: (d: BoothDetail) => BoothDetail) =>
    qc.setQueryData<BoothDetail>(key, (d) => (d ? fn(d) : d));
  const replaceReservation = (rid: number, change: Partial<Reservation>) =>
    patchDetail((d) => ({ ...d, reservations: d.reservations.map((r) => (r.id === rid ? { ...r, ...change } : r)) }));
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  // 상태 변경: 갱신 요청을 멈추고 → 화면에 먼저 반영 → 실패하면 그 한 건만 되돌림 → 끝나면 서버 값으로 다시 맞춤.
  const status = useMutation({
    mutationKey: statusKey,
    mutationFn: (v: { rid: number; status: ReservationStatus; prev: ReservationStatus }) =>
      source.setStatus(v.rid, v.status),
    onMutate: async (v) => {
      setMsg(null);
      setPendingRids((p) => new Set(p).add(v.rid));
      await qc.cancelQueries({ queryKey: key });
      replaceReservation(v.rid, { status: v.status });
    },
    onSuccess: (res) => {
      replaceReservation(res.reservation.id, res.reservation);
      if (res.over_capacity) setMsg({ tone: "warn", text: "정원을 넘겨 확정됐어요." });
    },
    onError: (err, v) => {
      replaceReservation(v.rid, { status: v.prev });
      setMsg({ tone: "error", text: messageFor(err) });
    },
    onSettled: (_res, _err, v) => {
      setPendingRids((p) => {
        const next = new Set(p);
        next.delete(v.rid);
        return next;
      });
      // 다른 상태 변경이 아직 진행 중이면 마지막 것이 끝날 때 한 번만 맞춘다.
      if (qc.isMutating({ mutationKey: statusKey }) <= 1) void refresh();
    },
  });

  const toggle = useMutation({
    mutationFn: () => source.toggle(),
    onMutate: () => setMsg(null),
    onSuccess: (r) => {
      patchDetail((d) => ({ ...d, booth: { ...d.booth, is_active: r.is_active } }));
      void refresh();
    },
    onError: (err) => setMsg({ tone: "error", text: messageFor(err) }),
  });

  const remove = useMutation({
    mutationFn: (rid: number) => source.deleteReservation(rid),
    onSuccess: (_v, rid) => {
      patchDetail((d) => ({ ...d, reservations: d.reservations.filter((r) => r.id !== rid) }));
      setDeleting(null);
      setRemoved({ rid });
      void refresh();
    },
    onError: (err) => {
      setDeleting(null);
      setMsg({ tone: "error", text: messageFor(err) });
    },
  });

  const clear = useMutation({
    mutationFn: () => source.clear(),
    onSuccess: () => {
      patchDetail((d) => ({ ...d, reservations: [] }));
      setClearing(false);
      setClearedAt((n) => n + 1);
      void refresh();
    },
    onError: (err) => {
      setClearing(false);
      setMsg({ tone: "error", text: messageFor(err) });
    },
  });

  // 404 는 링크가 폐기된 것이라 갱신 중에 와도 안내 화면으로 바꾼다. 그 밖의 갱신 실패는 화면을 지키고 안내만 보인다.
  if (q.isError && notFound && q.error instanceof ApiError && q.error.status === 404) return <>{notFound}</>;
  if (q.isError && !q.data) {
    return (
      <Notice tone="error" action={{ label: "다시 시도", onClick: () => void q.refetch() }}>
        {messageFor(q.error)}
      </Notice>
    );
  }
  if (!q.data) return <Spinner />;

  const { booth, reservations, stats } = q.data;
  const n = (s: ReservationStatus) => reservations.filter((r) => r.status === s).length;
  const applied = reservations.length - n("noshow");

  async function exportXlsx() {
    setExporting(true);
    setMsg(null);
    try {
      const data = await source.exportData();
      const buf = await buildRosterWorkbook(data, stats, { mode: "simple" });
      downloadBlob(buf, rosterFileName("booth", booth.event_name, booth.name), XLSX);
    } catch (err) {
      setMsg({ tone: "error", text: messageFor(err, "엑셀 파일을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.") });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-13 font-bold break-words text-muted">{booth.event_name}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 flex-1 basis-48 text-22 font-extrabold tracking-[-0.03em] break-words">{booth.name}</h1>
          {booth.is_active ? <Stamp kind="live" /> : <Stamp kind="closed" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={booth.is_active ? "secondary" : "primary"}
            loading={toggle.isPending}
            onClick={() => toggle.mutate()}
          >
            {booth.is_active ? "운영 마감" : "운영 시작"}
          </Button>
          <Button variant="ghost" onClick={() => void q.refetch()} loading={q.isFetching} disabled={busy} aria-label="새로고침">
            <RefreshCw aria-hidden className="size-4" />
            새로고침
          </Button>
          <span className="text-13 text-muted tabular-nums">마지막 갱신 {clock(q.dataUpdatedAt)}</span>
        </div>
      </header>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {q.isRefetchError && <Notice tone="warn">최신 정보를 받지 못했어요. 잠시 뒤 다시 갱신해요.</Notice>}

      <dl aria-label="신청 현황" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Count label="신청" value={applied} />
        <Count label="체험완료" value={n("completed")} />
        <Count label="대기" value={n("waiting")} />
        <Count label="노쇼" value={n("noshow")} />
      </dl>

      <StatsTable stats={stats} />

      <section aria-label="명단">
        <h2 ref={rosterHeading} tabIndex={-1} className="mb-2 text-18 font-extrabold tracking-[-0.03em]">
          명단
        </h2>
        <RosterList
          reservations={reservations}
          pending={pendingRids}
          removed={removed}
          fallbackFocus={rosterHeading}
          onStatus={(r, next) => status.mutate({ rid: r.id, status: next, prev: r.status })}
          onDelete={setDeleting}
        />
      </section>

      <SettingsForm
        booth={booth}
        onSave={(s) => source.patch(s)}
        onSaved={(b) => {
          patchDetail((d) => ({ ...d, booth: { ...d.booth, ...b } }));
          void refresh();
        }}
      />

      <section aria-label="내려받기와 초기화" className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={exporting} onClick={() => void exportXlsx()}>
          <Download aria-hidden className="size-4" />
          명단 엑셀
        </Button>
        <Button variant="danger" onClick={() => setClearing(true)} disabled={reservations.length === 0}>
          <Trash2 aria-hidden className="size-4" />
          초기화
        </Button>
      </section>

      <QrPanel boothName={booth.name} links={linksOf(q.data)} />

      {access === "own" && extraOwnActions}

      <ConfirmDialog
        open={deleting !== null}
        title="신청을 삭제할까요?"
        body={deleting ? `${deleting.name}님의 신청이 삭제돼요. 되돌릴 수 없어요.` : ""}
        confirmLabel="삭제"
        danger
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => !remove.isPending && setDeleting(null)}
      />
      <ConfirmDialog
        open={clearing}
        title="명단을 초기화할까요?"
        body={`신청 ${reservations.length}건이 모두 삭제돼요. 되돌릴 수 없어요.`}
        confirmLabel="초기화"
        danger
        busy={clear.isPending}
        onConfirm={() => clear.mutate()}
        onCancel={() => !clear.isPending && setClearing(false)}
      />
    </div>
  );
}
