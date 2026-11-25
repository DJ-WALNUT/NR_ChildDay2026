import { api, apiBlob } from "./client";
import type {
  AdminEvent,
  AuditPage,
  Booth,
  BoothSettings,
  ExportData,
  MeResponse,
  Member,
  Overview,
  Partner,
  Reservation,
  ReservationStatus,
  SessionOrg,
  SessionUser,
  SetStatusResult,
  Stats,
  StatsMode,
  SuperOrg,
} from "./types";

export const adminKeys = {
  overview: (orgId: number) => ["admin", "overview", orgId] as const,
  events: (orgId: number) => ["admin", "events", orgId] as const,
  event: (id: number | string) => ["admin", "event", id] as const,
  booths: (eventId: number | string) => ["admin", "booths", eventId] as const,
  partners: (eventId: number | string) => ["admin", "partners", eventId] as const,
  linkTargets: (orgId: number) => ["admin", "linkTargets", orgId] as const,
  members: (orgId: number) => ["admin", "members", orgId] as const,
  audit: (scope: number | "super", action?: string) => ["admin", "audit", scope, action ?? ""] as const,
  superOrgs: () => ["admin", "superOrgs"] as const,
};

const A = "/api/admin";

/** 값이 있는 항목만 쿼리 문자열로 만든다. 하나도 없으면 빈 문자열. */
function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

const fileBody = (file: File | Blob) => {
  const form = new FormData();
  form.append("file", file);
  return form;
};

/** 부스 생성·일괄 생성에 보내는 항목: 설정과 운영 단체 배정. */
export type NewBooth = Partial<BoothSettings> & { name: string; partner_id?: number | null };

// ---- 로그인 ----
export const getMe = () => api<MeResponse>("GET", `${A}/auth/me`);
export const login = (username: string, password: string) =>
  api<{ user: SessionUser; csrf: string }>("POST", `${A}/auth/login`, { username, password });
export const logout = () => api<void>("POST", `${A}/auth/logout`);
export const changePassword = (current: string, next: string) =>
  api<void>("POST", `${A}/auth/password`, { current, new: next });

// ---- 기관 계정 ----
export const listMembers = async (orgId: number) =>
  (await api<{ users: Member[] }>("GET", `${A}/orgs/${orgId}/users`)).users;
export const createMember = (orgId: number, body: { username: string; display_name: string }) =>
  api<{ user: Member; temp_password: string }>("POST", `${A}/orgs/${orgId}/users`, body);
export const updateMember = async (id: number, body: { display_name?: string; is_active?: boolean }) =>
  (await api<{ user: Member }>("PATCH", `${A}/users/${id}`, body)).user;
export const resetMemberPassword = (id: number) =>
  api<{ temp_password: string }>("POST", `${A}/users/${id}/reset-password`);

// ---- 행사·로고 ----
export const getOverview = (orgId: number) => api<Overview>("GET", `${A}/orgs/${orgId}/overview`);
export const listEvents = async (orgId: number) =>
  (await api<{ events: AdminEvent[] }>("GET", `${A}/orgs/${orgId}/events`)).events;
export const getEvent = (id: number | string) =>
  api<{ event: AdminEvent; org: SessionOrg }>("GET", `${A}/events/${id}`);
export const createEvent = async (orgId: number, name: string) =>
  (await api<{ event: AdminEvent }>("POST", `${A}/orgs/${orgId}/events`, { name })).event;
export const updateEvent = async (
  id: number,
  body: { name?: string; notice?: string | null; age_label?: string; age_options?: string[] },
) =>
  (await api<{ event: AdminEvent }>("PATCH", `${A}/events/${id}`, body)).event;
export const deleteEvent = (id: number) => api<void>("DELETE", `${A}/events/${id}`);
export const uploadEventLogo = (id: number, file: File | Blob) =>
  api<{ logo_url: string }>("PUT", `${A}/events/${id}/logo`, fileBody(file));
export const removeEventLogo = (id: number) => api<void>("DELETE", `${A}/events/${id}/logo`);
export const uploadOrgLogo = (orgId: number, file: File | Blob) =>
  api<{ logo_url: string }>("PUT", `${A}/orgs/${orgId}/logo`, fileBody(file));
export const removeOrgLogo = (orgId: number) => api<void>("DELETE", `${A}/orgs/${orgId}/logo`);

// ---- 운영 단체 ----
export const listPartners = async (eventId: number | string) =>
  (await api<{ partners: Partner[] }>("GET", `${A}/events/${eventId}/partners`)).partners;
