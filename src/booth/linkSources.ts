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

function linksFor(booth: { manage_token: string; id: number }, slug: string) {
  const origin = window.location.origin;
  return { manage: `${origin}/b/${booth.manage_token}`, reserve: `${origin}/${slug}/reserve/${booth.id}` };
}

// 화면이 주소를 쓰려면 토큰과 slug 가 필요해요. 링크 응답에서 받은 값을 어댑터가 기억해요.
// links 는 get() 이 끝난 뒤 정확해지고, 그 전에는 빈 문자열이에요(화면은 get() 뒤에야 그려져요).
export function boothLinkSource(token: string): BoothSource {
  let links = { manage: "", reserve: "" };
  return {
    key: [...linkKeys.booth(token)],
    async get() {
      const d = await getBoothLink(token);
      links = linksFor(d.booth, d.org.slug);
      return d;
    },
    patch: async (s) => (await patchBoothLink(token, s)).booth,
    toggle: () => toggleBoothLink(token),
    setStatus: (rid, status) => setStatusBoothLink(token, rid, status),
    deleteReservation: (rid) => deleteReservationBoothLink(token, rid),
    clear: () => clearBoothLink(token),
    exportData: () => exportBoothLink(token),
    get links() {
      return links;
    },
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
  let links = { manage: "", reserve: "" };
  return {
    key: [...linkKeys.partnerBooth(token, boothId)],
    async get() {
      const [{ booth }, { reservations }, stats, org] = await Promise.all([
        getPartnerBooth(token, boothId),
        listReservationsPartnerBooth(token, boothId),
        partnerStats(token, { booth_ids: [Number(boothId)], mode: "simple" }),
        partnerOrg(token),
      ]);
      links = linksFor(booth, org.slug);
      return { booth, org, reservations, stats };
    },
    patch: async (s): Promise<Booth> => (await patchPartnerBooth(token, boothId, s)).booth,
    toggle: () => togglePartnerBooth(token, boothId),
    setStatus: (rid, status) => setStatusPartnerBooth(token, boothId, rid, status),
    deleteReservation: (rid) => deleteReservationPartnerBooth(token, boothId, rid),
    clear: () => clearPartnerBooth(token, boothId),
    exportData: () => partnerExport(token, { booth_ids: [Number(boothId)] }),
    get links() {
      return links;
    },
  };
}
