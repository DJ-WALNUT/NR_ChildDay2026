import type { ComponentType } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { adminKeys, getEvent } from "../../api/admin";
import { ApiError } from "../../api/client";
import { messageFor } from "../../api/messages";
import type { AdminEvent, SessionOrg } from "../../api/types";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { EmptyState, NotFound, Notice, Spinner, TabPanel, Tabs } from "../../ui";
import { useAuth } from "../auth/AuthProvider";
import { orgHomePath } from "../paths";
import BoothsTab from "./BoothsTab";

/** 탭 내용이 받는 값. org 는 getEvent 응답의 소유 기관이다(로그인 계정의 기관이 아니다). */
export interface EventTabProps {
  event: AdminEvent;
  org: SessionOrg;
}

// 운영 단체·실적·링크·설정 탭은 이후 태스크가 채운다.
const NotReady: ComponentType<EventTabProps> = () => <EmptyState title="준비 중이에요" />;

const TABS: { id: string; label: string; Component: ComponentType<EventTabProps> }[] = [
  { id: "booths", label: "부스", Component: BoothsTab },
  { id: "partners", label: "운영 단체", Component: NotReady },
  { id: "stats", label: "실적", Component: NotReady },
  { id: "links", label: "링크", Component: NotReady },
  { id: "settings", label: "설정", Component: NotReady },
];

export default function EventPage() {
  const { eventId = "" } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  // 키와 요청 모두 숫자 id 로 맞춘다. 탭에서 adminKeys.event(event.id) 로 무효화하기 때문이다.
  const id = /^[0-9]+$/.test(eventId) ? Number(eventId) : null;
  const q = useQuery({
    queryKey: adminKeys.event(id ?? 0),
    queryFn: () => getEvent(id ?? 0),
    enabled: id !== null,
  });
  useDocumentTitle(q.data?.event.name);

  if (id === null) return <NotFound />;
  if (q.isPending) return <Spinner />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) return <NotFound />;
    return (
      <Notice tone="error" action={{ label: "다시 시도", onClick: () => void q.refetch() }}>
        {messageFor(q.error)}
      </Notice>
    );
  }

  const { event, org } = q.data;
  const tab = TABS.find((t) => t.id === params.get("tab")) ?? TABS[0];
  const home = user ? orgHomePath(user, org.id) : "/manage";

  return (
    <div className="space-y-4">
      <Link to={home} className="inline-flex min-h-11 items-center gap-1 text-15 font-bold underline">
        <ArrowLeft aria-hidden className="size-4" />
        돌아가기
      </Link>
      <div>
        <p className="text-13 text-muted">{org.name}</p>
        <h1 className="text-22 font-extrabold tracking-[-0.03em]">{event.name}</h1>
      </div>
      <Tabs
        idBase="event"
        items={TABS.map(({ id, label }) => ({ id, label }))}
        value={tab.id}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
      />
      <TabPanel idBase="event" id={tab.id}>
        <div className="pt-4">
          <tab.Component event={event} org={org} />
        </div>
      </TabPanel>
    </div>
  );
}
