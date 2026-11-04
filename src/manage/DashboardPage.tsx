import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys, createEvent, getOverview } from "../api/admin";
import { fieldErrors, messageFor } from "../api/messages";
import type { Booth, Overview } from "../api/types";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, DataTable, EmptyState, Notice, Spinner, TextField, type Column } from "../ui";
import { useOrg } from "./auth/guards";
import { RefetchNotice } from "./RefetchNotice";

const running = (booths: Booth[]) => booths.filter((b) => b.is_active).length;

type Owned = Overview["owned"][number];
type Linked = Overview["linked"][number];

const OWNED_COLUMNS: Column<Owned>[] = [
  {
    key: "event",
    header: "행사", wrap: true,
    render: (r) => (
      <Link to={`/manage/events/${r.event.id}`} className="inline-flex min-h-11 items-center font-bold underline">
        {r.event.name}
      </Link>
    ),
  },
  {
    key: "booths",
    header: "부스",
    numeric: true,
    render: (r) => `운영 중 ${running(r.booths)} / 전체 ${r.booths.length}`,
  },
];

// 이 표로 들어갈 곳은 부스다. 좁은 화면에서 밀지 않아도 보이게 첫 칸에 둔다.
const LINKED_COLUMNS: Column<Linked>[] = [
  {
    key: "booths",
    header: "부스", wrap: true,
    render: (r) => (
      <ul>
        {r.booths.map((b) => (
          <li key={b.id}>
            <Link to={`/manage/booths/${b.id}`} className="inline-flex min-h-11 items-center underline">
              {b.name}
            </Link>
          </li>
        ))}
      </ul>
    ),
  },
  {
    key: "event",
    header: "행사",
    wrap: true,
    render: (r) => (
      <>
        <span className="block">{r.event.name}</span>
        <span className="block text-13 text-muted">{`${r.host.name} · ${r.partner.name}`}</span>
      </>
    ),
  },
];

function NewEventForm({ orgId }: { orgId: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneral(null);
    setBusy(true);
    try {
      const event = await createEvent(orgId, name.trim());
      void queryClient.invalidateQueries({ queryKey: adminKeys.overview(orgId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.events(orgId) });
      navigate(`/manage/events/${event.id}`);
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (Object.keys(fields).length === 0) setGeneral(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {general && <Notice tone="error">{general}</Notice>}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-60 flex-1">
          <TextField label="행사 이름" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        </div>
        <Button type="submit" loading={busy} className="mt-6">
          행사 만들기
        </Button>
      </div>
    </form>
  );
}

/** 대시보드 본문. 내 기관 대시보드와 슈퍼관리자의 기관별 화면이 함께 쓴다. */
export function DashboardBody({ orgId, title = "대시보드" }: { orgId: number; title?: string }) {
  useDocumentTitle(title);
  const q = useQuery({ queryKey: adminKeys.overview(orgId), queryFn: () => getOverview(orgId) });

  let body;
  if (q.isPending) {
    body = <Spinner />;
  } else if (q.isError && !q.data) {
    body = (
      <Notice tone="error" action={{ label: "다시 시도", onClick: () => void q.refetch() }}>
        {messageFor(q.error)}
      </Notice>
    );
  } else {
    const { owned, linked, totals, org } = q.data;
    const totalItems = [
      ["오늘 신청", totals.today],
      ["전체 신청", totals.total],
      ["운영 중 부스", totals.active_booths],
      ["전체 부스", totals.booths],
    ] as const;
    body = (
      <>
        <p className="text-13 text-muted">{org.name}</p>
        <RefetchNotice queries={[q]} />
        <dl className="flex flex-wrap gap-x-8 gap-y-2 border-y border-rule-2 py-3">
          {totalItems.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-2">
              <dt className="text-13 text-muted">{label}</dt>
              <dd className="text-18 font-extrabold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <section className="space-y-3">
          <h2 className="text-18 font-extrabold tracking-[-0.03em]">내 행사</h2>
          <DataTable
            caption="내 행사"
            columns={OWNED_COLUMNS}
            rows={owned}
            rowKey={(r) => String(r.event.id)}
            empty={<EmptyState title="아직 행사가 없어요" body="아래에서 첫 행사를 만들어 보세요." />}
          />
          <NewEventForm orgId={orgId} />
        </section>
        {linked.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-18 font-extrabold tracking-[-0.03em]">참가한 연합 행사</h2>
            <DataTable
              caption="참가한 연합 행사"
              columns={LINKED_COLUMNS}
              rows={linked}
              rowKey={(r) => `${r.event.id}-${r.partner.id}`}
            />
          </section>
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-22 font-extrabold tracking-[-0.03em]">{title}</h1>
      {body}
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardBody orgId={useOrg().id} />;
}
