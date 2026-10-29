import type { ReservationStatus } from "../api/types";
import { Button, Stamp, Ticket } from "../ui";
import type { StampKind } from "../ui";

const STAMP: Record<ReservationStatus, StampKind> = {
  normal: "ok",
  waiting: "wait",
  noshow: "noshow",
  completed: "done",
};

export function TicketHeader({ eventName, boothName }: { eventName: string; boothName: string }) {
  return (
    <>
      <p className="text-13 font-bold break-words">체험부스 입장권 · {eventName}</p>
      <h1 tabIndex={-1} className="mt-1 text-22 font-extrabold break-words tracking-[-0.03em]">{boothName}</h1>
    </>
  );
}

export function TicketCard({
  eventName,
  boothName,
  name,
  slot,
  status,
  notice,
  onCancel,
  onForget,
}: {
  eventName: string;
  boothName: string;
  name: string;
  slot: string;
  status: ReservationStatus;
  notice?: string | null;
  onCancel?: () => void;
  onForget?: () => void;
}) {
  const cancelable = onCancel && (status === "normal" || status === "waiting");
  return (
    <Ticket header={<TicketHeader eventName={eventName} boothName={boothName} />}>
      <dl className="space-y-2 text-15">
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 text-13 font-bold text-muted">참가자</dt>
          <dd className="min-w-0 break-words font-bold">{name}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 text-13 font-bold text-muted">입장 시간</dt>
          <dd className="min-w-0 font-bold tabular-nums">{slot === "선착순" ? "선착순 입장" : slot}</dd>
        </div>
      </dl>
      <div className="mt-4 flex justify-end">
        <Stamp kind={STAMP[status]} />
      </div>
      {notice && <p className="mt-3 text-13 break-words whitespace-pre-line text-muted">{notice}</p>}
      {(cancelable || onForget) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {cancelable && (
            <Button variant="secondary" onClick={onCancel}>
              신청 취소
            </Button>
          )}
          {onForget && (
            <Button variant="ghost" onClick={onForget}>
              이 기기에서 지우기
            </Button>
          )}
        </div>
      )}
    </Ticket>
  );
}
