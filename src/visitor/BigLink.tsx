import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const TONE = {
  solid: "bg-paper text-ink",
  outline: "border-2 border-paper text-paper",
};

/** 잉크 바탕 위의 화면 이동 버튼. 입장권의 노랑과 겹치지 않게 종이 재료를 쓴다. */
export function BigLink({ to, tone, children }: { to: string; tone: keyof typeof TONE; children: ReactNode }) {
  return (
    <Link to={to} className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-md px-4 text-18 font-extrabold ${TONE[tone]}`}>
      {children}
    </Link>
  );
}
