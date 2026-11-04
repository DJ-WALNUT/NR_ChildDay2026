import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { messageFor } from "../../api/messages";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { Button, Notice, PageFrame, Spinner, TextField } from "../../ui";
import { useAuth } from "./AuthProvider";
import { safeNext } from "./safeNext";

export default function LoginPage() {
  useDocumentTitle("로그인");
  const { user, loading, login } = useAuth();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={safeNext(params.get("next"))} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <PageFrame surface="paper-2" width="narrow">
      <main>
        <h1 className="mb-4 text-22 font-extrabold tracking-[-0.03em]">로그인</h1>
        {loading ? (
          <Spinner />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <Notice tone="error">{error}</Notice>}
            <TextField
              label="아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <TextField
              label="비밀번호"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Button type="submit" loading={busy} className="w-full">
              로그인
            </Button>
          </form>
        )}
      </main>
    </PageFrame>
  );
}
