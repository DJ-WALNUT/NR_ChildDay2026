import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { messageFor } from "../../api/messages";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { Button, PageFrame } from "../../ui";
import { useAuth } from "./AuthProvider";
import { PasswordForm } from "./PasswordForm";

export default function PasswordPage() {
  useDocumentTitle("비밀번호 변경");
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function signOut() {
    setLogoutError(null);
    try {
      await logout();
    } catch (err) {
      setLogoutError(messageFor(err));
    }
  }

  return (
    <PageFrame surface="paper-2" width="narrow">
      <main>
        <h1 className="mb-2 text-22 font-extrabold tracking-[-0.03em]">비밀번호 변경</h1>
        {user?.must_change_password && (
          <p className="mb-4 text-15">임시 비밀번호로 로그인했어요. 새 비밀번호로 바꾸면 이어서 쓸 수 있어요.</p>
        )}
        <PasswordForm
          notice={logoutError}
          onAttempt={() => setLogoutError(null)}
          onDone={async () => {
            await refresh(); // must_change_password 가 풀린 계정 정보를 다시 받는다.
            navigate("/manage", { replace: true });
          }}
          actions={
            <Button variant="secondary" onClick={() => void signOut()}>
              로그아웃
            </Button>
          }
        />
      </main>
    </PageFrame>
  );
}
