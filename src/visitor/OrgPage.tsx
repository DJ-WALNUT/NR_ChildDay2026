import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getOrgPage, publicKeys } from "../api/public";
import { EmptyState, PageFrame, Spinner, Stamp, Stub } from "../ui";
import { QueryFailure, VisitorFrame } from "./BrandHeader";

export default function OrgPage() {
  const { slug = "" } = useParams();
  const q = useQuery({ queryKey: publicKeys.org(slug), queryFn: () => getOrgPage(slug) });

  if (q.isError) return <QueryFailure error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) {
    return (
      <PageFrame surface="ink" width="narrow">
        <Spinner />
      </PageFrame>
    );
  }
  const { org, events } = q.data;
  const shown = events.filter((e) => e.booths.length > 0);
  return (
    <VisitorFrame orgName={org.name} orgLogoUrl={org.logo_url}>
      {shown.length === 0 && <EmptyState title="지금 신청을 받는 부스가 없어요." />}
      {shown.map((ev) => (
        <section key={ev.id} aria-label={ev.name} className="space-y-2">
          <h2 className="text-18 font-extrabold break-words">{ev.name}</h2>
          {ev.notice && <p className="text-13 break-words text-rule">{ev.notice}</p>}
          <ul className="space-y-2">
            {ev.booths.map((b, i) => (
              <li key={b.id}>
                <Stub
                  number={String(i + 1).padStart(2, "0")}
                  to={b.is_closed ? undefined : `/${org.slug}/reserve/${b.id}`}
                  closed={b.is_closed}
                  right={b.is_closed ? <Stamp kind="closed" onDark /> : undefined}
                >
                  <span className="block font-bold break-words">{b.name}</span>
                  <span className="block text-13">{b.mode === "time" ? "타임별" : "선착순"}</span>
                </Stub>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </VisitorFrame>
  );
}
