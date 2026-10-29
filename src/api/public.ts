import { api } from "./client";
import type {
  Identity,
  LookupResult,
  PublicBoothPage,
  PublicOrgPage,
  ReserveBody,
  ReserveResult,
} from "./types";

export const publicKeys = {
  org: (slug: string) => ["public", "org", slug] as const,
  booth: (slug: string, boothId: number | string) => ["public", "booth", slug, boothId] as const,
};

export const getOrgPage = (slug: string) =>
  api<PublicOrgPage>("GET", `/api/public/orgs/${encodeURIComponent(slug)}`);

export const getBoothPage = (slug: string, boothId: number | string) =>
  api<PublicBoothPage>("GET", `/api/public/orgs/${encodeURIComponent(slug)}/booths/${boothId}`);

export const reserve = (boothId: number | string, body: ReserveBody) =>
  api<ReserveResult>("POST", `/api/public/booths/${boothId}/reservations`, body);

export const lookup = (boothId: number | string, body: Identity) =>
  api<LookupResult>("POST", `/api/public/booths/${boothId}/lookup`, body);

export const cancel = (boothId: number | string, body: Identity) =>
  api<void>("POST", `/api/public/booths/${boothId}/cancel`, body);

export const getBoothHome = (boothId: number | string) =>
  api<{ slug: string }>("GET", `/api/public/booths/${boothId}/home`);
