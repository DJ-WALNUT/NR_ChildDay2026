import { useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled])";

export interface ModalProps {
  title: string;
  /** 본문 설명 요소의 id. 있으면 aria-describedby 로 잇는다. */
  describedBy?: string;
  onClose: () => void;
  /** 열릴 때 초점을 받을 요소. 없으면 대화상자 안의 첫 초점 요소. */
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
  width?: "sm" | "md";
}

const WIDTH = { sm: "max-w-sm", md: "max-w-lg" };

/** 열려 있을 때만 렌더하는 대화상자 틀: 초점 가두기, Esc, 스크롤 잠금, 닫을 때 초점 복귀. */
export function Modal({ title, describedBy, onClose, initialFocus, children, width = "sm" }: ModalProps) {
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  // 처음 한 번만 읽는다. 열린 뒤 ref 가 바뀌어도 초점을 다시 옮기지 않아요.
  const initialRef = useRef(initialFocus);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (initialRef.current?.current ?? root.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    const scrollLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.isComposing || e.keyCode === 229) return; // 한글 등 조합 중에는 무시
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/70 px-4">
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className={`on-paper w-full ${WIDTH[width]} max-h-full overflow-y-auto rounded-lg bg-paper p-5 text-ink`}
      >
        <h2 id={titleId} className="text-18 font-extrabold tracking-[-0.03em]">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
