import type { Booth, BoothSettings, ExportData, Reservation, ReservationStatus, SetStatusResult, Stats } from "../api/types";

export interface BoothDetail {
  booth: Booth;
  org: { name: string; slug: string };
  reservations: Reservation[];
  stats: Stats;
}

/** 부스 관리 화면이 쓰는 어댑터. 링크용·운영 단체용·관리자용이 같은 화면을 공유해요. */
export interface BoothSource {
  /** TanStack Query 키. 어댑터마다 달라서 캐시가 섞이지 않아요. */
  key: unknown[];
  get(): Promise<BoothDetail>;
  patch(settings: Partial<BoothSettings>): Promise<Booth>;
  toggle(): Promise<{ is_active: boolean }>;
  setStatus(rid: number, status: ReservationStatus): Promise<SetStatusResult>;
  deleteReservation(rid: number): Promise<void>;
  clear(): Promise<{ deleted: number }>;
  exportData(): Promise<ExportData>;
  /** 화면에 보일 전체 주소 */
  links: { manage: string; reserve: string };
}
