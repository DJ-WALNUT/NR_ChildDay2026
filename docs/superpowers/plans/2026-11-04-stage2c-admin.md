# 2-C 관리자 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/manage/*` 관리자 화면(로그인, 대시보드, 행사, 부스, 계정, 활동 기록, 기관 설정, 슈퍼관리자)을 완성해 1·2단계를 함께 배포할 수 있게 한다.

**Architecture:** `/manage/*` 경로 하나를 지연 로딩하는 `ManageApp`이 `AuthProvider`와 하위 `<Routes>`를 가진다. 그래서 방문객 첫 묶음은 늘지 않는다. API는 `src/api/admin.ts`에 모으고 서버 상태는 TanStack Query로 다룬다. 부스 상세는 기존 `BoothConsole`에 관리자용 `BoothSource`를 붙이고, 실적은 기존 `StatsPanel`을 재사용한다. 행사 화면은 로그인 계정의 기관이 아니라 `GET /events/<id>`가 돌려준 소유 기관을 기준으로 동작해서, 슈퍼관리자도 같은 화면으로 모든 행사를 연다.

**Tech Stack:** 2-B와 같음(React 19, React Router 7, TypeScript, Tailwind 4, TanStack Query 5, exceljs, qrcode.react, lucide-react, Vitest + Testing Library) + `jszip` 3.10.2(직접 의존성으로 추가, 지연 로딩).

**Spec:** `docs/superpowers/specs/2026-10-29-stage2-frontend-design.md`(이하 "스펙") 3·4.3·5·6절. API 계약: `../NR_ChildDay2026-BE/docs/superpowers/specs/2026-10-29-multitenant-design.md` 7절(이하 "API 스펙"). 인계: `docs/superpowers/handoff/2026-10-30-handoff.md`. 인증 참고: `../../walnutphoto/admin/src/auth/AuthProvider.tsx`.

## Global Constraints

- 작업 브랜치 `update`. 커밋 메시지 `[feat] …`/`[fix] …`/`[test] …`/`[chore] …`/`[docs] …` + 빈 줄 + 작성 모델의 Co-Authored-By 줄.
- 디자인 규칙은 2-B와 같고 `tests/design-rules.test.ts`가 강제한다: 토큰 색만(`src/index.css` 밖 hex/rgb 금지), 파랑 금지, 둥글기 4/6/8px(`rounded-sm/md/lg`), 크기 12/13/15/18/22/28px(관리자 화면 제목은 22px), 숫자 `tabular-nums`, 이모지·그라데이션·장식 그림자 금지, 아이콘은 `lucide-react`만, 버튼·입력 높이 44px 이상.
- 관리자 재료: 본문 `paper-2`, 사이드바 `ink`(`on-ink` 클래스로 포커스 외곽선 전환), 표, 탭(선택 탭 아래 노랑 4px), 도장. 색만 다른 통계 카드와 큰 둥근 카드를 만들지 않는다. 숫자 요약은 한 줄 `dl`로 쓴다.
- 화면 문구는 해요체. 서버 오류는 `messageFor`/`fieldErrors`로만 표시한다.
- 쿼리 키는 전부 `adminKeys`(Task 2). 변경 후 관련 키를 무효화한다.
- 관리자 코드를 `src/routes.tsx`에서 정적으로 import하지 않는다. `npm run build`의 `check-chunks`(방문객 첫 묶음 400KB 미만, 직원 라이브러리 혼입 금지)가 계속 통과해야 한다.
- 시각은 UNIX 초이고 KST로 표시한다(`formatKst`, `src/lib/excel.ts`).
- 각 태스크 끝에서 `npm test`, `npm run typecheck`, `npm run lint`가 모두 통과해야 한다.

### 코드 확인으로 정한 사항(스펙에 없음)

- **슈퍼관리자는 모든 행사에 접속한다(사용자 결정, 2026-11-04. 스펙 4.3을 넓힘).** 슈퍼관리자는 `org: null`이므로 기관 목록의 "행사 보기"로 `/manage/super/orgs/:orgId`(대시보드 재사용)에 들어가고, 거기서 `/manage/events/:id`와 `/manage/booths/:id`를 일반 계정과 같은 화면으로 쓴다. 비활성 기관 행사도 열린다. 활동 기록·기관 계정·기관 설정처럼 내 기관 전용 화면은 `RequireOrg`로 보호하고, 슈퍼관리자는 `/manage/super`로 보낸다.
- **백엔드 추가분(완료, pytest 208 passed).** `GET /api/admin/events/<id>` → `{event, org:{id,name,slug,logo_url}}`, `GET /api/admin/booths/<id>`에 `org:{name,slug}` 추가. 방문객 제한 키를 `reserve:{ip}:{booth_id}`, `lookup:{ip}:{booth_id}`로 변경(사용자 결정, 기본 횟수는 그대로이고 `VISITOR_*`·`LINK_MISS_*` 환경변수로 조정). API 스펙 7절 갱신 완료.
- **행사 화면의 기관은 항상 응답의 `org`를 쓴다.** `useOrg()`(로그인 계정 기관)를 행사·부스 화면에서 쓰지 않는다. 슈퍼관리자에게는 값이 없고, 있어도 다른 기관일 수 있다.
- **백업은 `api()`로 받을 수 없다**(JSON이 아니면 `bad_response`). `apiBlob()`을 추가한다. CORS가 `Content-Disposition`을 노출하지 않으므로 파일명은 프론트에서 만든다: `nrbooth-backup-YYYYMMDD-HHmm.db`.
- **연결 기관 부스의 방문객 주소**에는 주최 기관 slug가 필요하다. 관리자 어댑터는 `GET /booths/<id>` 응답의 `org.slug`를 쓴다.
- **`422 fields.rows`는 문자열일 수도, `{인덱스: 문구}` 객체일 수도 있다.** 그대로 렌더링하면 React가 죽는다. `bulkErrors()`로만 읽는다.
- **비밀번호 규칙:** 8자 이상, 아이디와 다름. **아이디:** `^[a-z0-9._-]{3,32}$`(서버가 소문자로 변환). **slug:** `^[a-z0-9][a-z0-9-]{1,31}$`, 예약어 `manage api b p reserve check assets login`. **표시 이름** 1~40자. 최종 판단은 서버 422이고 프론트는 그 문구를 필드에 표시한다.
- 부스 생성 기본값(서버): `mode time`, `start_hour 11`, `end_hour 16`, `slots_per_hour 3`, 정원 0(=무제한). `slots_per_hour`는 1~6, 시각은 `0 ≤ 시작 ≤ 종료 ≤ 23`.

## Review Focus

