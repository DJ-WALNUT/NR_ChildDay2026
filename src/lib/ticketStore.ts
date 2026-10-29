import type { ReservationStatus } from "../api/types";

export interface StoredTicket {
  booth_id: number;
  slug: string;
  name: string;
  code: string;
  /** 신청 직후 받은 시간·상태. 서버 조회가 막혀도 입장권을 보이기 위해 함께 보관해요(옛 보관본에는 없을 수 있어요). */
  slot?: string;
  status?: ReservationStatus;
  saved_at: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const key = (boothId: number) => `nr.ticket.${boothId}`;

export function saveTicket(t: Omit<StoredTicket, "saved_at">): void {
  try {
    const v: StoredTicket = { ...t, saved_at: Date.now() };
    localStorage.setItem(key(t.booth_id), JSON.stringify(v));
  } catch {
    /* 저장소를 쓸 수 없으면 보관만 생략 */
  }
}

export function loadTicket(boothId: number): StoredTicket | null {
  try {
    const raw = localStorage.getItem(key(boothId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<StoredTicket> | null;
    if (
      !v || typeof v.saved_at !== "number" || typeof v.name !== "string" ||
      typeof v.code !== "string" || typeof v.slug !== "string" || v.booth_id !== boothId ||
      Date.now() - v.saved_at > TTL_MS
    ) {
      localStorage.removeItem(key(boothId));
      return null;
    }
    return v as StoredTicket;
  } catch {
    return null;
  }
}

export function clearTicket(boothId: number): void {
  try {
    localStorage.removeItem(key(boothId));
  } catch {
    /* 무시 */
  }
}
