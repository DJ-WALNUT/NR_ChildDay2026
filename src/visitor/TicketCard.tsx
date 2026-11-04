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
  // 체험을 마쳤거나 노쇼인 입장권은 이미 쓰인 표라 노랑을 뺀다.
  const spent = status === "noshow" || status === "completed";
  return (
    <Ticket
      tone={spent ? "muted" : "ticket"}
      header={
        <>
          <TicketHeader eventName={eventName} boothName={boothName} />
          <dl className="mt-4">
            <dt className="text-13 font-bold">입장 시간</dt>
            <dd className="mt-1 text-44 font-extrabold break-words tracking-[-0.03em]">
              {slot === "선착순" ? "선착순 입장" : slot}
            </dd>
          </dl>
        </>
      }
    >
      <div className="flex items-start justify-between gap-3">
        <dl className="min-w-0">
          <dt className="text-13 font-bold text-muted">참가자</dt>
          <dd className="mt-1 text-28 font-extrabold break-words tracking-[-0.03em]">{name}</dd>
        </dl>
        <div className="shrink-0 pt-4">
          <Stamp kind={STAMP[status]} size="lg" />
        </div>
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