export const createPartner = async (eventId: number, body: { name: string; linked_org_id?: number | null }) =>
  (await api<{ partner: Partner }>("POST", `${A}/events/${eventId}/partners`, body)).partner;
export const updatePartner = async (id: number, body: { name?: string; linked_org_id?: number | null }) =>
  (await api<{ partner: Partner }>("PATCH", `${A}/partners/${id}`, body)).partner;
export const deletePartner = (id: number) => api<void>("DELETE", `${A}/partners/${id}`);
export const rotatePartnerToken = (id: number) =>
  api<{ access_token: string }>("POST", `${A}/partners/${id}/rotate-token`);
export const listLinkTargets = async (orgId: number) =>
  (await api<{ orgs: { id: number; name: string }[] }>("GET", `${A}/orgs/${orgId}/link-targets`)).orgs;

// ---- 부스·예약 ----
export const listBooths = async (eventId: number | string) =>
  (await api<{ booths: Booth[] }>("GET", `${A}/events/${eventId}/booths`)).booths;
export const createBooth = async (eventId: number, settings: NewBooth) =>
  (await api<{ booth: Booth }>("POST", `${A}/events/${eventId}/booths`, settings)).booth;
export const bulkCreateBooths = (eventId: number, rows: NewBooth[]) =>
  api<{ created: number }>("POST", `${A}/events/${eventId}/booths/bulk`, { rows });
/** 부스와 소유 기관(방문객 주소에 쓰는 slug 포함). */
export const getBooth = (id: number | string) =>
  api<{ booth: Booth; org: { name: string; slug: string } }>("GET", `${A}/booths/${id}`);
export const updateBooth = async (
  id: number | string,
  body: Partial<BoothSettings> & { event_id?: number; partner_id?: number | null },
) => (await api<{ booth: Booth }>("PATCH", `${A}/booths/${id}`, body)).booth;
export const deleteBooth = (id: number) => api<void>("DELETE", `${A}/booths/${id}`);
export const toggleBooth = (id: number | string) => api<{ is_active: boolean }>("POST", `${A}/booths/${id}/toggle`);
export const batchBoothStatus = (ids: number[], is_active: boolean) =>
  api<{ updated: number }>("POST", `${A}/booths/batch-status`, { booth_ids: ids, is_active });
export const rotateBoothToken = (id: number) =>
  api<{ manage_token: string }>("POST", `${A}/booths/${id}/rotate-token`);
export const listReservations = async (boothId: number | string) =>
  (await api<{ reservations: Reservation[] }>("GET", `${A}/booths/${boothId}/reservations`)).reservations;
export const setReservationStatus = (rid: number, status: ReservationStatus) =>
  api<SetStatusResult>("PATCH", `${A}/reservations/${rid}`, { status });
export const deleteReservation = (rid: number) => api<void>("DELETE", `${A}/reservations/${rid}`);
export const clearReservations = (boothId: number | string) =>
  api<{ deleted: number }>("DELETE", `${A}/booths/${boothId}/reservations`);
export const adminStats = (ids: number[], mode: StatsMode) =>
  api<Stats>("POST", `${A}/stats`, { booth_ids: ids, mode });
export const adminExport = (ids: number[]) => api<ExportData>("POST", `${A}/export`, { booth_ids: ids });

// ---- 활동 기록 ----
export const listAudit = (orgId: number, opts: { before?: number; action?: string } = {}) =>
  api<AuditPage>("GET", `${A}/orgs/${orgId}/audit${query({ before: opts.before, action: opts.action })}`);

// ---- 슈퍼관리자 ----
export const listSuperOrgs = async () => (await api<{ orgs: SuperOrg[] }>("GET", `${A}/super/orgs`)).orgs;
export const createSuperOrg = async (body: { name: string; slug: string }) =>
  (await api<{ org: SuperOrg }>("POST", `${A}/super/orgs`, body)).org;
export const updateSuperOrg = async (id: number, body: { name?: string; slug?: string; is_active?: boolean }) =>
  (await api<{ org: SuperOrg }>("PATCH", `${A}/super/orgs/${id}`, body)).org;
export const listSuperAudit = (opts: { before?: number; action?: string; org_id?: number } = {}) =>
  api<AuditPage>("GET", `${A}/super/audit${query({ before: opts.before, action: opts.action, org_id: opts.org_id })}`);
export const downloadBackup = () => apiBlob(`${A}/super/backup`);
export const whoamiIp = () =>
  api<{ remote_addr: string | null; x_forwarded_for: string | null }>("GET", `${A}/super/whoami-ip`);
