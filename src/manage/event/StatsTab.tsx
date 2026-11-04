import { useQuery } from "@tanstack/react-query";
import { adminExport, adminKeys, adminStats, listBooths } from "../../api/admin";
import { messageFor } from "../../api/messages";
import { StatsPanel } from "../../booth/StatsPanel";
import { rosterFileName } from "../../lib/excel";
import { EmptyState, Notice, Spinner } from "../../ui";
import { RefetchNotice } from "../RefetchNotice";
import type { EventTabProps } from "./EventPage";

export default function StatsTab({ event }: EventTabProps) {
  const q = useQuery({ queryKey: adminKeys.booths(event.id), queryFn: () => listBooths(event.id) });

  if (q.isPending) return <Spinner />;
  if (q.isError && !q.data) {
    return (
      <Notice tone="error" action={{ label: "다시 시도", onClick: () => void q.refetch() }}>
        {messageFor(q.error)}
      </Notice>
    );
  }
  // 패널의 선택은 처음 받은 목록으로 정해지므로 부스가 늘거나 줄면 새로 시작한다. 이름만 바뀌어 순서가 달라져도 유지되게 정렬한다.
  const boothIds = q.data.map((b) => b.id).sort((a, b) => a - b);
  return (
    <div className="space-y-4">
      <RefetchNotice queries={[q]} />
      {q.data.length === 0 ? (
        <EmptyState title="아직 부스가 없어요" body="부스 탭에서 부스를 추가하면 실적을 볼 수 있어요." />
      ) : (
        <StatsPanel
          key={`${event.id}:${boothIds.join(",")}`}
          booths={q.data}
          loadStats={adminStats}
          loadExport={adminExport}
          fileName={() => rosterFileName("event", event.name)}
        />
      )}
    </div>
  );
}
