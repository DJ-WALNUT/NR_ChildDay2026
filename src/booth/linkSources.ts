import {
  clearBoothLink,
  clearPartnerBooth,
  deleteReservationBoothLink,
  deleteReservationPartnerBooth,
  exportBoothLink,
  getBoothLink,
  getPartner,
  getPartnerBooth,
  linkKeys,
  listReservationsPartnerBooth,
  partnerExport,
  partnerStats,
  patchBoothLink,
  patchPartnerBooth,
  setStatusBoothLink,
  setStatusPartnerBooth,
  toggleBoothLink,
  togglePartnerBooth,
} from "../api/link";
import type { Booth } from "../api/types";
import type { BoothSource } from "./BoothSource";

export function boothLinkSource(token: string): BoothSource {
  return {
    key: [...linkKeys.booth(token)],
    get: () => getBoothLink(token),
    patch: async (s) => (await patchBoothLink(token, s)).booth,
    toggle: () => toggleBoothLink(token),
    setStatus: (rid, status) => setStatusBoothLink(token, rid, status),
    deleteReservation: (rid) => deleteReservationBoothLink(token, rid),
    clear: () => clearBoothLink(token),
    exportData: () => exportBoothLink(token),
  };
}

// 운영 단체 링크의 org(slug)는 부스 응답에 없어서 getPartner(t)에서 받아요.
// 토큰마다 한 번만 받아 모듈 안에 약속(promise)으로 기억하고, 실패하면 지워서 다음 갱신 때 다시 받아요.
const orgCache = new Map<string, Promise<{ name: string; slug: string }>>();
function partnerOrg(token: string) {
  let p = orgCache.get(token);
  if (!p) {
    p = getPartner(token).then((r) => r.org);
    p.catch(() => orgCache.delete(token));
    orgCache.set(token, p);
  }
  return p;
}

export function partnerBoothSource(token: string, boothId: number | string): BoothSource {
  return {
    key: [...linkKeys.partnerBooth(token, boothId)],
    async get() {
      const [{ booth }, { reservations }, stats, org] = await Promise.all([
        getPartnerBooth(token, boothId),
        listReservationsPartnerBooth(token, boothId),
        partnerStats(token, { booth_ids: [Number(boothId)], mode: "simple" }),
        partnerOrg(token),
      ]);
      return { booth, org, reservations, stats };
    },
    patch: async (s): Promise<Booth> => (await patchPartnerBooth(token, boothId, s)).booth,
    toggle: () => togglePartnerBooth(token, boothId),
    setStatus: (rid, status) => setStatusPartnerBooth(token, boothId, rid, status),
    deleteReservation: (rid) => deleteReservationPartnerBooth(token, boothId, rid),
    clear: () => clearPartnerBooth(token, boothId),
    exportData: () => partnerExport(token, { booth_ids: [Number(boothId)] }),
  };
}
