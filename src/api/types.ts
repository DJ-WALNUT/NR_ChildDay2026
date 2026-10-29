// 백엔드 응답 모양(NR_ChildDay2026-BE/app/booth_ops.py, capacity.py, routes/public.py, routes/links.py 기준).

export type BoothMode = "time" | "fcfs";
export type ReservationStatus = "normal" | "waiting" | "noshow" | "completed";
export type Gender = "남" | "여";

export interface TimeSlotAvailability {
  label: string;
  remaining: number | null;
  full: boolean;
}
export interface TimeAvailability {
  slots: TimeSlotAvailability[];
  is_closed: boolean;
}
export interface FcfsAvailability {
  remaining: number | null;
  full: boolean;
  is_closed: boolean;
}
export type Availability = TimeAvailability | FcfsAvailability;

export function isTimeAvailability(a: Availability): a is TimeAvailability {
  return "slots" in a;
}

export interface PublicOrg {
  name: string;
  slug: string;
  logo_url: string | null;
}

export interface PublicOrgBooth {
  id: number;
  name: string;
  mode: BoothMode;
  is_closed: boolean;
}
export interface PublicOrgEvent {
  id: number;
  name: string;
  logo_url: string | null;
  notice: string | null;
  booths: PublicOrgBooth[];
}
export interface PublicOrgPage {
  org: PublicOrg;
  events: PublicOrgEvent[];
}

export interface PublicBoothPage {
  org: PublicOrg;
  event: { id: number; name: string; logo_url: string | null; notice: string | null };
  booth: { id: number; name: string; mode: BoothMode; use_waitlist: boolean; is_active: boolean };
  availability: Availability;
}

export interface ReserveBody {
  name: string;
  code: string;
  gender: Gender;
  age_group: string;
  /** 시간대별 부스는 슬롯 라벨, 선착순 부스는 생략 */
  slot?: string;
}
export interface ReserveResult {
  id: number;
  slot: string;
  status: ReservationStatus;
}
export interface LookupResult {
  name: string;
  slot: string;
  status: ReservationStatus;
  booth_name: string;
}
export interface Identity {
  name: string;
  code: string;
}

/** booth_json 의 키 전부 */
export interface Booth {
  id: number;
  event_id: number;
  event_name: string;
  org_id: number;
  partner_id: number | null;
  partner_name: string | null;
  name: string;
  mode: BoothMode;
  use_waitlist: boolean;
  total_limit: number;
  start_hour: number;
  end_hour: number;
  slots_per_hour: number;
  limit_per_slot: number;
  is_active: boolean;
  manage_token: string;
  count: number;
  availability: Availability;
}

/** 링크로 바꿀 수 있는 설정 항목(SETTING_FIELDS). 보낸 키만 바뀐다. */
export interface BoothSettings {
  name: string;
  mode: BoothMode;
  use_waitlist: boolean;
  total_limit: number;
  start_hour: number;
  end_hour: number;
  slots_per_hour: number;
  limit_per_slot: number;
}

/** reservation_json 의 키 전부 */
export interface Reservation {
  id: number;
  booth_id: number;
  name: string;
  gender: Gender;
  age_group: string;
  code: string;
  slot: string;
  status: ReservationStatus;
  created_at: number; // UNIX 초
}

export interface StatsRow {
  age_group: string;
  male: number;
  female: number;
  total: number;
}
export interface Stats {
  rows: StatsRow[];
  male: number;
  female: number;
  total: number;
}
export type StatsMode = "simple" | "strict";

export interface ExportRow {
  slot: string;
  name: string;
  gender: Gender;
  age_group: string;
  code: string;
  status: ReservationStatus;
  created_at: number; // UNIX 초
}
export interface ExportData {
  booths: { booth_id: number; event_name: string; booth_name: string; rows: ExportRow[] }[];
}

/** GET /api/link/booth/<t> */
export interface BoothLinkPayload {
  booth: Booth;
  org: { name: string; slug: string };
  reservations: Reservation[];
  stats: Stats;
}

/** GET /api/link/partner/<t> */
export interface PartnerPayload {
  partner: { id: number; name: string };
  event: { id: number; name: string };
  org: { name: string; slug: string };
  booths: Booth[];
}

/** PATCH …/reservations/<rid> 응답. over_capacity 는 대기에서 정상으로 바꿔 정원을 넘길 때만 true. */
export interface SetStatusResult {
  reservation: Reservation;
  over_capacity?: true;
}
