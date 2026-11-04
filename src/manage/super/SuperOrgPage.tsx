import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { DashboardBody } from "../DashboardPage";
import { OrgGate } from "./OrgGate";

/** 슈퍼관리자가 보는 기관별 대시보드. 본문은 기관 대시보드를 그대로 쓴다. */
export default function SuperOrgPage() {
  const { orgId = "" } = useParams();
  return (
    <OrgGate orgIdParam={orgId}>
      {(org) => (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-6">
            <Link to="/manage/super" className="inline-flex min-h-11 items-center gap-1 text-15 font-bold underline">
              <ArrowLeft aria-hidden className="size-4" />
              전체 관리
            </Link>
            <Link to={`/manage/super/orgs/${org.id}/members`} className="inline-flex min-h-11 items-center text-15 font-bold underline">
              계정 관리
            </Link>
          </div>
          <DashboardBody orgId={org.id} title={org.name} />
        </div>
      )}
    </OrgGate>
  );
}
