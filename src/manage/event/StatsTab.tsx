import { useQuery } from "@tanstack/react-query";
import { adminExport, adminKeys, adminStats, listBooths } from "../../api/admin";
import { messageFor } from "../../api/messages";
import { StatsPanel } from "../../booth/StatsPanel";
import { rosterFileName } from "../../lib/excel";
import { EmptyState, Notice, Spinner } from "../../ui";
import type { EventTabProps } from "./EventPage";

export default function StatsTab({ event }: EventTabProps) {
  const q = useQuery({ queryKey: adminKeys.booths(event.id), queryFn: () => listBooths(event.id) });

  if (q.isPending) return <Spinner />;
  if (q.isError) {
    return (
      <Notice tone="error" action={{ label: "다시 시도", onClick: () => void q.refetch() }}>
        {messageFor(q.error)}
      </Notice>
    );
  }
  if (q.data.length === 0) {
    return <EmptyState title="아직 부스가 없어요" body="부스 탭에서 부스를 추가하면 실적을 볼 수 있어요." />;
  }
  return (
    <StatsPanel
      key={event.id}
      booths={q.data}
      loadStats={adminStats}
      loadExport={adminExport}
      fileName={() => rosterFileName("event", event.name)}
    />
  );
}
