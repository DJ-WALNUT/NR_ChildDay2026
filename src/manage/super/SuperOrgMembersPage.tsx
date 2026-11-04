import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useAuth } from "../auth/AuthProvider";
import { MembersPanel } from "../account/MembersPanel";
import { OrgGate } from "./OrgGate";

export default function SuperOrgMembersPage() {
  useDocumentTitle("기관 계정");
  const { orgId = "" } = useParams();
  const { user } = useAuth();
  if (!user) return null; // RequireAuth 안이라 오지 않는다.
  return (
    <OrgGate orgIdParam={orgId}>
      {(org) => (
        <div className="space-y-4">
          <Link to="/manage/super" className="inline-flex min-h-11 items-center gap-1 text-15 font-bold underline">
            <ArrowLeft aria-hidden className="size-4" />
            전체 관리
          </Link>
          <h1 className="text-22 font-extrabold tracking-[-0.03em]">{`${org.name} 계정`}</h1>
          {/* 슈퍼관리자는 기관의 계정 목록에 없으므로 모든 행에 동작 버튼이 나온다. */}
          <MembersPanel orgId={org.id} selfId={user.id} />
        </div>
      )}
    </OrgGate>
  );
}
