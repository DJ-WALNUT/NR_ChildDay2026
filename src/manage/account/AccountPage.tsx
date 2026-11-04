import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { adminKeys, updateMember } from "../../api/admin";
import { fieldErrors, messageFor } from "../../api/messages";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { Button, Notice, TextField } from "../../ui";
import { useAuth } from "../auth/AuthProvider";
import { PasswordForm } from "../auth/PasswordForm";

export default function AccountPage() {
  useDocumentTitle("내 계정");
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(user?.display_name ?? "");
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passwordDone, setPasswordDone] = useState(false);

  if (!user) return null; // RequireAuth 안이라 오지 않는다.

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setNameError(undefined);
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await updateMember(user.id, { display_name: name.trim() });
      await refresh();
      if (user.org_id !== null) await qc.invalidateQueries({ queryKey: adminKeys.members(user.org_id) });
      setSaved(true);
    } catch (err) {
      const fields = fieldErrors(err);
      setNameError(fields.display_name);
      if (!fields.display_name) setError(Object.values(fields)[0] ?? messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md space-y-8">
      <h1 className="text-22 font-extrabold tracking-[-0.03em]">내 계정</h1>
      <section aria-labelledby="account-profile" className="space-y-3">
        <h2 id="account-profile" className="text-18 font-extrabold tracking-[-0.03em]">
          내 정보
        </h2>
        <p className="text-15">
          아이디 <span className="font-bold">{user.username}</span>
        </p>
        <form onSubmit={save} className="space-y-3">
          {error && <Notice tone="error">{error}</Notice>}
          {saved && <Notice tone="info">이름을 저장했어요.</Notice>}
          <TextField label="표시 이름" value={name} onChange={(e) => setName(e.target.value)} error={nameError} maxLength={40} />
          <Button type="submit" loading={busy}>
            이름 저장
          </Button>
        </form>
      </section>
      <section aria-labelledby="account-password" className="space-y-3">
        <h2 id="account-password" className="text-18 font-extrabold tracking-[-0.03em]">
          비밀번호 변경
        </h2>
        {passwordDone && <Notice tone="info">비밀번호를 바꿨어요.</Notice>}
        <PasswordForm onAttempt={() => setPasswordDone(false)} onDone={() => setPasswordDone(true)} />
      </section>
    </div>
  );
}
