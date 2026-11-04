import { useEffect } from "react";
import { removeOrgLogo, uploadOrgLogo } from "../api/admin";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useAuth } from "./auth/AuthProvider";
import { useOrg } from "./auth/guards";
import LogoField from "./LogoField";

export default function OrgPage() {
  useDocumentTitle("기관 설정");
  const org = useOrg();
  const { refresh } = useAuth();
  // 슈퍼관리자가 슬러그를 바꿔도 세션의 기관 정보는 그대로다. 주소를 보여 주는 화면이니 열 때 새로 받는다.
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <div className="space-y-6">
      <h1 className="text-22 font-extrabold tracking-[-0.03em]">기관 설정</h1>
      <dl className="space-y-3">
        <div>
          <dt className="text-13 font-bold">기관 이름</dt>
          <dd className="text-15">{org.name}</dd>
        </div>
        <div>
          <dt className="text-13 font-bold">기관 주소</dt>
          <dd className="break-all text-15">{`${window.location.origin}/${org.slug}`}</dd>
        </div>
      </dl>
      <LogoField
        label="기관 로고"
        logoUrl={org.logo_url}
        upload={(file) => uploadOrgLogo(org.id, file)}
        remove={() => removeOrgLogo(org.id)}
        onChanged={() => void refresh()}
      />
    </div>
  );
}
