import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useAuth } from "../auth/AuthProvider";
import { useOrg } from "../auth/guards";
import { MembersPanel } from "./MembersPanel";

export default function MembersPage() {
  useDocumentTitle("기관 계정");
  const { user } = useAuth();
  const org = useOrg();
  if (!user) return null; // RequireAuth 안이라 오지 않는다.
  return (
    <div className="space-y-4">
      <h1 className="text-22 font-extrabold tracking-[-0.03em]">기관 계정</h1>
      <MembersPanel orgId={org.id} selfId={user.id} />
    </div>
  );
}