1. **공용 PC에서 로그아웃하거나 세션이 끊긴 뒤 다른 기관 계정으로 로그인** — 이전 기관의 행사·명단이 캐시로 잠깐이라도 보이면 안 된다. 로그아웃과 `nr:unauthorized`에서 `queryClient.clear()`. → Task 3 테스트.
2. **빈 줄이 낀 엑셀, 날짜형·수식 셀, 열 순서가 바뀐 양식, 501행** — 오류 행 번호는 항상 실제 엑셀 행과 같아야 하고 화면이 죽지 않는다. → Task 6 테스트.
3. **임시 비밀번호 복사 실패(클립보드 거부), 표시 중 목록 갱신** — 값은 닫기 전까지 화면에 남아 직접 복사할 수 있고, 쿼리 캐시에 남지 않는다. → Task 9 테스트.
4. **이름이 같은 부스, 파일명 금지 문자, 부스가 없는 행사의 묶음 내려받기** — zip 항목이 덮어써지지 않고, 빈 행사는 버튼이 잠긴다. → Task 7 테스트.
5. **연결 기관 사용자의 소유 전용 동작, 슈퍼관리자의 다른 기관 행사** — 연결 기관은 부스 상세에서 행사 이동·재발급·삭제가 보이지 않고 주최 행사 주소는 NotFound다. 슈퍼관리자가 연 행사의 링크·QR에는 슈퍼관리자 맥락이 아닌 소유 기관 slug가 들어간다. → Task 4·7·8 테스트.

---

## File Structure

```
src/api/client.ts            + apiBlob()
src/api/types.ts             + 관리자 타입
src/api/admin.ts             새로: 관리 API 함수 + adminKeys
src/api/messages.ts          + 파일 형식 문구 등
src/ui/Modal.tsx             새로: ConfirmDialog 에서 틀(초점 가두기·Esc·스크롤 잠금) 분리
src/ui/fields.tsx            + TextAreaField
src/ui/Tabs.tsx, DataTable   접근성 보강(2-B 리뷰 이월)
src/booth/BoothConsole.tsx   access·extraOwnActions 를 detail 함수로도 받기
src/booth/adminSource.ts     새로: 관리자용 BoothSource
src/lib/excel.ts             + safeFileName 공개, buildLinksWorkbook
src/lib/bulkBooths.ts        새로: 일괄 등록 양식·파싱·오류 매핑
src/lib/qrZip.ts             새로: QR 묶음 zip
src/manage/ManageApp.tsx     AuthProvider + 하위 Routes (지연 로딩 진입점)
src/manage/auth/             AuthProvider, guards(RequireAuth·RequireOrg·RequireSuper), safeNext, LoginPage, PasswordPage
src/manage/AdminLayout.tsx   잉크 사이드바 + 본문, 휴대폰 접힘 메뉴
src/manage/DashboardPage.tsx
src/manage/event/            EventPage, BoothsTab, BulkImport, PartnersTab, StatsTab, LinksTab, SettingsTab
src/manage/booth/            BoothPage, OwnerActions
src/manage/account/          AccountPage, MembersPage, MembersPanel, TempPasswordDialog
src/manage/ActivityPage.tsx, ActivityList.tsx, OrgPage.tsx, LogoField.tsx
src/manage/super/            SuperPage, SuperOrgMembersPage
tests/manage-*.test.tsx      태스크별 테스트
```

---

### Task 1: UI 부품 보강과 2-B 리뷰 이월 항목

**Files:**
- Create: `src/ui/Modal.tsx`
- Modify: `src/ui/ConfirmDialog.tsx`, `src/ui/Tabs.tsx`, `src/ui/DataTable.tsx`, `src/ui/fields.tsx`, `src/ui/index.ts`, `src/links/BoothLinkPage.tsx`, `src/links/PartnerBoothPage.tsx`, `src/links/PartnerPage.tsx`, `src/booth/BoothConsole.tsx`
- Test: `tests/ui.test.tsx`, `tests/booth.test.tsx`, `tests/partner.test.tsx`

**Interfaces:**
- Produces:
  - `Modal({ title, describedBy?, onClose, initialFocus?, children, width?: "sm" | "md" })`: `role="dialog"`, 초점 가두기, Esc(한글 조합 중 무시), 스크롤 잠금, 닫을 때 초점 복귀. `ConfirmDialog`는 이 틀 위에 다시 만든다(기존 테스트 유지).
  - `Tabs`에 선택 prop `idBase?: string`. 있으면 탭 `id=${idBase}-tab-${id}`, `aria-controls=${idBase}-panel-${id}`. `TabPanel({ idBase, id, children })`: `role="tabpanel"`, `aria-labelledby`, `tabIndex={0}`.
  - `DataTable`에 선택 prop `caption?: string`(화면에는 `sr-only`). 가로 스크롤 영역에 `tabIndex={0}`, `role="region"`, `aria-label={caption}`(caption이 있을 때만).
  - `TextAreaField`: `TextField`와 같은 props 규칙(`label`, `error`, `hint`).
  - `BoothConsole` props 변경: `access: BoothAccess | ((d: BoothDetail) => BoothAccess)`, `extraOwnActions?: ReactNode | ((d: BoothDetail) => ReactNode)`. `BoothAccess = "own" | "manage"`를 `BoothSource.ts`에서 내보낸다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/ui.test.tsx`:
  - `Tabs`: `idBase="t"`일 때 탭의 `aria-controls`가 `t-panel-a`, Home 키는 첫 탭, End 키는 마지막 탭을 선택하고 초점을 옮긴다.
  - `TabPanel`: `getByRole("tabpanel", { name: "가" })`로 찾힌다.
  - `DataTable caption="부스 목록"`: `getByRole("table", { name: "부스 목록" })`, `getByRole("region", { name: "부스 목록" })`에 `tabindex="0"`.
  - `Modal`: Esc로 `onClose`, 닫으면 여는 버튼으로 초점 복귀.
  - `tests/booth.test.tsx`: `access={() => "own"}` + `extraOwnActions={(d) => <p>{d.booth.name} 추가</p>}`이면 문구가 보이고, `() => "manage"`이면 안 보인다.
  - `tests/partner.test.tsx`: `/p/:token`, `/b/:token` 화면에 `getByRole("main")`이 있고 `heading level 1`이 정확히 하나다. 오류·NotFound 상태도 포함한다.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/ui.test.tsx tests/booth.test.tsx tests/partner.test.tsx` → 새 테스트 FAIL.
