import { useState, type FormEvent, type ReactNode } from "react";
import * as admin from "../../api/admin";
import { fieldErrors, messageFor } from "../../api/messages";
import { Button, Notice, TextField } from "../../ui";

/** 비밀번호 변경 폼. 바꾸는 데 성공하면 onDone 을 부른다. actions 는 제출 버튼 옆에 둘 버튼. */
export function PasswordForm({ onDone, actions, notice }: {
  onDone: () => void | Promise<void>;
  actions?: ReactNode;
  /** 폼 위에 보일 오류 문구(예: 로그아웃 실패). */
  notice?: string | null;
}) {
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
      setCurrent("");
      setNext("");
      setConfirm("");
      await onDone();
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (Object.keys(fields).length === 0) setGeneral(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  const message = general ?? notice;
  return (
    <form onSubmit={submit} className="space-y-4">
      {message && <Notice tone="error">{message}</Notice>}
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
        {actions}
      </div>
    </form>
  );
}
