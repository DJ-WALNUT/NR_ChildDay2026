import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import * as admin from "../../api/admin";
import { ApiError, setCsrf } from "../../api/client";
import type { SessionOrg, SessionUser } from "../../api/types";

export type AuthValue = {
  user: SessionUser | null;
  org: SessionOrg | null;
  loading: boolean;
  /** 세션 확인이 401 이 아닌 이유(네트워크·서버 오류)로 실패했다. 로그아웃 상태와 구분한다. */
  failed: boolean;
  /** 사용자가 직접 로그아웃했다. 세션 만료와 달리 돌아올 주소(next)를 남기지 않는다. */
  signedOut: boolean;
  login(username: string, password: string): Promise<void>;
  /** 로그아웃이 확인될 때만 정리하고 이동한다. 실패하면 세션을 그대로 두고 reject 하므로 호출한 화면이 messageFor 로 알린다. */
  logout(): Promise<void>;
  refresh(): Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

export const LOGIN_PATH = "/manage/login";

// eslint-disable-next-line react-refresh/only-export-components
export function loginUrl(next: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [org, setOrg] = useState<SessionOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const here = useRef(location.pathname + location.search);
  here.current = location.pathname + location.search;
  const redirecting = useRef(false);
  useEffect(() => {
    redirecting.current = false;
  }, [location.pathname]);

  // 다른 계정이 이전 계정의 캐시를 보지 않도록 세션을 지울 때 쿼리 캐시도 함께 비운다.
  const clear = useCallback(() => {
    setCsrf(null);
    setUser(null);
    setOrg(null);
    queryClient.clear();
  }, [queryClient]);

  const load = useCallback(
    async (throwOnError: boolean) => {
      try {
        const me = await admin.getMe();
        setCsrf(me.csrf);
        setUser(me.user);
        setOrg(me.org);
        setFailed(false);
        setSignedOut(false);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clear();
          setFailed(false);
        } else {
          setFailed(true);
        }
        if (throwOnError) throw err;
      } finally {
        setLoading(false);
      }
    },
    [clear],
  );

  const refresh = useCallback(() => load(false), [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const onUnauthorized = () => {
      const path = here.current;
      if (redirecting.current || path.startsWith(LOGIN_PATH)) return;
      redirecting.current = true;
      clear();
      navigate(loginUrl(path), { replace: true });
    };
    window.addEventListener("nr:unauthorized", onUnauthorized);
    return () => window.removeEventListener("nr:unauthorized", onUnauthorized);
  }, [clear, navigate]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await admin.login(username, password);
      setCsrf(res.csrf);
      await load(true); // 기관 정보(org)는 me 에만 있다.
    },
    [load],
  );

  const logout = useCallback(async () => {
    // 서버 세션이 지워졌다고 확인된 경우(204 또는 401)만 로그아웃으로 본다.
    // 403 csrf 는 다른 탭이 로그인해 토큰이 낡은 경우일 수 있어 새 토큰을 받아 한 번만 다시 시도한다.
    // 그 밖의 실패는 던져서 호출한 화면이 messageFor 로 알리게 하고, 세션 상태는 그대로 둔다.
    const attempt = async () => {
      try {
        await admin.logout();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
        throw err;
      }
    };
    try {
      await attempt();
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 403 && err.code === "csrf")) throw err;
      try {
        setCsrf((await admin.getMe()).csrf);
      } catch (meErr) {
        if (!(meErr instanceof ApiError && meErr.status === 401)) throw meErr;
      }
      await attempt();
    }
    setSignedOut(true); // RequireAuth 가 현재 주소를 next 로 붙여 보내지 않게 한다.
    clear();
    navigate(LOGIN_PATH, { replace: true });
  }, [clear, navigate]);

  const value = useMemo(
    () => ({ user, org, loading, failed, signedOut, login, logout, refresh }),
    [user, org, loading, failed, signedOut, login, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
