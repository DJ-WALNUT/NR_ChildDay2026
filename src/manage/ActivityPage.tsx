import { adminKeys, listAudit } from "../api/admin";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import ActivityList from "./ActivityList";
import { useOrg } from "./auth/guards";

export default function ActivityPage() {
  useDocumentTitle("활동 기록");
  const org = useOrg();
  return (
    <div className="space-y-4">
      <h1 className="text-22 font-extrabold tracking-[-0.03em]">활동 기록</h1>
      <ActivityList queryKey={[...adminKeys.audit(org.id)]} load={(p) => listAudit(org.id, p)} />
    </div>
  );
}
