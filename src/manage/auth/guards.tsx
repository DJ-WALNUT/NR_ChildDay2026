import { createContext, useContext, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { SessionOrg } from "../../api/types";
import { NotFound, Notice, PageFrame, Spinner } from "../../ui";
import { LOGIN_PATH, loginUrl, useAuth } from "./AuthProvider";

export const PASSWORD_PATH = "/manage/password";

const OrgContext = createContext<SessionOrg | null>(null);

/** 로그인 계정의 기관. RequireOrg 안에서만 쓴다. 행사·부스 화면은 응답의 org 를 쓴다. */
// eslint-disable-next-line react-refresh/only-export-components
export function useOrg(): SessionOrg {
  const org = useContext(OrgContext);
  if (!org) throw new Error("useOrg must be used inside <RequireOrg>");
  return org;
}

function Waiting({ children }: { children: ReactNode }) {
  return (
    <PageFrame surface="paper-2" width="narrow">
      <main>{children}</main>
    </PageFrame>
  );
}

/** 로그인한 사용자만 통과한다. 임시 비밀번호 사용자는 비밀번호 변경 화면에 머문다. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, failed, signedOut, refresh } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <Waiting>
        <Spinner />
      </Waiting>
    );
  }
  if (!user) {
    // 401 이 아니라 확인 자체가 실패했으면 로그아웃된 것으로 보지 않는다.
    if (failed) {
      return (
        <Waiting>
          <h1 className="mb-3 text-22 font-extrabold tracking-[-0.03em]">연결을 확인하지 못했어요</h1>
          <Notice tone="error" action={{ label: "다시 시도", onClick: () => void refresh() }}>
            로그인 상태를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.
          </Notice>
        </Waiting>
      );
    }
    if (signedOut) return <Navigate to={LOGIN_PATH} replace />;
    return <Navigate to={loginUrl(location.pathname + location.search)} replace />;
  }
  if (user.must_change_password && location.pathname !== PASSWORD_PATH) {
    return <Navigate to={PASSWORD_PATH} replace />;
  }
  return <>{children}</>;
}

/** 기관 소속 계정만 통과한다(RequireAuth 안에서). 슈퍼관리자는 /manage/super 로 보낸다. */
export function RequireOrg({ children }: { children: ReactNode }) {
  const { user, org } = useAuth();
  if (!org) {
    if (user?.is_superadmin) return <Navigate to="/manage/super" replace />;
    return (
      <Waiting>
        <NotFound title="소속 기관이 없어요" body="관리자에게 문의해 주세요." />
      </Waiting>
    );
  }
  return <OrgContext.Provider value={org}>{children}</OrgContext.Provider>;
}

/** 슈퍼관리자만 통과한다(RequireAuth 안에서). */
export function RequireSuper({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user?.is_superadmin) return <Navigate to="/manage" replace />;
  return <>{children}</>;
}
