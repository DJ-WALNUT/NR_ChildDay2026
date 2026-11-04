import {
  adminExport,
  adminStats,
  clearReservations,
  deleteReservation,
  getBooth,
  listReservations,
  setReservationStatus,
  toggleBooth,
  updateBooth,
} from "../api/admin";
import type { BoothSource } from "./BoothSource";

/** 관리자 화면용 부스 어댑터. 기관 slug 는 GET /booths/<id> 응답의 org 에서 받아요(비공개 경로만 써요). */
export function adminBoothSource(boothId: number | string): BoothSource {
  const id = Number(boothId);
  return {
    key: ["admin", "booth", boothId],
    async get() {
      const [{ booth, org }, reservations, stats] = await Promise.all([
        getBooth(boothId),
        listReservations(boothId),
        adminStats([id], "simple"),
      ]);
      return { booth, org, reservations, stats };
    },
    patch: (s) => updateBooth(boothId, s),
    toggle: () => toggleBooth(boothId),
    setStatus: (rid, status) => setReservationStatus(rid, status),
    deleteReservation: (rid) => deleteReservation(rid),
    clear: () => clearReservations(boothId),
    exportData: () => adminExport([id]),
  };
}
