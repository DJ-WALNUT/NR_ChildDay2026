import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  requireText?: string;
}

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled])";

function Inner({ title, body, confirmLabel, danger, onConfirm, onCancel, requireText }: Omit<ConfirmDialogProps, "open">) {
  const titleId = useId();
  const bodyId = useId();
  const root = useRef<HTMLDivElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");

  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (input.current ?? cancelBtn.current)?.focus();
    const scrollLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.isComposing || e.keyCode === 229) return; // 한글 등 조합 중에는 무시
      if (e.key === "Escape") {
        e.preventDefault();
        cancelRef.current();
        return;
      }
      if (e.key !== "Tab" || !root.current) return;
      const items = Array.from(root.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !root.current.contains(active);
      if (outside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = scrollLock;
      previous?.focus();
    };
  }, []);

  const ready = !requireText || typed === requireText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4">
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-sm rounded-lg bg-paper p-5 text-ink"
      >
        <h2 id={titleId} className="text-18 font-extrabold tracking-[-0.03em]">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-15">
          {body}
        </p>
        {requireText && (
          <div className="mt-4">
            <label htmlFor={`${titleId}-confirm`} className="mb-1 block text-13 font-bold">
              확인을 위해 &quot;{requireText}&quot;을(를) 입력해 주세요
            </label>
            <input
              id={`${titleId}-confirm`}
              ref={input}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && ready && !e.nativeEvent.isComposing && e.keyCode !== 229) {
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
          <Button variant={danger ? "danger" : "primary"} disabled={!ready} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, ...rest }: ConfirmDialogProps) {
  return open ? <Inner {...rest} /> : null;
}
