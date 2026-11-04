import { useId, useState, type ChangeEvent } from "react";
import { apiUrl } from "../api/client";
import { fieldErrors, messageFor } from "../api/messages";
import { Button } from "../ui";

const MAX_BYTES = 1_048_576; // 1MB
const TYPES = ["image/png", "image/jpeg", "image/webp"];

function serverMessage(err: unknown): string {
  return Object.values(fieldErrors(err))[0] ?? messageFor(err);
}

/** 로고 올리기·지우기. 기관 설정과 행사 설정이 함께 쓴다. */
export default function LogoField({
  label,
  logoUrl,
  upload,
  remove,
  onChanged,
}: {
  label: string;
  logoUrl: string | null;
  upload: (file: File) => Promise<unknown>;
  remove: () => Promise<unknown>;
  onChanged: () => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(job: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await job();
      onChanged();
    } catch (err) {
      setError(serverMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 고를 수 있게 비운다.
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError("PNG, JPG, WebP 파일만 올릴 수 있어요.");
    if (file.size > MAX_BYTES) return setError("1MB 이하 파일만 올릴 수 있어요.");
    void run(() => upload(file));
  }

  return (
    <div className="text-ink">
      <label htmlFor={id} className="mb-1 block text-13 font-bold">
        {label}
      </label>
      {logoUrl && <img src={apiUrl(logoUrl)} alt={label} className="mb-2 h-12 w-auto max-w-full object-contain" />}
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={pick}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          className="min-h-11 text-13 disabled:opacity-50"
        />
        {logoUrl && (
          <Button variant="secondary" loading={busy} onClick={() => void run(remove)}>
            로고 삭제
          </Button>
        )}
      </div>
      <p id={`${id}-hint`} className="mt-1 text-13 text-muted">
        PNG, JPG, WebP, 1MB 이하
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-13 font-bold">
          <span aria-hidden className="mr-1 inline-block size-2 rounded-sm bg-stamp-red" />
          {error}
        </p>
      )}
    </div>
  );
}
