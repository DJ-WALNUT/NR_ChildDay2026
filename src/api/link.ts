import { api } from "./client";
import type {
  Booth,
  BoothLinkPayload,
  BoothSettings,
  ExportData,
  PartnerPayload,
  Reservation,
  ReservationStatus,
  SetStatusResult,
  Stats,
  StatsMode,
} from "./types";

export const linkKeys = {
  booth: (t: string) => ["link", "booth", t] as const,
  partner: (t: string) => ["link", "partner", t] as const,
  partnerBooth: (t: string, id: number | string) => ["link", "partner", t, "booth", id] as const,
  partnerReservations: (t: string, id: number | string) =>
    ["link", "partner", t, "booth", id, "reservations"] as const,
};

const enc = encodeURIComponent;
const boothBase = (t: string) => `/api/link/booth/${enc(t)}`;
const partnerBase = (t: string) => `/api/link/partner/${enc(t)}`;
const partnerBoothBase = (t: string, id: number | string) => `${partnerBase(t)}/booths/${id}`;

// ---- 부스 링크 ----
export const getBoothLink = (t: string) => api<BoothLinkPayload>("GET", boothBase(t));
export const patchBoothLink = (t: string, settings: Partial<BoothSettings>) =>
  api<{ booth: Booth }>("PATCH", boothBase(t), settings);
export const toggleBoothLink = (t: string) => api<{ is_active: boolean }>("POST", `${boothBase(t)}/toggle`);
export const setStatusBoothLink = (t: string, rid: number, status: ReservationStatus) =>
  api<SetStatusResult>("PATCH", `${boothBase(t)}/reservations/${rid}`, { status });
export const deleteReservationBoothLink = (t: string, rid: number) =>
  api<void>("DELETE", `${boothBase(t)}/reservations/${rid}`);
export const clearBoothLink = (t: string) => api<{ deleted: number }>("DELETE", `${boothBase(t)}/reservations`);
export const exportBoothLink = (t: string) => api<ExportData>("GET", `${boothBase(t)}/export`);

// ---- 운영 단체(실적) 링크 ----
export const getPartner = (t: string) => api<PartnerPayload>("GET", partnerBase(t));
export const partnerStats = (t: string, body: { booth_ids?: number[]; mode: StatsMode }) =>
  api<Stats>("POST", `${partnerBase(t)}/stats`, body);
export const partnerExport = (t: string, body: { booth_ids?: number[] } = {}) =>
  api<ExportData>("POST", `${partnerBase(t)}/export`, body);

/** 부스 한 개만 돌려준다(예약 목록·통계 없음). 예약은 listReservationsPartnerBooth 로 따로 받는다. */
export const getPartnerBooth = (t: string, id: number | string) =>
  api<{ booth: Booth }>("GET", partnerBoothBase(t, id));
export const patchPartnerBooth = (t: string, id: number | string, settings: Partial<BoothSettings>) =>
  api<{ booth: Booth }>("PATCH", partnerBoothBase(t, id), settings);
export const togglePartnerBooth = (t: string, id: number | string) =>
  api<{ is_active: boolean }>("POST", `${partnerBoothBase(t, id)}/toggle`);
export const listReservationsPartnerBooth = (t: string, id: number | string) =>
  api<{ reservations: Reservation[] }>("GET", `${partnerBoothBase(t, id)}/reservations`);
export const setStatusPartnerBooth = (t: string, id: number | string, rid: number, status: ReservationStatus) =>
  api<SetStatusResult>("PATCH", `${partnerBoothBase(t, id)}/reservations/${rid}`, { status });
export const deleteReservationPartnerBooth = (t: string, id: number | string, rid: number) =>
  api<void>("DELETE", `${partnerBoothBase(t, id)}/reservations/${rid}`);
export const clearPartnerBooth = (t: string, id: number | string) =>
  api<{ deleted: number }>("DELETE", `${partnerBoothBase(t, id)}/reservations`);
