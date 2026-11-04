import type { SessionUser } from "../api/types";

/** 기관 화면(대시보드)의 주소. 슈퍼관리자는 기관을 골라 들어가므로 기관별 주소, 그 밖에는 내 대시보드. */
export function orgHomePath(user: SessionUser, orgId: number): string {
  return user.is_superadmin ? `/manage/super/orgs/${orgId}` : "/manage";
}
