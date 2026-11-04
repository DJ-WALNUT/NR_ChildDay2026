import { useId, useRef, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  requireText?: string;
  /** 처리 중: 확인 버튼을 잠그고 스피너를 보여줘요. */
  busy?: boolean;
}

function Inner({ title, body, confirmLabel, danger, onConfirm, onCancel, requireText, busy = false }: Omit<ConfirmDialogProps, "open">) {
  const bodyId = useId();
  const confirmId = useId();
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const ready = !requireText || typed === requireText;

  return (
    <Modal title={title} describedBy={bodyId} onClose={onCancel} initialFocus={requireText ? input : cancelBtn}>
      <p id={bodyId} className="mt-2 text-15">
        {body}
      </p>
      {requireText && (
        <div className="mt-4">
          <label htmlFor={confirmId} className="mb-1 block text-13 font-bold">
            확인을 위해 &quot;{requireText}&quot;을(를) 입력해 주세요
          </label>
          <input
            id={confirmId}
            ref={input}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ready && !busy && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                onConfirm();
              }
            }}
            autoComplete="off"
            className="h-11 w-full rounded-md border-2 border-muted bg-paper-2 px-3 text-15 focus:border-ink"
          />
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button ref={cancelBtn} variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button variant={danger ? "danger" : "primary"} loading={busy} disabled={!ready} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function ConfirmDialog({ open, ...rest }: ConfirmDialogProps) {
  return open ? <Inner {...rest} /> : null;
}