- [ ] **Step 3: 구현** — 위 Interfaces대로. `<main>`은 `BoothConsole` 밖의 페이지(`BoothLinkPage`, `PartnerBoothPage`, `PartnerPage`)가 감싼다. 관리자 레이아웃이 이미 `<main>`을 가지므로 Console 안에는 넣지 않는다. `idBase` 없는 `Tabs`(StatsPanel의 합계 전환)는 지금처럼 동작한다.
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run lint` → 모두 통과.
- [ ] **Step 5: 커밋** — `[fix] 탭·표·현장 화면 접근성 보강과 대화상자 틀 분리`

### Task 2: 관리 API 계층과 관리자 BoothSource

**Files:**
- Create: `src/api/admin.ts`, `src/booth/adminSource.ts`
- Modify: `src/api/client.ts`, `src/api/types.ts`, `src/api/messages.ts`
- Test: `tests/api.test.ts`, `tests/admin-api.test.ts`

**Interfaces:**
- Produces (타입, `src/api/types.ts`):
  ```ts
  interface SessionUser { id: number; username: string; display_name: string; org_id: number | null; is_superadmin: boolean; must_change_password: boolean }
  interface SessionOrg { id: number; name: string; slug: string; logo_url: string | null }
  interface MeResponse { user: SessionUser; csrf: string; org: SessionOrg | null }
  interface Member { id: number; username: string; display_name: string; is_active: boolean; must_change_password: boolean; last_login_at: number | null; created_at: number }
  interface AdminEvent { id: number; name: string; created_at: number; booth_count: number; partner_count: number; logo_url: string | null; notice: string | null }
  interface Partner { id: number; name: string; linked_org: { id: number; name: string } | null; access_token: string; booth_count: number }
  interface Overview { org: { id: number; name: string; slug: string }; owned: { event: { id: number; name: string }; booths: Booth[] }[]; linked: { partner: { id: number; name: string }; event: { id: number; name: string }; host: { id: number; name: string }; booths: Booth[] }[]; totals: { today: number; total: number; active_booths: number; booths: number } }
  interface AuditItem { id: number; org_id: number | null; actor_org_id: number | null; user_id: number | null; actor: string; actor_label: string; action: string; target: string | null; summary: string; detail: unknown; at: number }
  interface AuditPage { items: AuditItem[]; next_before: number | null }
  interface SuperOrg { id: number; name: string; slug: string; is_active: boolean; created_at: number; user_count: number; event_count: number }
  ```
- Produces (`src/api/client.ts`): `apiBlob(path: string): Promise<Blob>`. 오류 처리는 `api()`와 같아야 하므로 응답 실패 처리를 내부 함수로 뽑아 함께 쓴다.
- Produces (`src/api/admin.ts`): API 스펙 7.2·7.3·7.5의 모든 경로에 함수 하나씩. 이름 규칙은 `동사+자원`이고 반환은 봉투를 벗긴 값이다(`createEvent(orgId, name): Promise<AdminEvent>`, `listBooths(eventId): Promise<Booth[]>`). 이후 태스크가 쓰는 이름:
  `getMe login logout changePassword` · `listMembers createMember(orgId, {username, display_name}) → {user, temp_password} updateMember(id, {display_name?, is_active?}) resetMemberPassword(id) → {temp_password}` · `getOverview listEvents getEvent(id) → {event, org: SessionOrg} createEvent updateEvent(id, {name?, notice?}) deleteEvent uploadEventLogo(id, file) removeEventLogo uploadOrgLogo(orgId, file) removeOrgLogo` · `listPartners createPartner(eventId, {name, linked_org_id?}) updatePartner(id, {name?, linked_org_id?}) deletePartner rotatePartnerToken listLinkTargets(orgId)` · `listBooths createBooth(eventId, settings) bulkCreateBooths(eventId, rows) → {created} getBooth updateBooth(id, Partial<BoothSettings> & {event_id?: number; partner_id?: number | null}) deleteBooth toggleBooth batchBoothStatus(ids, is_active) rotateBoothToken listReservations setReservationStatus deleteReservation clearReservations adminStats(ids, mode) adminExport(ids)` · `listAudit(orgId, {before?, action?})` · `listSuperOrgs createSuperOrg updateSuperOrg listSuperAudit({before?, action?, org_id?}) downloadBackup(): Promise<Blob> whoamiIp`.
- Produces: `adminKeys = { overview(orgId), events(orgId), event(id), booths(eventId), partners(eventId), linkTargets(orgId), members(orgId), audit(scope, action), superOrgs() }`, 전부 `["admin", …]`로 시작한다. `adminBoothSource(boothId: number | string): BoothSource`, `key = ["admin", "booth", id]`.

- [ ] **Step 1: 실패하는 테스트 작성** — `fetch` 모의로:
  - `apiBlob`: 200 `application/octet-stream`이면 Blob을 돌려준다. 401이면 `nr:unauthorized`를 일으키고 `ApiError(401)`.
  - `uploadEventLogo(1, file)`: `PUT /api/admin/events/1/logo`, 본문이 `FormData`이고 필드 이름 `file`, `X-CSRF-Token` 포함.
  - `updateEvent(1, { notice: null })`: 본문이 정확히 `{"notice":null}`.
  - `listAudit(1, { before: 9, action: "booth" })`: 경로가 `/api/admin/orgs/1/audit?before=9&action=booth`. 인자가 없으면 쿼리가 없다.
  - `adminBoothSource(7).get()`: `GET /api/admin/booths/7` 응답의 `booth`, `org`와 명단, 통계를 합친다. `/api/public/` 경로는 부르지 않는다.
  - `adminBoothSource(7).exportData()`: `POST /api/admin/export` 본문 `{booth_ids:[7]}`.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/api.test.ts tests/admin-api.test.ts` → FAIL.
- [ ] **Step 3: 구현** — `getBooth(id)`는 `{ booth, org }`를 돌려준다. `messages.ts`에 `method_not_allowed`, `http_413`("파일이 너무 커요.")를 추가한다.
- [ ] **Step 4: 통과 확인** — 같은 명령 + `npm run typecheck` → PASS.
- [ ] **Step 5: 커밋** — `[feat] 관리 API 클라이언트와 관리자용 부스 어댑터`

### Task 3: 인증과 관리자 진입 구조

**Files:**
- Create: `src/manage/ManageApp.tsx`, `src/manage/auth/AuthProvider.tsx`, `src/manage/auth/guards.tsx`, `src/manage/auth/safeNext.ts`, `src/manage/auth/LoginPage.tsx`, `src/manage/auth/PasswordPage.tsx`
- Modify: `src/routes.tsx`, `tests/app.test.tsx`
- Test: `tests/manage-auth.test.tsx`

