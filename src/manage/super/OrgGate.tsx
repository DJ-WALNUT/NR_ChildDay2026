import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminKeys, listSuperOrgs } from "../../api/admin";
import { messageFor } from "../../api/messages";
import type { SuperOrg } from "../../api/types";
import { NotFound, Notice, Spinner } from "../../ui";
import { RefetchNotice } from "../RefetchNotice";

/**
 * 주소의 :orgId 로 기관을 찾아 children 에 넘긴다. 숫자가 아니면 요청 없이 NotFound,
 * 기관 목록(listSuperOrgs)에 없어도 NotFound 다.
 */
export function OrgGate({ orgIdParam, children }: { orgIdParam: string; children: (org: SuperOrg) => ReactNode }) {
  const id = /^[0-9]+$/.test(orgIdParam) ? Number(orgIdParam) : null;
  const q = useQuery({ queryKey: adminKeys.superOrgs(), queryFn: listSuperOrgs, enabled: id !== null });

  if (id === null) return <NotFound />;
  if (q.isPending) return <Spinner />;
  if (q.isError && !q.data) {
    return (
      <Notice tone="error" action={{ label: "다시 시도", onClick: () => void q.refetch() }}>
        {messageFor(q.error)}
      </Notice>
    );
  }
  const org = q.data.find((o) => o.id === id);
  if (!org) return <NotFound />;
  return (
    <div className="space-y-4">
      <RefetchNotice queries={[q]} />
      {children(org)}
    </div>
  );
}
