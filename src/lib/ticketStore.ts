export interface StoredTicket {
  booth_id: number;
  slug: string;
  name: string;
  code: string;
  saved_at: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const key = (boothId: number) => `nr.ticket.${boothId}`;

export function saveTicket(t: { booth_id: number; slug: string; name: string; code: string }): void {
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