**Interfaces:**
- Consumes: `getMe`, `login`, `logout`, `changePassword`, `setCsrf`.
- Produces:
  - `useAuth(): { user: SessionUser | null; org: SessionOrg | null; loading: boolean; login(username, password): Promise<void>; logout(): Promise<void>; refresh(): Promise<void> }`
  - `RequireAuth`, `RequireOrg`, `RequireSuper`(children 래퍼)
  - `useOrg(): SessionOrg`: `RequireOrg` 안에서만 쓰고 null이 아니다.
  - `safeNext(raw: string | null): string`
  - `ManageApp`의 하위 `<Routes>`: 이후 태스크는 여기에 경로를 추가한다. 이 태스크에서는 `/manage/login`, `/manage/password`, 빈 자리표시 `/manage`만 만든다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/manage-auth.test.tsx`(`createMemoryRouter(routes)` + `vi.mock("../src/api/admin")`):
  - `safeNext` 사례표: `"/manage/events/1?tab=stats"` 통과. `null`, `"https://evil.example"`, `"//evil.example"`, `"/\\evil.example"`, `"/manage//evil.example"`, `"/managex"`, `"/nareum"` → `"/manage"`.
  - 미로그인으로 `/manage/events/1?tab=stats` 진입 → `/manage/login?next=…`로 이동. 로그인 성공 → 원래 주소로 복귀.
  - `next=//evil.example`로 로그인 → `/manage`.
  - 틀린 비밀번호 → "아이디 또는 비밀번호가 맞지 않아요." 표시, 입력값 유지.
  - `must_change_password` 사용자가 `/manage` 진입 → `/manage/password`. 변경 성공 후 `refresh`가 불리고 `/manage`로 이동. 변경 전에는 다른 화면으로 못 나가지만 로그아웃은 가능하다.
  - 비밀번호 변경 422 `fields.current`·`fields.new`가 각 입력란에 표시된다. 새 비밀번호 확인이 다르면 서버를 부르지 않고 "새 비밀번호가 서로 달라요."를 표시한다.
  - `RequireOrg`: `org: null` 슈퍼관리자가 `/manage` 진입 → `/manage/super`. `RequireSuper`: 일반 계정 → `/manage`.
  - **Review Focus 1:** 쿼리 캐시에 `["admin","overview",1]`을 넣고 `logout()` 후 `queryClient.getQueryCache().getAll()`이 빈 배열. `nr:unauthorized` 이벤트 후에도 빈 배열이고 `/manage/login?next=`로 이동한다.
  - `getMe`가 401이면 로그인 화면, 네트워크 오류면 "다시 시도"가 있는 오류 화면(로그인 화면으로 보내지 않음).
  - `tests/app.test.tsx`: `/manage`의 placeholder 단언을 "기관 화면이 아니고 로그인 화면으로 간다"로 바꾼다.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/manage-auth.test.tsx tests/app.test.tsx` → FAIL.
- [ ] **Step 3: 구현** — `routes.tsx`의 `/manage/*`를 `lazy: () => import("./manage/ManageApp")` + `HydrateFallback: StaffFallback`으로 바꾸고 `Placeholder`를 지운다. `AuthProvider`는 walnutphoto의 구조를 따르되 이벤트 이름은 `nr:unauthorized`이고 `useQueryClient().clear()`를 함께 호출한다. 로그인·비밀번호 화면은 `PageFrame surface="paper-2" width="narrow"`, `<main>` + `h1`, 입력은 `autoComplete="username"`/`"current-password"`/`"new-password"`. 로그인 전 상태에서 `/manage/login`이 `getMe`의 401로 다시 이동하지 않게 한다(`auth/me`는 조용한 경로).
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run lint && npm run build` → 통과, `check-chunks` 합계가 현재(약 353KB) 수준.
- [ ] **Step 5: 커밋** — `[feat] 관리자 로그인·비밀번호 변경·접근 보호`

### Task 4: 관리자 레이아웃, 대시보드, 행사 화면 뼈대와 부스 탭

**Files:**
- Create: `src/manage/AdminLayout.tsx`, `src/manage/DashboardPage.tsx`, `src/manage/event/EventPage.tsx`, `src/manage/event/BoothsTab.tsx`
- Modify: `src/manage/ManageApp.tsx`
- Test: `tests/manage-event.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `useOrg`, `getOverview`, `getEvent`, `createEvent`, `listBooths`, `createBooth`, `batchBoothStatus`, `adminKeys`, `DataTable`, `Tabs`/`TabPanel`, `Stamp`.
- Produces:
  - `AdminLayout({ children })`: 메뉴는 org 계정이면 `대시보드 /manage`, `활동 기록 /manage/activity`, `기관 계정 /manage/members`, `기관 설정 /manage/org`, `내 계정 /manage/account`. 슈퍼관리자면 `슈퍼관리자 /manage/super`, `내 계정 /manage/account`. 그 밖에 로그아웃. 현재 메뉴는 `aria-current="page"` + `ink-2` 바탕.
  - `DashboardBody({ orgId: number })`: 대시보드 본문. `DashboardPage`(`useOrg().id`)와 슈퍼관리자 화면(Task 11)이 함께 쓴다.
  - `adminKeys.event(id)`, 쿼리 함수 `getEvent(id)`. 404면 NotFound.
  - `EventPage`의 탭 id: `booths | partners | stats | links | settings`, 주소 `?tab=`으로 보존(잘못된 값은 `booths`). 탭 내용은 `{ event: AdminEvent; org: SessionOrg }` props를 받는 컴포넌트이며 Task 5~7이 채운다. 여기서 `org`는 `getEvent` 응답의 소유 기관이다. `/manage/events/:id`는 `RequireOrg` 밖에 둔다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/manage-event.test.tsx`:
  - 대시보드: 내 행사 이름과 `운영 중 1 / 전체 3`, 전체 수치 `dl`(오늘 신청·전체 신청·운영 중 부스·전체 부스), 참가한 연합 행사에 `주최 기관 · 운영 단체` 이름과 부스 링크 `/manage/booths/:id`. 행사가 없으면 빈 상태 안내 + 만들기 입력.
  - 행사 만들기: 이름 입력 → `createEvent(orgId, name)` → `/manage/events/:id`로 이동. 422 문구가 입력란에 표시된다.
  - 행사 화면: `?tab=stats` 진입 시 실적 탭이 선택되고, 탭을 누르면 주소가 바뀐다. `?tab=zzz`는 부스 탭.
  - **Review Focus 5:** `getEvent`가 404(주최 행사 포함) → "찾을 수 없어요". 슈퍼관리자(`org: null`)도 행사 화면이 열리고 상단에 소유 기관 이름이 보이며, 돌아가기 링크는 `/manage/super/orgs/<org.id>`다. 일반 계정의 돌아가기 링크는 `/manage`.
  - 부스 탭: 목록에 번호·이름·방식·신청 수·`Stamp`(운영 중/마감)·상세 링크. 전체 선택 체크박스, 2개 선택 후 "운영 시작" → `batchBoothStatus([1,2], true)` → `adminKeys.booths` 무효화 → 선택 해제. 선택 없음이면 일괄 버튼이 잠긴다. 실패(404)하면 오류 안내 + 선택 유지.
  - 부스 추가: 이름만 입력 → `createBooth(eventId, { name })` → 목록 갱신. 빈 이름 422 표시.
  - 휴대폰 메뉴: 메뉴 버튼 `aria-expanded` 전환, 메뉴 링크를 누르면 닫힌다.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/manage-event.test.tsx` → FAIL.
- [ ] **Step 3: 구현** — 대시보드 행사 행은 표(`DataTable`)로 만든다. 부스 표 번호는 `Stub`이 아니라 숫자 열이다. 부스 추가 폼은 이름 한 칸이고 상세 설정은 부스 상세의 `SettingsForm`에서 한다. `useDocumentTitle`로 화면 제목을 지정한다. `lg` 미만에서 사이드바는 상단 막대 + 접힘 메뉴로 바뀐다.
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run lint` → 통과.
- [ ] **Step 5: 커밋** — `[feat] 관리자 레이아웃·대시보드·행사 부스 탭`

### Task 5: 행사 설정 탭과 로고 입력

**Files:**
- Create: `src/manage/LogoField.tsx`, `src/manage/event/SettingsTab.tsx`
- Modify: `src/manage/event/EventPage.tsx`
- Test: `tests/manage-settings.test.tsx`

**Interfaces:**
- Consumes: `updateEvent`, `deleteEvent`, `uploadEventLogo`, `removeEventLogo`, `TextAreaField`, `ConfirmDialog`(`requireText`).
- Produces: `LogoField({ label, logoUrl, upload(file: File): Promise<unknown>, remove(): Promise<unknown>, onChanged(): void })`. Task 10의 기관 설정이 재사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `LogoField`: 1MB(1,048,576바이트) 초과 파일은 서버를 부르지 않고 "1MB 이하 파일만 올릴 수 있어요."를 표시한다. `image/svg+xml`도 같은 방식으로 "PNG, JPG, WebP 파일만 올릴 수 있어요."를 표시한다. 정상 파일은 `upload` 후 `onChanged`. 서버 413·422는 문구를 표시한다. `logoUrl`은 `apiUrl()`을 붙여 `img`로 표시하고 대체 글자는 `label` 사용. 로고가 없으면 삭제 버튼이 없다. 같은 파일을 다시 고를 수 있게 입력값을 비운다.
  - 설정 탭: 이름·안내 문구 저장 → `updateEvent(id, { name, notice })`. 안내 문구를 비우면 `notice: null`. 글자 수 표시 `0/500`, 501자는 저장 잠금.
  - 삭제: 행사 이름을 정확히 입력해야 확인 버튼이 열리고, 본문에 `부스 N개와 모든 신청`이 들어간다. 성공 시 돌아가기 링크와 같은 곳으로 이동하고(슈퍼관리자는 `/manage/super/orgs/<org.id>`) `adminKeys.overview`·`events`를 무효화한다.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/manage-settings.test.tsx` → FAIL.
- [ ] **Step 3: 구현** — Interfaces대로. 파일 입력은 `accept="image/png,image/jpeg,image/webp"`.
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run lint` → 통과.
- [ ] **Step 5: 커밋** — `[feat] 행사 설정 탭과 로고 입력`

### Task 6: 부스 엑셀 일괄 등록

**Files:**
- Create: `src/lib/bulkBooths.ts`, `src/manage/event/BulkImport.tsx`
- Modify: `src/manage/event/BoothsTab.tsx`
- Test: `tests/bulk-booths.test.ts`, `tests/manage-bulk.test.tsx`

**Interfaces:**
- Produces (`src/lib/bulkBooths.ts`):
  ```ts
  const BULK_HEADERS = ["부스이름", "운영방식", "선착순 인원", "시작시각", "종료시각", "시간당 타임수", "타임당 인원", "대기자 접수"];
  const MAX_BULK = 500;
  interface BulkRow { sheetRow: number; body: Partial<BoothSettings> & { name: string } }
  type ParseResult = { rows: BulkRow[]; problems: { sheetRow: number; message: string }[] };
  function buildBulkTemplate(): Promise<ArrayBuffer>;
  function parseBulkWorkbook(data: ArrayBuffer): Promise<ParseResult>;
  function bulkErrors(err: unknown, rows: BulkRow[]): { sheetRow: number; message: string }[] | null;
  ```
- Consumes: `bulkCreateBooths`, `downloadBlob`, `Modal`.

스펙 6.4는 "엑셀 행 번호 = 인덱스 + 2"라고 적었다. 하지만 빈 줄을 건너뛰면 이 식이 틀어지므로 각 행이 실제 `sheetRow`를 들고 다니게 하고, 서버 인덱스는 `rows[index].sheetRow`로 바꾼다. 빈 줄이 없으면 결과는 인덱스 + 2와 같다.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/bulk-booths.test.ts`(exceljs로 파일을 만들어 다시 읽음):
  - 양식을 파싱하면 첫 줄 머리글이 `BULK_HEADERS`와 같고 예시 행은 `rows`에 들어가지 않는다(양식은 머리글만 담고 예시는 셀 메모로 넣는다).
  - `타임별`→`time`, `선착순`→`fcfs`, `Y`/`y`→`true`, `N`/빈칸→`false`.
  - 빈 칸은 키를 넣지 않는다(서버 기본값 사용). `부스이름`만 있는 행의 `body`는 `{ name }`.
  - **Review Focus 2:** 2행·4행에 값, 3행이 빈 줄 → `sheetRow` `[2, 4]`.
  - 열 순서를 바꾼 파일도 머리글 이름으로 읽는다. 머리글이 없거나 `부스이름` 열이 없으면 `problems`에 `sheetRow: 1`, "양식의 첫 줄을 확인해 주세요."
  - 시각 셀: 숫자 `10`, 문자열 `"10"`, `"10:00"`, `"10시"`, 시간 형식 Date 셀 → 모두 `10`. `"오전"` → `problems`에 해당 행 "시작시각을 숫자로 입력해 주세요."
  - 수식 셀 `{ formula, result: 12 }`은 `12`, 서식 텍스트 `{ richText }`은 이어 붙인 글자.
  - `운영방식`이 `상시` → `problems`에 행 번호와 "운영방식은 타임별 또는 선착순이에요."
  - 501행 → `problems`에 "한 번에 500개까지 등록할 수 있어요." 손상된 파일(임의 바이트) → 예외 대신 `problems`에 "엑셀 파일을 읽지 못했어요."
  - `bulkErrors`: `ApiError(422,"invalid",{rows:{"1":"1~100자로 입력하세요."}})` + `rows[1].sheetRow === 4` → `[{sheetRow:4,message:…}]`. `fields.rows`가 문자열이면 `sheetRow: 1`에 그 문구. 다른 오류는 `null`.
  - `tests/manage-bulk.test.tsx`: 업로드 → 미리보기 표(행 번호·이름·방식) → 등록 → `bulkCreateBooths(eventId, bodies)`에 `sheetRow`가 빠져 있고 성공 시 "부스 3개를 등록했어요." + 목록 무효화. `problems`가 있으면 등록 버튼이 잠긴다. 서버 422면 행 번호와 문구 목록을 표시하고 미리보기는 유지한다.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/bulk-booths.test.ts tests/manage-bulk.test.tsx` → FAIL.
- [ ] **Step 3: 구현** — exceljs는 `excel.ts`처럼 함수 안에서 `await import("exceljs")`. Date 셀의 시각은 `getUTCHours()`로 읽는다. 양식 파일명 `부스_일괄등록_양식.xlsx`.
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run lint` → 통과.
- [ ] **Step 5: 커밋** — `[feat] 부스 엑셀 일괄 등록`

### Task 7: 운영 단체·실적·링크 QR 탭

**Files:**
- Create: `src/manage/event/PartnersTab.tsx`, `src/manage/event/StatsTab.tsx`, `src/manage/event/LinksTab.tsx`, `src/lib/qrZip.ts`
- Modify: `src/lib/excel.ts`, `src/manage/event/EventPage.tsx`, `package.json`, `package-lock.json`
- Test: `tests/manage-partners.test.tsx`, `tests/qr-zip.test.ts`, `tests/excel.test.ts`

**Interfaces:**
- Consumes: `listPartners`, `createPartner`, `updatePartner`, `deletePartner`, `rotatePartnerToken`, `listLinkTargets`, `updateBooth`, `adminStats`, `adminExport`, `StatsPanel`, `renderQrPng`, `rosterFileName`.
- Produces:
  ```ts
  // excel.ts
  function safeFileName(s: string): string;   // 기존 stripName 을 이름만 바꿔 공개
  function buildLinksWorkbook(input: LinkSheetInput): Promise<ArrayBuffer>;
  interface LinkSheetInput { eventName: string; booths: { name: string; manage: string; reserve: string }[]; partners: { name: string; link: string }[] }
  // qrZip.ts
  interface QrEntry { fileName: string; value: string; title: string; subtitle: string }
  function qrEntries(input: LinkSheetInput): QrEntry[];
  function buildQrZip(entries: QrEntry[], onProgress?: (done: number, total: number) => void): Promise<Blob>;
  ```

- [ ] **Step 1: 실패하는 테스트 작성**
  - `qrEntries`: 부스 2개·단체 1개 → `01_부스명_방문객신청.png`, `01_부스명_부스관리.png`, `02_…`, `운영단체_01_청년부_실적.png`. 부스가 100개 이상이면 번호는 3자리.
  - **Review Focus 4:** 이름이 같은 부스 2개 → 파일명이 모두 다르다. `a/b:c`는 금지 문자가 빠진다.
  - `buildQrZip`(`renderQrPng` 모의): `JSZip.loadAsync`로 다시 읽어 항목 수가 일치하고 `onProgress`의 마지막 호출이 `(n, n)`.
  - `buildLinksWorkbook`: 시트 `부스 링크`(행사·부스·부스 관리 링크·방문객 신청 링크), `운영 단체 링크`(운영 단체가 없으면 시트 없음).
  - 운영 단체 탭: 연결 기관 목록은 `listLinkTargets(org.id)`(소유 기관 기준). 만들기(이름 + 연결 기관 선택 또는 "연결 안 함") → `createPartner`. 이름·연결 변경 → `updatePartner`. 연결 해제는 `linked_org_id: null`. 실적 링크 표시 + `/p/<token>` QR 내려받기. 재발급은 확인 대화상자(이전 링크가 끊긴다고 안내) → `rotatePartnerToken`. 삭제 대화상자 본문에 "배정된 부스 N개는 미배정이 돼요".
  - 부스 배정: 부스별 선택 상자(미배정/단체명) → `updateBooth(id, { partner_id })`, 미배정은 `partner_id: null`. 실패하면 오류 안내 후 이전 값 표시.
  - 실적 탭: 부스 0개면 빈 상태. `StatsPanel`에 `key={event.id}`, 파일명 `rosterFileName("event", event.name)`, `adminStats`·`adminExport` 연결.
  - 링크·QR 탭: 부스 0개면 두 버튼이 잠기고 안내가 나온다. 진행 표시 `QR 만드는 중 3/10`(`aria-live`). 실패 시 오류 표시 후 버튼 복구. 주소는 `window.location.origin` + `/b/<manage_token>`, `/<org.slug>/reserve/<id>`, `/p/<access_token>`이고, **Review Focus 5:** 슈퍼관리자로 열어도 `org.slug`는 탭에 넘어온 소유 기관 값이다. 파일명 `[행사]_QR.zip`, `[행사]_링크.xlsx`.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/manage-partners.test.tsx tests/qr-zip.test.ts tests/excel.test.ts` → FAIL.
- [ ] **Step 3: 구현** — `npm install jszip@3.10.2`. `qrZip.ts`는 함수 안에서 `await import("jszip")`. QR은 동시에 만들지 말고 하나씩 순서대로 만든다(캔버스 메모리). `scripts/check-chunks.mjs`의 `MARKERS`에 `"JSZip"`을 추가한다.
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run lint && npm run build` → 통과.
- [ ] **Step 5: 커밋** — `[feat] 운영 단체·실적·링크 QR 탭`

### Task 8: 부스 상세

**Files:**
- Create: `src/manage/booth/BoothPage.tsx`, `src/manage/booth/OwnerActions.tsx`
- Modify: `src/manage/ManageApp.tsx`
- Test: `tests/manage-booth.test.tsx`

**Interfaces:**
- Consumes: `adminBoothSource`, `BoothConsole`, `useAuth`, `listEvents`, `listPartners`, `updateBooth`, `rotateBoothToken`, `deleteBooth`.
- Produces: `boothAccess(booth: Booth, user: SessionUser, org: SessionOrg | null): BoothAccess`, 스펙 5절 규칙 `booth.org_id === org?.id || user.is_superadmin` → `own`, 아니면 `manage`.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `boothAccess` 사례표(소유 기관 / 슈퍼관리자 / 연결 기관).
  - **Review Focus 5:** 연결 기관 사용자는 "행사 이동", "운영 단체 배정", "링크 재발급", "부스 삭제"가 없고 명단·설정·QR은 보인다.
  - 소유 사용자: 행사 이동 → `updateBooth(id, { event_id })`, 확인 대화상자에 "운영 단체 배정이 해제돼요". 행사 목록은 `listEvents(booth.org_id)`이고 현재 행사는 제외한다. 다른 행사가 없으면 이동 영역이 잠긴다.
  - 배정 변경 → `updateBooth(id, { partner_id })`. 옵션은 `listPartners(booth.event_id)` + 미배정.
  - 재발급: 확인 후 `rotateBoothToken`, 콘솔 쿼리 무효화로 QR이 새 주소가 된다.
  - 삭제: 부스 이름을 입력해야 열리고 성공 시 `/manage/events/<event_id>`로 이동한다. 연결 기관이 아닌 경우에만 해당한다.
  - 없는 부스(404) → NotFound, 자동 갱신 멈춤. 상단에 행사로 돌아가는 링크가 있다(`own`일 때 `/manage/events/:id`, 아니면 `/manage`). 슈퍼관리자는 다른 기관 부스에서도 `own`이다.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/manage-booth.test.tsx` → FAIL.
- [ ] **Step 3: 구현** — `source`는 `useMemo`로 `boothId`마다 고정한다. `BoothConsole`에 `access={(d) => boothAccess(d.booth, user, org)}`, `extraOwnActions={(d) => <OwnerActions booth={d.booth} source={source} />}`를 넘긴다.
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run lint` → 통과.
- [ ] **Step 5: 커밋** — `[feat] 관리자 부스 상세와 소유자 동작`

### Task 9: 내 계정과 기관 계정

**Files:**
- Create: `src/manage/account/AccountPage.tsx`, `src/manage/account/MembersPage.tsx`, `src/manage/account/MembersPanel.tsx`, `src/manage/account/TempPasswordDialog.tsx`
- Modify: `src/manage/ManageApp.tsx`, `src/manage/auth/PasswordPage.tsx`
- Test: `tests/manage-account.test.tsx`

**Interfaces:**
- Consumes: `listMembers`, `createMember`, `updateMember`, `resetMemberPassword`, `changePassword`, `Modal`.
- Produces: `MembersPanel({ orgId: number; selfId: number })`(Task 11 재사용), `TempPasswordDialog({ username, password, onClose })`, `PasswordForm({ onDone })`(`PasswordPage`에서 분리해 내 계정에서도 사용).

- [ ] **Step 1: 실패하는 테스트 작성**
  - 내 계정: 표시 이름 저장 → `updateMember(user.id, { display_name })` → `refresh`. 비밀번호 변경 폼 재사용.
  - 목록: 아이디·표시 이름·상태(`Stamp` 대신 글자 "활성"/"비활성"/"비밀번호 변경 전")·마지막 접속(없으면 "접속 전").
  - 발급: `createMember` → 임시 비밀번호 대화상자. `username_taken`은 아이디 입력란에 표시. 422 `fields.username`·`display_name` 표시.
  - 초기화: 확인 대화상자(기존 세션이 끊긴다고 안내) → 대화상자 표시.
  - **Review Focus 3:** `navigator.clipboard.writeText`가 거부되면 "직접 복사해 주세요."를 표시하고 값은 읽기 전용 입력란에 선택된 채 남는다. 복사 성공 시 "복사했어요". 임시 비밀번호가 표시된 동안 `adminKeys.members`를 무효화해도 대화상자가 유지된다. 닫은 뒤 쿼리 캐시 어디에도 `temp_password` 값이 없다(`JSON.stringify(getQueryCache().getAll().map(q => q.state.data))`에 값이 포함되지 않음).
  - 대화상자는 "이 화면을 닫으면 다시 볼 수 없어요."를 표시한다.
  - 내 행: 비활성화·초기화 버튼이 없다. `last_active_user` 409는 문구 표시. 활성화·비활성화 후 목록 무효화.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/manage-account.test.tsx` → FAIL.
- [ ] **Step 3: 구현** — 임시 비밀번호는 `useMutation`의 `onSuccess`에서 컴포넌트 `useState`로만 옮긴다. `useMutation`의 결과가 뮤테이션 캐시에 남지 않게 `gcTime: 0`을 주고 닫을 때 `reset()`한다. 표시 글꼴도 프리텐다드를 쓰되 `tabular-nums`로 혼동을 줄인다.
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run lint` → 통과.
- [ ] **Step 5: 커밋** — `[feat] 내 계정과 기관 계정 관리`

### Task 10: 활동 기록과 기관 설정

**Files:**
- Create: `src/manage/ActivityList.tsx`, `src/manage/ActivityPage.tsx`, `src/manage/OrgPage.tsx`
- Modify: `src/manage/ManageApp.tsx`
- Test: `tests/manage-activity.test.tsx`

**Interfaces:**
- Consumes: `listAudit`, `uploadOrgLogo`, `removeOrgLogo`, `LogoField`, `useInfiniteQuery`.
- Produces: `ActivityList({ queryKey: unknown[]; load(p: { before?: number; action?: string }): Promise<AuditPage> })`(Task 11 재사용).

- [ ] **Step 1: 실패하는 테스트 작성**
  - 시각(KST)·행위자(`actor_label`)·`summary`가 최신순으로 표시된다.
  - 종류 필터 옵션과 접두사: 전체(없음), 로그인·비밀번호 `auth`, 계정 `user`, 행사 `event`, 부스 `booth`, 운영 단체 `partner`, 신청 `reservation`, 내려받기 `export`, 기관 `org`. 필터를 바꾸면 처음부터 다시 받는다.
  - `next_before`가 있으면 "더 보기" → `load({ before })`로 이어 붙인다. `null`이면 버튼이 없다. 추가 로드 실패 시 받은 목록을 유지하고 오류와 "다시 시도"를 표시한다.
  - 빈 결과는 빈 상태 문구.
  - 기관 설정: 기관 이름·주소(`/<slug>`) 표시, 로고 변경 후 `refresh()` 호출(`auth/me`의 `org.logo_url` 갱신).
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/manage-activity.test.tsx` → FAIL.
- [ ] **Step 3: 구현** — Interfaces대로. 기록은 `DataTable`로 표시하고 `summary`는 줄바꿈을 허용한다.
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run lint` → 통과.
- [ ] **Step 5: 커밋** — `[feat] 활동 기록과 기관 설정`

### Task 11: 슈퍼관리자

**Files:**
- Create: `src/manage/super/SuperPage.tsx`, `src/manage/super/SuperOrgPage.tsx`, `src/manage/super/SuperOrgMembersPage.tsx`
- Modify: `src/manage/ManageApp.tsx`
- Test: `tests/manage-super.test.tsx`

**Interfaces:**
- Consumes: `listSuperOrgs`, `createSuperOrg`, `updateSuperOrg`, `listSuperAudit`, `downloadBackup`, `whoamiIp`, `DashboardBody`, `MembersPanel`, `ActivityList`, `downloadBlob`.
- Produces: 경로 `/manage/super`(탭 `orgs | activity | system`, `?tab=`로 보존), `/manage/super/orgs/:orgId`(기관별 대시보드), `/manage/super/orgs/:orgId/members`.

- [ ] **Step 1: 실패하는 테스트 작성**
  - 기관 목록: 이름·주소·상태·계정 수·행사 수·행사 보기·계정 관리 링크. 비활성 기관도 행사 보기가 된다.
  - 기관별 대시보드: `/manage/super/orgs/2`에 기관 2의 `DashboardBody`, 제목에 기관 이름. 행사 만들기는 `createEvent(2, name)`. 없는 기관 id는 NotFound.
  - 생성: `createSuperOrg({ name, slug })`. `slug_taken`과 422 `fields.slug`가 입력란에 표시된다.
  - 수정: 주소(slug)를 바꾸면 확인 대화상자에 "기존 방문객 주소와 QR이 끊겨요". 이름만 바꾸면 대화상자 없음.
  - 비활성화: 확인 대화상자에 "소속 계정이 모두 로그아웃돼요" → `updateSuperOrg(id, { is_active: false })`.
  - 기관별 계정: `/manage/super/orgs/2/members`에 `MembersPanel orgId=2`. 없는 기관 id는 NotFound. 슈퍼관리자는 소속 계정이 아니므로 모든 행에 동작 버튼이 있다.
  - 전체 활동 기록: 기관 필터 `org_id` 전달.
  - 백업: 버튼 → `downloadBackup` → `downloadBlob(…, /^nrbooth-backup-\d{8}-\d{4}\.db$/, "application/octet-stream")`. 처리 중 버튼 잠금, 실패 시 오류 표시.
  - 접속 IP: 버튼 → `remote_addr`, `x_forwarded_for`(없으면 "없음") 표시.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/manage-super.test.tsx` → FAIL.
- [ ] **Step 3: 구현** — Interfaces대로. 파일명 시각은 KST(`formatKst` 값에서 숫자만 추출). `orgId`로 기관을 찾을 때는 `listSuperOrgs` 결과를 쓴다.
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run lint` → 통과.
- [ ] **Step 5: 커밋** — `[feat] 슈퍼관리자 화면`

### Task 12: 실제 동작·화면 확인과 문서

**Files:**
- Create: `docs/verification/2c/README.md`, `docs/verification/2c/*.png`
- Modify: `README.md`, `docs/superpowers/handoff/2026-10-30-handoff.md`(2-C 완료 상태와 남은 배포 절차)
- 임시 Playwright 스크립트는 저장소 밖 임시 폴더에 둔다.

**준비:** 시드에는 계정이 없다. 임시 `DATA_DIR`에서 `python scripts/seed_demo.py --out <DATA_DIR>/app.db` → `DATA_DIR=<임시> flask --app wsgi.py create-superadmin --username root --password <임시값>` → 인계 문서 7절 명령으로 백엔드(5005)와 프론트를 실행. 운영 DB 사본 `NR_ChildDay2026-BE/db/reservations.db`는 건드리지 않는다.

- [ ] **Step 1: 흐름 확인(Playwright, 실제 백엔드)**
  1. 슈퍼관리자 로그인 → 기관 목록 → nareum 계정 발급 → 임시 비밀번호 복사 → 로그아웃.
  2. 그 계정으로 첫 로그인 → 비밀번호 변경 강제 → 대시보드.
  3. 행사 만들기 → 부스 추가 → 엑셀 일괄 등록(정상 파일, 오류 파일) → 일괄 운영 시작.
  4. 운영 단체 만들기 → gmyouth 연결 → 부스 배정 → 실적 링크 열기.
  5. QR zip·링크 엑셀 내려받기 → zip을 풀어 QR 하나를 프로그램으로 디코딩.
  6. 방문객 신청 1건 → 부스 상세 명단 반영 → 노쇼·완료 → 실적·엑셀.
  7. gmyouth 계정 로그인 → 참가한 연합 행사 → 부스 상세('관리' 권한, 소유 동작 없음) → 주최 행사 주소 NotFound.
  7-1. 슈퍼관리자 로그인 → 기관 목록 → 행사 보기 → nareum 행사 → 부스 추가·링크·QR(주소가 `/nareum/…`) → 부스 상세 소유 동작. 주소를 새로고침해도 화면 유지. 비활성 기관 행사도 열림.
  8. 로고 업로드·삭제, 안내 문구가 방문객 화면에 표시되는지 확인.
  9. 활동 기록 필터·더 보기, 백업 내려받기, 접속 IP 확인.
  10. 세션 삭제 후 화면 조작 → 로그인으로 이동 → 원래 주소 복귀.

  Expected: 모든 단계 통과. 콘솔 오류 0건. 실패는 고친 뒤 `[fix]`로 커밋한다.
- [ ] **Step 2: 화면 확인** — 주요 화면(로그인, 대시보드, 행사 5개 탭, 부스 상세, 계정, 활동 기록, 슈퍼관리자)을 390px·1440px로 캡처해 `docs/verification/2c/`에 저장한다. 스펙 3절 규칙을 눈으로 검토한다. 40자 넘는 이름에서 가로 스크롤이 없어야 한다.
- [ ] **Step 3: 최종 검사** — `npm test && npm run typecheck && npm run lint && npm run build` → 전부 통과, `check-chunks` 400KB 미만. 백엔드 `python -m pytest -q` → 208 passed.
- [ ] **Step 4: 문서 갱신** — `docs/verification/2c/README.md`에 단계별 결과를, `README.md`에 관리자 화면 실행 방법을, 인계 문서에 2-C 완료와 남은 절차(운영 전환, 5절 결정 항목)를 적는다.
- [ ] **Step 5: 커밋** — `[test] 2-C 동작·화면 확인 기록`
