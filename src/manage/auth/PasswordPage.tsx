import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as admin from "../../api/admin";
import { fieldErrors, messageFor } from "../../api/messages";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { Button, Notice, PageFrame, TextField } from "../../ui";
import { useAuth } from "./AuthProvider";

export default function PasswordPage() {
  useDocumentTitle("비밀번호 변경");
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setGeneral(null);
    if (next !== confirm) {
      setErrors({ confirm: "새 비밀번호가 서로 달라요." });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await admin.changePassword(current, next);
      await refresh(); // must_change_password 가 풀린 계정 정보를 다시 받는다.
      navigate("/manage", { replace: true });
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (Object.keys(fields).length === 0) setGeneral(messageFor(err));
      setBusy(false);
    }
  }

  async function signOut() {
    setGeneral(null);
    try {
      await logout();
    } catch (err) {
      setGeneral(messageFor(err));
    }
  }

  return (
    <PageFrame surface="paper-2" width="narrow">
      <main>
        <h1 className="mb-2 text-22 font-extrabold tracking-[-0.03em]">비밀번호 변경</h1>
        {user?.must_change_password && (
          <p className="mb-4 text-15">임시 비밀번호로 로그인했어요. 새 비밀번호로 바꾸면 이어서 쓸 수 있어요.</p>
        )}
        <form onSubmit={submit} className="space-y-4">
          {general && <Notice tone="error">{general}</Notice>}
          <TextField
            label="현재 비밀번호"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            error={errors.current}
            autoComplete="current-password"
            required
          />
          <TextField
            label="새 비밀번호"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            error={errors.new}
            hint="8자 이상, 아이디와 달라야 해요."
            autoComplete="new-password"
            required
          />
          <TextField
            label="새 비밀번호 확인"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
            autoComplete="new-password"
            required
          />
          <div className="flex gap-3">
            <Button type="submit" loading={busy} className="flex-1">
              비밀번호 바꾸기
            </Button>
            <Button variant="secondary" onClick={() => void signOut()}>
              로그아웃
            </Button>
          </div>
        </form>
      </main>
    </PageFrame>
  );
}
