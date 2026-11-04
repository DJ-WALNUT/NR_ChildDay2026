import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminKeys, listSuperAudit, listSuperOrgs } from "../../api/admin";
import { SelectField } from "../../ui";
import ActivityList from "../ActivityList";

/** 전체 활동 기록. 기관 필터는 여기서 들고, 종류 필터와 더 보기는 ActivityList 가 맡는다. */
export default function ActivityTab() {
  const [orgFilter, setOrgFilter] = useState("");
  const orgsQ = useQuery({ queryKey: adminKeys.superOrgs(), queryFn: listSuperOrgs });
  const orgId = orgFilter ? Number(orgFilter) : undefined;
  const options = [
    { value: "", label: "전체 기관" },
    ...(orgsQ.data ?? []).map((o) => ({ value: String(o.id), label: o.name })),
  ];

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <SelectField label="기관" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} options={options} />
      </div>
      {/* key: 기관이 바뀌면 종류 필터와 불러온 쪽수를 처음부터 다시 시작한다. */}
      <ActivityList
        key={orgFilter}
        queryKey={[...adminKeys.audit("super"), orgId ?? "all"]}
        load={(p) => listSuperAudit({ ...p, org_id: orgId })}
      />
    </div>
  );
}
