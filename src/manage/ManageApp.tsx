import { Route, Routes } from "react-router-dom";
import { NotFound, PageFrame } from "../ui";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth, RequireOrg, RequireSuper } from "./auth/guards";
import LoginPage from "./auth/LoginPage";
import PasswordPage from "./auth/PasswordPage";

function Placeholder({ name }: { name: string }) {
  return (
    <PageFrame surface="paper-2" width="wide">
      <main>
        <h1 className="text-22 font-extrabold tracking-[-0.03em]">{name}</h1>
      </main>
    </PageFrame>
  );
}

// routes.tsx 의 "/manage/*" 아래에서 그려지므로 경로는 /manage 기준 상대 경로다.
// 이후 태스크는 아래에 경로를 더한다. events/:id, booths/:id 는 RequireOrg 밖(슈퍼관리자도 연다),
// 대시보드·활동·계정·기관 설정은 RequireOrg 안에 둔다.
export default function ManageApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          path="password"
          element={
            <RequireAuth>
              <PasswordPage />
            </RequireAuth>
          }
        />
        <Route
          index
          element={
            <RequireAuth>
              <RequireOrg>
                <Placeholder name="대시보드" />
              </RequireOrg>
            </RequireAuth>
          }
        />
        <Route
          path="super"
          element={
            <RequireAuth>
              <RequireSuper>
                <Placeholder name="전체 관리" />
              </RequireSuper>
            </RequireAuth>
          }
        />
        <Route
          path="*"
          element={
            <RequireAuth>
              <PageFrame surface="paper-2" width="narrow">
                <main>
                  <NotFound />
                </main>
              </PageFrame>
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
