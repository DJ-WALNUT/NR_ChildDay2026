import type { ReactNode } from "react";

export type StampKind = "ok" | "wait" | "closed" | "noshow" | "done" | "live";

const TEXT: Record<StampKind, string> = {
  ok: "입장 가능",
  wait: "대기",
  closed: "마감",
  noshow: "노쇼",
  done: "체험완료",
  live: "운영 중",
};

const LOOK: Record<StampKind, string> = {
  ok: "border-2 border-stamp-green text-stamp-green -rotate-[5deg]",
  done: "border-2 border-stamp-green text-stamp-green -rotate-[4deg]",
  wait: "border-2 border-stamp-amber text-stamp-amber -rotate-[6deg]",
  closed: "border-2 border-stamp-red text-stamp-red -rotate-[8deg]",
  noshow: "border-2 border-stamp-red text-stamp-red -rotate-[6deg]",
  live: "border-2 border-ink bg-ink text-ticket",
};

export function Stamp({ kind, children }: { kind: StampKind; children?: ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-sm px-2 py-0.5 text-13 font-extrabold ${LOOK[kind]}`}>
      {children ?? TEXT[kind]}
    </span>
  );
}
