import { isTimeAvailability, type Availability } from "../api/types";

/** 서버 _slot_key와 동일: 라벨 맨 앞 "<숫자>시"의 숫자, 없으면 -1. 비ASCII 숫자는 NFKC로 ASCII화. */
export function slotHour(label: string): number {
  const m = /^(\d+)시/.exec(label.normalize("NFKC"));
  return m ? parseInt(m[1], 10) : -1;
}

/** 코드포인트 순 비교(Python 문자열 비교와 동일). */
function cmpStr(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

export function compareSlots(a: string, b: string): number {
  return slotHour(a) - slotHour(b) || cmpStr(a, b);
}

export function availabilitySummary(
  mode: "time" | "fcfs",
  a: Availability,
  useWaitlist: boolean,
): string {
  if (a.is_closed) return "마감";
  let full: boolean;
  let text: string;
  if (mode === "time" && isTimeAvailability(a)) {
    full = a.slots.length === 0 || a.slots.every((s) => s.full);
    if (a.slots.some((s) => !s.full && s.remaining === null)) text = "자리 여유";
    else text = `남은 자리 ${a.slots.reduce((n, s) => n + (s.remaining ?? 0), 0)}`;
  } else if (!isTimeAvailability(a)) {
    full = a.full;
    text = a.remaining === null ? "자리 여유" : `남은 자리 ${a.remaining}`;
  } else {
    return "마감";
  }
  if (full) return useWaitlist ? "대기 접수 중" : "마감";
  return text;
}
