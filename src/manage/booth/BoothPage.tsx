import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { Booth, SessionOrg, SessionUser } from "../../api/types";
import { adminBoothSource } from "../../booth/adminSource";
import type { BoothAccess } from "../../booth/BoothSource";
import BoothConsole from "../../booth/BoothConsole";
import { NotFound } from "../../ui";
import { useAuth } from "../auth/AuthProvider";
import { OwnerActions } from "./OwnerActions";

/** 내 기관 부스이거나 슈퍼관리자면 own, 연결 기관으로 들어온 부스는 manage. */
// eslint-disable-next-line react-refresh/only-export-components
export function boothAccess(booth: Booth, user: SessionUser, org: SessionOrg | null): BoothAccess {
  return booth.org_id === org?.id || user.is_superadmin ? "own" : "manage";
}

export default function BoothPage() {
  const { boothId = "" } = useParams();
  const { user, org } = useAuth();
  // 키와 요청 모두 숫자 id 로 맞춘다. 행사 화면에서 adminKeys 로 무효화하기 때문이다.
  const id = /^[0-9]+$/.test(boothId) ? Number(boothId) : null;
  const source = useMemo(() => (id === null ? null : adminBoothSource(id)), [id]);

  if (!source || !user) return <NotFound />;
  return (
    <BoothConsole
      source={source}
      access={(d) => boothAccess(d.booth, user, org)}
      notFound={<NotFound />}
      header={(d) => {
        const own = boothAccess(d.booth, user, org) === "own";
        return (
          <Link
            to={own ? `/manage/events/${d.booth.event_id}` : "/manage"}
            className="inline-flex min-h-11 items-center gap-1 text-15 font-bold underline"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {own ? "행사로 돌아가기" : "내 대시보드로 돌아가기"}
          </Link>
        );
      }}
      extraOwnActions={(d) => <OwnerActions booth={d.booth} source={source} />}
    />
  );
}
