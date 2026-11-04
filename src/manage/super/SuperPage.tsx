import type { ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { TabPanel, Tabs } from "../../ui";
import ActivityTab from "./ActivityTab";
import OrgsTab from "./OrgsTab";
import SystemTab from "./SystemTab";

const TABS: { id: string; label: string; Component: ComponentType }[] = [
  { id: "orgs", label: "기관", Component: OrgsTab },
  { id: "activity", label: "전체 활동 기록", Component: ActivityTab },
  { id: "system", label: "시스템", Component: SystemTab },
];

export default function SuperPage() {
  useDocumentTitle("전체 관리");
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get("tab")) ?? TABS[0];
  return (
    <div className="space-y-4">
      <h1 className="text-22 font-extrabold tracking-[-0.03em]">전체 관리</h1>
      <Tabs
        idBase="super"
        items={TABS.map(({ id, label }) => ({ id, label }))}
        value={tab.id}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
      />
      <TabPanel idBase="super" id={tab.id}>
        <div className="pt-4">
          <tab.Component />
        </div>
      </TabPanel>
    </div>
  );
}
