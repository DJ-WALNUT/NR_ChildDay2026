import { useEffect, useId, useRef, useState } from "react";
import { Button, Modal } from "../../ui";

/** 임시 비밀번호를 한 번만 보여 주는 대화상자. 값은 읽기 전용 입력란에 두고, 복사에 실패해도 선택된 채 남긴다. */
export function TempPasswordDialog({ username, password, onClose }: {
  username: string;
  password: string;
  onClose: () => void;
}) {
  const bodyId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    input.current?.select();
  }, []);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      setCopy("done");
    } catch {
      // 권한이 없거나 clipboard 가 없는 환경: 직접 복사하도록 값을 선택해 둔다.
      setCopy("failed");
      input.current?.focus();
      input.current?.select();
    }
  }

  return (
    <Modal title="임시 비밀번호" describedBy={bodyId} onClose={onClose} initialFocus={input}>
      <div id={bodyId} className="mt-2 space-y-1 text-15">
        <p>{username} 계정의 임시 비밀번호예요.</p>
        <p className="font-bold">이 화면을 닫으면 다시 볼 수 없어요.</p>
      </div>
      <div className="mt-4">
        <label htmlFor={`${bodyId}-pw`} className="mb-1 block text-13 font-bold">
          임시 비밀번호
        </label>
        <input
          id={`${bodyId}-pw`}
          ref={input}
          readOnly
          value={password}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-full rounded-md border-2 border-ink bg-paper-2 px-3 text-18 font-bold tabular-nums"
        />
        <p role="status" className="mt-1 min-h-5 text-13 font-bold">
          {copy === "done" && "복사했어요"}
          {copy === "failed" && "직접 복사해 주세요."}
        </p>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => void copyPassword()}>
          복사
        </Button>
        <Button onClick={onClose}>닫기</Button>
      </div>
    </Modal>
  );
}
