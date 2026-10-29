import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { getPartner, linkKeys, partnerExport, partnerStats } from "../api/link";
import { messageFor } from "../api/messages";
import { StatsPanel } from "../booth/StatsPanel";
import { rosterFileName } from "../lib/excel";
import { EmptyState, NotFound, Notice, PageFrame, Spinner, Stamp, Stub } from "../ui";

export default function PartnerPage() {
  const { token = "" } = useParams();
  const q = useQuery({ queryKey: [...linkKeys.partner(token)], queryFn: () => getPartner(token) });

  let body;
  if (q.isError && q.error instanceof ApiError && q.error.status === 404) {
    body = <NotFound title="이 링크는 더 이상 쓸 수 없어요." body="담당자에게 새 링크를 받아 주세요." />;
  } else if (q.isError) {
    body = (
      <Notice tone="error" action={{ label: "다시 시도", onClick: () => void q.refetch() }}>
        {messageFor(q.error)}
      </Notice>
    );
  } else if (!q.data) {
    body = <Spinner />;
  } else {
    const { partner, event, org, booths } = q.data;
    body = (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-22 font-extrabold tracking-[-0.03em] break-words">{partner.name}</h1>
          <p className="text-15 break-words">{event.name}</p>
          <p className="text-13 font-bold break-words text-muted">주최: {org.name}</p>
        </header>
        {booths.length === 0 ? (
          <EmptyState title="아직 배정된 부스가 없어요." />
        ) : (
          <>
            <ul aria-label="부스 목록" className="space-y-2">
              {booths.map((b, i) => (
                <li key={b.id}>
                  <Stub
                    number={String(i + 1).padStart(2, "0")}
                    to={`/p/${encodeURIComponent(token)}/booths/${b.id}`}
                    closed={!b.is_active}
                    right={
                      <span className="flex items-center gap-2">
                        <span className="text-13 tabular-nums">{b.count}명</span>
                        {b.is_active ? <Stamp kind="live" /> : <Stamp kind="closed" />}
                      </span>
                    }
                  >
                    <span className="font-bold break-words">{b.name}</span>
                  </Stub>
                </li>
              ))}
            </ul>
            <StatsPanel
              key={token}
              booths={booths}
              loadStats={(ids, mode) => partnerStats(token, { booth_ids: ids, mode })}
              loadExport={(ids) => partnerExport(token, { booth_ids: ids })}
              fileName={() => rosterFileName("partner", event.name, partner.name)}
            />
          </>
        )}
      </div>
    );
  }
  return (
    <PageFrame surface="paper" width="wide">
      {body}
    </PageFrame>
  );
}
