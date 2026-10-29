# 2-B 프론트 기반 + 방문객 + 현장 링크 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프론트엔드를 TypeScript 기반으로 새로 세우고, "현장 입장권" 디자인 시스템과 함께 방문객 화면(목록·신청·입장권)과 현장 링크 화면(부스 관리·운영 단체 실적)을 완성한다.

**Architecture:** React 19 + React Router 7 SPA. API 호출은 `src/api/client.ts` 한곳에서(쿠키·CSRF·오류 코드), 서버 상태는 TanStack Query. 디자인 값은 `src/index.css`의 Tailwind 4 `@theme` 토큰에만 존재하고, 화면은 `src/ui/` 부품을 조합한다. 부스 관리 화면은 `BoothConsole` 하나를 어댑터(`BoothSource`)로 재사용한다.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite(설치된 버전), Tailwind 4, TanStack Query 5, exceljs, qrcode.react, lucide-react, Vitest + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-29-stage2-frontend-design.md`(이하 "스펙"). API 계약: 백엔드 저장소 `../NR_ChildDay2026-BE/docs/superpowers/specs/2026-10-29-multitenant-design.md` 7절(이하 "API 스펙"). 둘 다 해당 절을 함께 읽는다.

## Global Constraints

- 작업 브랜치 `update`. 커밋 메시지 `[feat] …`/`[fix] …`/`[test] …`/`[chore] …`/`[docs] …` + 빈 줄 + 작성 모델의 Co-Authored-By 줄.
- 색은 스펙 3.1 토큰만: `ink #16181d`, `ink-2 #2a2d34`, `paper #f3efe4`, `paper-2 #f7f5ef`, `rule #d8d2c2`, `rule-2 #e3ddcf`, `muted #5b5a55`, `faint #8a8780`, `ticket #ffcc1a`, `stamp-red #c0402a`, `stamp-green #1f6f4a`, `stamp-amber #a15c00`. `src/index.css` 밖에서 hex/rgb 색 값 금지. 파랑 금지.
- 둥글기 4/6/8px 세 단계만(`rounded-sm`=4, `rounded-md`=6, `rounded-lg`=8로 토큰 재정의). `rounded-xl` 이상·임의값(`rounded-[…]`) 금지. 반원 홈(절취선 끝)만 `rounded-full` 허용.
- 글꼴 프리텐다드(500/700/800) 자체 호스팅. 크기 단계 12/13/15/18/22/28px만. 숫자는 `tabular-nums`.
- 이모지, 그라데이션, 장식 그림자 금지. 아이콘은 `lucide-react` 선 아이콘만.
- 버튼·입력 높이 44px 이상. 포커스: 종이 위 2px `ink` 외곽선(+2px 간격), 잉크 위 2px `ticket` 외곽선.
- API 주소: `import.meta.env.VITE_API_BASE`(기본 `""`), 모든 요청 `credentials: "include"`.
- 관리 API(`/api/admin/`)의 401만 `nr:unauthorized` 이벤트. `/api/public/`, `/api/link/`, `/api/admin/auth/login`, `/api/admin/auth/me`는 제외.
- 식별번호 규칙(서버와 동일): ASCII `0-9` 외의 숫자 문자(`/\p{Nd}/u`이지만 0-9가 아닌 것)가 있으면 오류, 그 밖의 문자는 제거 후 정확히 4자리. 이름: 앞뒤 공백 제거 1~50자.
- 화면 문구는 한국어 존댓말 해요체.
- 테스트: `npm test`(vitest run), 타입 검사 `npm run typecheck`, 빌드 `npm run build`. 모두 경고 없이 통과.

## Review Focus

1. **신청 직전에 부스가 마감·비활성으로 바뀜** — `409 full/closed` 문구를 보여주고 남은 자리를 즉시 다시 받아온다(빈 화면·오류 페이지 아님). → Task 5 테스트.
2. **`localStorage` 접근이 예외를 던지는 브라우저(사파리 사생활 보호 등)** — 신청·확인이 그대로 동작하고 입장권 보관만 생략. → Task 4 테스트.
3. **네트워크 실패(`fetch`가 throw)** — "연결이 불안정해요. 잠시 뒤 다시 시도해 주세요."와 다시 시도 버튼, 흰 화면 없음. → Task 3·5 테스트.
4. **잘못된 slug, 다른 기관의 부스 번호, 폐기된 링크 토큰** — 각각 친절한 "찾을 수 없어요" 화면(404). → Task 5·7 테스트.
5. **40자 넘는 한글 부스·행사 이름을 390px 화면에서** — 줄바꿈되고 가로 스크롤·잘림 없음. → Task 9 화면 확인 항목.

---

## File Structure

```
index.html                  제목·메타 갱신, 프리텐다드 preload
vite.config.ts              react 플러그인(VITEST 아닐 때만), vitest 설정, dev proxy /api → VITE_API_TARGET
tsconfig.json
.env.example                VITE_API_BASE, VITE_API_TARGET
public/fonts/               Pretendard-{Medium,Bold,ExtraBold}.woff2 + OFL.txt
src/main.tsx, src/App.tsx   QueryClientProvider + Router
src/routes.tsx              경로 표(스펙 4.1·4.2 + 관리자 자리표시)
src/index.css               @theme 토큰, @font-face, 기본 스타일, 포커스 규칙
src/ui/                     Button, TextField, SelectField, Choice(성별 등 버튼 선택), Ticket, Stub, Stamp,
                            Perforation, DataTable, Tabs, ConfirmDialog, Notice(안내·오류 띠), EmptyState,
                            Spinner, NotFound, PageFrame(바탕 재료별 레이아웃)
src/api/client.ts           api(), ApiError, setCsrf/getCsrf, apiUrl(), isNetworkError
src/api/messages.ts         오류 코드 → 문구
src/api/types.ts            공개·링크 응답 타입
src/api/public.ts           방문객 API 함수 + 쿼리 훅
src/api/link.ts             링크 API 함수
src/lib/identity.ts         normalizeName, normalizeCode
src/lib/slots.ts            slotSortKey, compareSlots, availabilitySummary
src/lib/ticketStore.ts      입장권 보관
src/lib/excel.ts            명단·실적 엑셀
src/lib/qr.ts               QR+라벨 PNG
src/booth/                  BoothConsole, BoothSource, linkSources, 하위 부품(RosterList, StatsTable, SettingsForm …)
src/visitor/                OrgPage, ReservePage, CheckPage, LegacyRedirect, RootPage
src/links/                  BoothLinkPage, PartnerPage, PartnerBoothPage
tests/setup.ts, tests/*.test.ts(x), tests/design-rules.test.ts
```

삭제: `src/pages/**`, `src/components/**`, `src/config.js`, `src/App.css`, `src/App.jsx`, `src/main.jsx`, `src/assets/{react.svg,vite.svg,hero.png}`, `public/terms.md`, `public/icons.svg`, `public/favicon.svg`(NR 파비콘은 유지), 의존성 `xlsx`·`@emnapi/*`.

---

### Task 1: 프로젝트 재구성, 토큰, 글꼴, 디자인 규칙 검사

**Files:**
- Create: `tsconfig.json`, `vite.config.ts`(기존 `.js` 대체), `.env.example`, `src/main.tsx`, `src/App.tsx`, `src/routes.tsx`, `src/index.css`(재작성), `public/fonts/*`, `tests/setup.ts`, `tests/app.test.tsx`, `tests/design-rules.test.ts`
- Modify: `package.json`(scripts·의존성), `index.html`, `eslint.config.js`(ts/tsx 대상), `.htaccess`(그대로 두되 확인)
- Delete: 위 File Structure의 삭제 목록

**Interfaces:**
- Produces:
  - 스크립트: `dev`, `build`(= `tsc --noEmit && vite build`), `test`(= `vitest run`), `typecheck`, `lint`.
  - Tailwind 토큰 클래스: `bg-ink`, `text-paper`, `border-rule`, `bg-ticket`, `text-stamp-red` … (Global Constraints의 12개 색), `rounded-sm/md/lg`(4/6/8), 글자 크기 `text-12/13/15/18/22/28`(각각 px), `font-sans`=Pretendard.
  - `src/routes.tsx`: `export const routes: RouteObject[]` — 이 태스크에서는 모든 경로가 자리표시 컴포넌트(`<Placeholder name="…"/>`), 이후 태스크가 교체. 경로: `/`, `/:slug`, `/:slug/reserve/:boothId`, `/:slug/check/:boothId`, `/reserve/:boothId`, `/check/:boothId`, `/b/:token`, `/p/:token`, `/p/:token/booths/:boothId`, `/manage/*`, `*`. `/manage`와 `/b`·`/p`·`/reserve`·`/check`가 `/:slug`보다 먼저 매칭되도록 정적 경로 우선.
  - `tests/design-rules.test.ts`: `src/**/*.{ts,tsx}`를 읽어 (a) `#[0-9a-fA-F]{3,8}\b`·`rgb(`·`hsl(` 금지, (b) `rounded-(xl|2xl|3xl|\[)` 금지, (c) 이모지(`\p{Extended_Pictographic}`) 금지, (d) `blue-`·`indigo-`·`sky-` 클래스 금지, (e) `shadow-`·`bg-gradient`·`from-`·`via-` 금지. 위반 시 파일·줄을 메시지에 담아 실패.

- [ ] **Step 1: 의존성 정리** — 제거: `xlsx @emnapi/core @emnapi/runtime @emnapi/wasi-threads`. 추가(정확한 버전으로 고정, `npm i -E`): 런타임 `@tanstack/react-query exceljs`, 개발 `typescript @types/react @types/react-dom vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event typescript-eslint`. vitest는 설치된 vite 메이저와 호환되는 최신 버전. `qrcode.react`, `lucide-react`, `react-router-dom`, `tailwindcss`, `@tailwindcss/postcss`는 유지. `postcss.config.js`·`tailwind.config.js`가 Tailwind 4에서 불필요하면 제거하고 `@tailwindcss/vite` 플러그인 또는 기존 postcss 방식 중 현재 동작하는 쪽 하나로 정리(보고서에 무엇을 택했는지 기록).
- [ ] **Step 2: 글꼴** — Pretendard 1.3.9 `woff2`(Medium 500, Bold 700, ExtraBold 800)를 공식 배포본(`https://github.com/orioncactus/pretendard` 릴리스 또는 npm `pretendard@1.3.9`의 `dist/web/static/woff2/`)에서 가져와 `public/fonts/`에 두고 `OFL.txt` 포함. `index.css`에 `@font-face`(`font-display: swap`).
- [ ] **Step 3: 실패하는 테스트 작성** — `tests/app.test.tsx`: `/`와 `/nareum` 경로를 `createMemoryRouter(routes)`로 렌더해 자리표시 이름이 보이는지, `/b/abc`가 `/:slug`로 잡히지 않는지. `tests/design-rules.test.ts`는 위 Interfaces 그대로.
- [ ] **Step 4: 실패 확인** — `npm test` → 모듈 없음/규칙 위반.
- [ ] **Step 5: 구현** — 위 Files·Interfaces대로. 기존 JS 화면 삭제. `index.html` 제목 "체험부스", `lang="ko"`, 기존 OG 메타 유지(이미지 `/og-image.png`).
- [ ] **Step 6: 통과 확인** — `npm test && npm run typecheck && npm run build && npm run lint` 모두 통과.
- [ ] **Step 7: 커밋** — `[chore] TypeScript 기반 재구성과 디자인 토큰 추가`

---

### Task 2: UI 부품

**Files:**
- Create: `src/ui/*.tsx`(File Structure 목록), `src/ui/index.ts`(재수출), `tests/ui.test.tsx`

**Interfaces:**
- Produces (모두 `src/ui`에서 export):
  - `Button({variant?: "primary"|"secondary"|"danger"|"ghost", onDark?: boolean, size?: "md"|"lg", loading?: boolean, ...button props})` — primary: 종이 위 `bg-ink text-paper`, 잉크 위(`onDark`) `bg-ticket text-ink`; secondary: 2px ink(잉크 위는 paper) 테두리; danger: `stamp-red`; 높이 md 44px, lg 52px; `loading`이면 비활성 + Spinner.
  - `TextField({label, error?, hint?, ...input props})`, `SelectField({label, error?, options: {value,label,disabled?}[] , ...})` — label 연결(`htmlFor`/`id` 자동), `aria-invalid`, `aria-describedby`로 오류 연결.
  - `Choice<T extends string>({label, value: T|null, options: {value:T,label:string,hint?:string,disabled?:boolean}[], onChange})` — 버튼 묶음(라디오 그룹 역할, `role="radiogroup"`/`role="radio"`, 방향키 이동).
  - `Ticket({header: ReactNode, children, tone?: "ticket"|"muted"})` — 노랑 몸통(header) + `Perforation` + 종이 본문. `tone="muted"`는 `ink-2` 몸통.
  - `Stub({number: string, children, onClick?/href?, closed?: boolean, right?: ReactNode})` — 번호 칸 + 점선 세로 구분 + 본문(목록 행). `closed`면 `ink-2` 바탕·흐린 글자.
  - `Stamp({kind: "ok"|"wait"|"closed"|"noshow"|"done"|"live", children?})` — 색: ok/done `stamp-green`, wait `stamp-amber`, closed/noshow `stamp-red`, live = `bg-ink text-ticket`(운영 중). 기본 글자: ok "입장 가능", wait "대기", closed "마감", noshow "노쇼", done "체험완료", live "운영 중". -4~-8도 기울임(live 제외).
  - `Perforation({onDark?: boolean})` — 2px 점선 + 양끝 반원 홈.
  - `DataTable<T>({columns: {key, header, render?(row), align?, numeric?}[], rows: T[], rowKey(row), empty?: ReactNode})`.
  - `Tabs({items: {id,label,count?}[], value, onChange})` — 선택 탭 아래 `ticket` 4px.
  - `ConfirmDialog({open, title, body, confirmLabel, danger?, onConfirm, onCancel, requireText?: string})` — `requireText`가 있으면 그 글자를 입력해야 확인 버튼 활성. 네이티브 `<dialog>` 또는 포커스 가둠 + Esc 닫기.
  - `Notice({tone: "info"|"error"|"warn", children, action?: {label, onClick}})`.
  - `EmptyState({title, body?})`, `Spinner({label?})`, `NotFound({title?, body?})`.
  - `PageFrame({surface: "ink"|"paper"|"paper-2", children, width?: "narrow"|"wide"})` — narrow = 최대 480px(방문객), wide = 최대 1200px. 좌우 여백 16px.

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/ui.test.tsx`) — 최소 단언:
  - `Stamp kind="wait"`가 "대기" 글자를 렌더.
  - `ConfirmDialog requireText="어울마당"`: 확인 버튼 비활성 → 입력 후 활성 → 클릭 시 `onConfirm` 1회, Esc 시 `onCancel`.
  - `Choice`: 방향키 오른쪽으로 다음 옵션 선택, `disabled` 옵션 건너뜀, `aria-checked` 반영.
  - `TextField error="필수"`: `aria-invalid="true"`이고 오류 문구가 `aria-describedby`로 연결.
  - `Button loading`: 비활성.
  - `DataTable`: rows 비면 `empty` 표시.
- [ ] **Step 2: 실패 확인** — `npm test`
- [ ] **Step 3: 구현** — 토큰 클래스만 사용(디자인 규칙 테스트가 지킴).
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck`
- [ ] **Step 5: 커밋** — `[feat] 입장권 디자인 UI 부품 추가`

---

### Task 3: API 클라이언트, 오류 문구, 타입, 방문객·링크 API 함수

**Files:**
- Create: `src/api/client.ts`, `src/api/messages.ts`, `src/api/types.ts`, `src/api/public.ts`, `src/api/link.ts`, `tests/api.test.ts`

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number; code: string; fields: Record<string,string> }` — 네트워크 실패는 `status 0, code "network"`.
  - `apiUrl(path: string): string` = `VITE_API_BASE + path`(로고 등 절대 경로에도 사용; `null` 입력은 호출하지 않음).
  - `api<T>(method: "GET"|"POST"|"PUT"|"PATCH"|"DELETE", path: string, body?: unknown|FormData): Promise<T>` — walnutphoto `admin/src/api/client.ts`를 옮기되: `credentials: "include"`, URL은 `apiUrl(path)`, CSRF 헤더는 `/api/admin/` 변경 요청에만, 401 이벤트 이름 `nr:unauthorized`이고 Global Constraints의 제외 경로 적용, `fetch` 예외 → `ApiError(0,"network")`.
  - `setCsrf(token: string|null)`, `getCsrf()`.
  - `messageFor(err: unknown, fallback?: string): string` — 코드별 문구(스펙 6.1 예시 포함) + `network` "연결이 불안정해요. 잠시 뒤 다시 시도해 주세요." + `not_found` "찾을 수 없어요." + `rate_limited` + 알 수 없는 코드 → fallback("문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.").
  - `fieldErrors(err: unknown): Record<string,string>` — `ApiError(422)`의 fields, 아니면 `{}`.
  - `types.ts`(API 스펙 7.1·7.4 그대로): `Availability = TimeAvailability | FcfsAvailability`(`{slots:{label:string;remaining:number|null;full:boolean}[]; is_closed:boolean}` | `{remaining:number|null; full:boolean; is_closed:boolean}`), `PublicOrgPage`, `PublicBoothPage`, `ReserveResult {id; slot; status}`, `LookupResult {name; slot; status; booth_name}`, `ReservationStatus = "normal"|"waiting"|"noshow"|"completed"`, `Booth`(booth_json 키 전부), `Reservation`, `Stats {rows:{age_group;male;female;total}[]; male; female; total}`, `ExportData {booths:{booth_id;event_name;booth_name;rows:{slot;name;gender;age_group;code;status;created_at}[]}[]}`, `BoothLinkPayload {booth; org:{name;slug}; reservations; stats}`, `PartnerPayload {partner:{id;name}; event:{id;name}; org:{name;slug}; booths: Booth[]}`. 로고·안내 필드(`logo_url: string|null`, `notice: string|null`) 포함.
  - `public.ts`: `getOrgPage(slug)`, `getBoothPage(slug, boothId)`, `reserve(boothId, body)`, `lookup(boothId, {name, code})`, `cancel(boothId, {name, code})`, `getBoothHome(boothId) → {slug}`; 쿼리 키 `["public","org",slug]`, `["public","booth",slug,boothId]`.
  - `link.ts`: 부스 링크 `getBoothLink(t)`, `patchBoothLink(t, settings)`, `toggleBoothLink(t)`, `setStatusBoothLink(t, rid, status)`, `deleteReservationBoothLink(t, rid)`, `clearBoothLink(t)`, `exportBoothLink(t)`; 운영 단체 `getPartner(t)`, `partnerStats(t, {booth_ids?, mode})`, `partnerExport(t, {booth_ids?})`, `getPartnerBooth(t, id)`(= `/partner/<t>/booths/<id>` GET), 그리고 같은 이름 규칙의 `…PartnerBooth(t, id, …)` 6개. 경로·응답은 API 스펙 7.4.

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/api.test.ts`, `fetch`를 `vi.fn`으로 대체):
  - 요청 URL이 `VITE_API_BASE`(테스트에서 `vi.stubEnv("VITE_API_BASE","https://api.test")`) + 경로, `credentials: "include"`.
  - `setCsrf("t")` 후 `POST /api/admin/x`에 `X-CSRF-Token: t`, `POST /api/public/booths/1/reservations`에는 없음.
  - 401: `/api/admin/events/1` → `nr:unauthorized` 발생, `/api/link/booth/x`·`/api/public/...`·`/api/admin/auth/me` → 발생 안 함.
  - `{error:"full"}` 409 → `ApiError(409,"full")`, `messageFor`가 "이 시간은 마감됐어요".
  - 422 `{error:"invalid", fields:{code:"…"}}` → `fieldErrors`가 그대로.
  - `fetch` reject → `ApiError(0,"network")`, `messageFor` 네트워크 문구.
  - 204 → `undefined`.
- [ ] **Step 2: 실패 확인** — `npm test -- tests/api.test.ts`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck`
- [ ] **Step 5: 커밋** — `[feat] API 클라이언트와 방문객·링크 API 추가`

---

### Task 4: 입력 정규화, 슬롯 표시, 입장권 보관

**Files:**
- Create: `src/lib/identity.ts`, `src/lib/slots.ts`, `src/lib/ticketStore.ts`, `tests/lib.test.ts`

**Interfaces:**
- Produces:
  - `normalizeName(s: string): {ok: true; value: string} | {ok: false; message: string}` — 앞뒤 공백 제거, 1~50자. 메시지 "참가자 이름을 입력해 주세요." / "이름은 50자까지 입력할 수 있어요."
  - `normalizeCode(s: string): {ok: true; value: string} | {ok: false; message: string}` — 비ASCII 숫자 포함 시 "숫자는 일반 숫자(0~9)로 입력해 주세요.", 그 외 비숫자 제거 후 4자리 아니면 "식별번호는 숫자 4자리예요."
  - `slotHour(label: string): number` — 라벨 앞 숫자(`"11시 A타임"`→11), `"선착순"`→-1.
  - `compareSlots(a: string, b: string): number` — 시(숫자) → 라벨 문자열(백엔드 `list_reservations` 정렬과 동일).
  - `availabilitySummary(mode: "time"|"fcfs", a: Availability, useWaitlist: boolean): string` — 목록 한 줄 요약: time → 남은 자리 합(무제한 슬롯이 있으면 "자리 여유"), fcfs → "남은 자리 N"/"자리 여유"; 마감이지만 대기 접수면 "대기 접수 중"; `is_closed`면 "마감".
  - `ticketStore`: `saveTicket(t: {booth_id:number; slug:string; name:string; code:string}): void`, `loadTicket(boothId: number): StoredTicket|null`(24시간 지난 항목은 삭제 후 null), `clearTicket(boothId: number): void`. 키 `nr.ticket.<boothId>`. 모든 storage 접근 try/catch, 예외 시 조용히 무시.

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/lib.test.ts`) — 사례표:

```ts
const codes: [string, string | null][] = [
  ["1234","1234"], ["12-34","1234"], [" 1 2 3 4 ","1234"], ["１２３４",null], ["１2345",null],
  ["123",null], ["12345",null], ["abcd",null],
];
// normalizeName: "  홍길동 " → "홍길동", "" → 오류, "가".repeat(51) → 오류
// compareSlots 정렬: ["11시 A타임","9시 B타임","9시 A타임","선착순"] → ["선착순","9시 A타임","9시 B타임","11시 A타임"]
// availabilitySummary 각 분기
// ticketStore: 저장→읽기, Date.now를 25시간 뒤로 → null이고 키 삭제됨, localStorage.getItem이 throw하도록 spy → loadTicket null·saveTicket 예외 없음
```

- [ ] **Step 2: 실패 확인** — `npm test -- tests/lib.test.ts`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck`
- [ ] **Step 5: 커밋** — `[feat] 입력 정규화·슬롯 표시·입장권 보관 추가`

---

### Task 5: 방문객 화면

**Files:**
- Create: `src/visitor/OrgPage.tsx`, `ReservePage.tsx`, `CheckPage.tsx`, `TicketCard.tsx`, `LegacyRedirect.tsx`, `RootPage.tsx`, `BrandHeader.tsx`, `tests/visitor.test.tsx`
- Modify: `src/routes.tsx`(방문객 경로 교체)

**Interfaces:**
- Consumes: Task 2 부품, Task 3 `public.ts`·`messageFor`·`fieldErrors`·`apiUrl`, Task 4 전부.
- Produces:
  - `BrandHeader({orgName, orgLogoUrl, eventName?, eventLogoUrl?})` — 로고가 있으면 `<img src={apiUrl(url)} alt="{기관명} 로고">`(높이 32px, 비율 유지), 없으면 기관명 글자.
  - `TicketCard({eventName, boothName, name, slot, status, notice?, onCancel?, onForget?})` — 스펙 4.1 입장권(노랑 몸통: "체험부스 입장권 · {행사}", 부스 이름 / 종이: 참가자, 입장 시간(선착순이면 "선착순 입장"), 상태 도장, 취소·이 기기에서 지우기).
  - 화면 동작은 스펙 4.1·6.3. 세부:
    - OrgPage: 행사별 `Stub` 목록(번호 = 행사 안 순서 2자리), 행 클릭 → `/:slug/reserve/:id`, `is_closed`면 `closed` + 마감 도장 + 링크 없음. 행사 0개면 EmptyState "지금 신청을 받는 부스가 없어요."
    - ReservePage: `refetchInterval: 30_000`, `refetchOnWindowFocus: true`. time 모드는 `Choice`로 슬롯(남은 자리 hint, full이면 대기 접수 가능 시 "대기" hint, 아니면 disabled). fcfs 모드는 슬롯 선택 없음 + "현장 선착순" 안내. 성별 `Choice`(남/여), 연령대 `SelectField`(6구간), 식별번호 `inputMode="numeric"`. 동의 체크 "위 체험부스를 신청합니다"(필수). 제출 전 Task 4 정규화, 서버 422는 필드별. 409 full/closed → Notice + `refetch()`. 409 duplicate → "이미 신청했어요" + "내 신청 확인" 링크. 성공 → `saveTicket` → `/:slug/check/:id`로 이동하며 결과를 상태로 전달(대기면 "대기자로 접수됐어요" Notice). 부스가 비활성이거나 `is_closed`(대기 없음)면 폼 대신 마감 입장권(`tone="muted"`).
    - CheckPage: 라우터 상태 또는 `loadTicket`이 있으면 `lookup`으로 최신 상태를 받아 TicketCard, 없으면 이름·식별번호 폼. 취소: ConfirmDialog → `cancel` → `clearTicket` → "신청을 취소했어요". 404 → "신청 내역을 찾을 수 없어요".
    - LegacyRedirect(`/reserve/:id`, `/check/:id`): `getBoothHome` → `navigate(/{slug}/reserve|check/{id}, {replace:true})`, 실패 → NotFound.
    - RootPage(`/`): "QR 코드나 기관에서 받은 주소로 들어와 주세요."
    - 모든 쿼리 실패: 404면 NotFound, 그 외 Notice(error) + 다시 시도.
  - 화면 바탕: `PageFrame surface="ink" width="narrow"`. 하단 작은 글씨 "© {연도} {기관명}".

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/visitor.test.tsx`, `src/api/public.ts` 함수를 `vi.mock`, QueryClient는 테스트마다 새로·`retry:false`):
  - OrgPage: 마감 부스는 링크가 아니고 "마감" 도장, 열린 부스는 `/nareum/reserve/12` 링크.
  - ReservePage 성공: 슬롯·성별·연령·이름 `" 홍길동 "`·코드 `"12-34"`·동의 → `reserve`가 `{name:"홍길동", code:"1234", gender:"남", age_group:"9~13세", slot:"11시 A타임"}`로 호출, `saveTicket` 저장 확인, check 경로로 이동.
  - ReservePage 409 full → 문구 "이 시간은 마감됐어요" 표시 + `getBoothPage` 재호출.
  - ReservePage `"１２３４"` → 제출 차단, 코드 필드 오류 문구.
  - ReservePage 네트워크 실패 → 네트워크 문구 + 다시 시도.
  - CheckPage: 보관된 입장권 있음 → `lookup` 호출, 입장권에 "입장 가능" 도장; 취소 확인 → `cancel` 호출·보관 삭제.
  - LegacyRedirect: `/reserve/12` → `/gmyouth/reserve/12`.
  - OrgPage 404 → "찾을 수 없어요".
- [ ] **Step 2: 실패 확인** — `npm test -- tests/visitor.test.tsx`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run build`
- [ ] **Step 5: 커밋** — `[feat] 방문객 화면(부스 목록·신청·입장권) 추가`

---

### Task 6: 엑셀과 QR 도구

**Files:**
- Create: `src/lib/excel.ts`, `src/lib/qr.ts`, `src/lib/download.ts`, `tests/excel.test.ts`, `tests/qr.test.ts`

**Interfaces:**
- Produces:
  - `sheetName(raw: string, taken: Set<string>): string` — `\ / ? * [ ] :` 제거, 31자 이하, 비면 "시트", 중복이면 ` (2)`… 를 31자 안에서 붙임.
  - `buildRosterWorkbook(data: ExportData, stats: Stats, opts: {mode: "simple"|"strict"}): Promise<ArrayBuffer>` — 부스마다 시트(머리글: 시간, 이름, 성별, 연령, 식별번호, 상태, 신청 시각) + "합계" 시트(연령대 6행 × 남/여/합계 + 전체 합계, 첫 줄에 "단순 합계" 또는 "엄격 합계(이름·성별·연령 같으면 1명)"). 상태는 한국어(정상→"입장 가능", waiting→"대기", noshow→"노쇼", completed→"체험완료"). 신청 시각은 KST `YYYY-MM-DD HH:mm`. 시트 순서: 부스 시트들(데이터 순서) 뒤 "합계" 마지막.
  - `rosterFileName(kind: "booth"|"partner"|"event", eventName: string, name?: string): string` — `[행사]_부스명_명단.xlsx` / `[행사]_운영단체명_실적.xlsx` / `[행사]_실적.xlsx`, 파일명 금지 문자(`\/:*?"<>|`) 제거.
  - `downloadBlob(data: BlobPart, fileName: string, type: string): void`.
  - `qrLabelLayout(title: string, subtitle: string, width: number, measure: (s: string) => number): {title: string; subtitle: string}` — 폭을 넘는 제목은 "…"로 줄임(순수 함수, 테스트 대상).
  - `renderQrPng(value: string, title: string, subtitle: string): Promise<Blob>` — `qrcode.react`의 `QRCodeCanvas`를 화면 밖에 그려 4배 해상도 캔버스에 QR + 흰 바탕 + 제목(800)·부제(700) 프리텐다드. `subtitle` 값: "부스 관리" | "방문객 신청" | "운영 단체 실적".

- [ ] **Step 1: 실패하는 테스트 작성**:
  - `tests/excel.test.ts`: `buildRosterWorkbook` 결과를 `new ExcelJS.Workbook().xlsx.load(buf)`로 다시 읽어 — 시트 이름 목록이 `["페이스페인팅","로봇 코딩","합계"]`, 첫 시트 2행이 `["11시 A타임","홍길동","남","9~13세","1234","입장 가능", "2026-05-05 09:00"]`(created_at = 2026-05-05T00:00:00Z), 합계 시트 전체 합계 셀 = `stats.total`. `sheetName`: `"a/b:c"`→`"abc"`, 40자 → 31자, 중복 → `"부스 (2)"`.
  - `tests/qr.test.ts`: `qrLabelLayout`이 긴 제목을 측정 함수 기준 폭 안으로 줄이고 "…"로 끝냄, 짧으면 그대로.
- [ ] **Step 2: 실패 확인** — `npm test -- tests/excel.test.ts tests/qr.test.ts`
- [ ] **Step 3: 구현** — `renderQrPng`는 jsdom에서 캔버스가 없으므로 단위 테스트하지 않고 Task 9 화면 확인에서 실제 PNG를 내려받아 확인.
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck`
- [ ] **Step 5: 커밋** — `[feat] 명단 엑셀과 QR 이미지 도구 추가`

---

### Task 7: BoothConsole과 부스 링크 화면

**Files:**
- Create: `src/booth/BoothSource.ts`, `src/booth/linkSources.ts`, `src/booth/BoothConsole.tsx`, `src/booth/RosterList.tsx`, `src/booth/StatsTable.tsx`, `src/booth/SettingsForm.tsx`, `src/booth/QrPanel.tsx`, `src/links/BoothLinkPage.tsx`, `tests/booth.test.tsx`
- Modify: `src/routes.tsx`(`/b/:token`)

**Interfaces:**
- Consumes: Task 2·3·4·6.
- Produces:
  - `BoothSource`(스펙 5절): `{ key: unknown[]; get(): Promise<BoothDetail>; patch(s: Partial<BoothSettings>): Promise<Booth>; toggle(): Promise<{is_active:boolean}>; setStatus(rid:number, status: ReservationStatus): Promise<{reservation: Reservation; over_capacity?: true}>; deleteReservation(rid:number): Promise<void>; clear(): Promise<{deleted:number}>; exportData(): Promise<ExportData>; links: {manage: string; reserve: string} }` — `BoothDetail = {booth: Booth; org: {name; slug}; reservations: Reservation[]; stats: Stats}`. `links`는 화면에 보일 전체 URL(`window.location.origin` 기준 `/b/<manage_token>`, `/<slug>/reserve/<id>`).
  - `BoothSettings` = API 스펙의 SETTING_FIELDS(name, mode, use_waitlist, total_limit, start_hour, end_hour, slots_per_hour, limit_per_slot).
  - `boothLinkSource(token): BoothSource`, `partnerBoothSource(token, boothId): BoothSource`(Task 3 link 함수 사용; 운영 단체 부스는 `getPartnerBooth` 응답을 같은 `BoothDetail` 모양으로 맞춤 — 응답에 명단·통계가 없으면 `…/reservations`와 `stats({booth_ids:[id]})`를 함께 불러 합친다).
  - `BoothConsole({source: BoothSource, access: "own"|"manage", extraOwnActions?: ReactNode})` — 스펙 5절 구성·동작:
    - `useQuery({queryKey: source.key, queryFn: source.get, refetchInterval: 15_000, refetchOnWindowFocus: true})` + 새로고침 버튼(마지막 갱신 시각 표시).
    - 상단: 행사·부스 이름, `Stamp kind="live"` 또는 마감 도장, 운영 시작/마감 버튼(확인 없이 즉시, 실패 시 Notice).
    - 숫자 표: 신청(노쇼 제외 전체), 체험완료, 대기, 노쇼.
    - StatsTable: 연령대 6행 × 남/여/합계 + 합계 행(접기, 기본 닫힘).
    - RosterList: `compareSlots` 순 슬롯별 묶음, 검색(이름·식별번호), 행 동작 — normal: [체험완료][노쇼]; waiting: [확정][노쇼]; noshow/completed: [되돌리기](→ normal); 모두 [삭제](ConfirmDialog). 상태 변경은 낙관적 갱신(`queryClient.setQueryData`) 후 실패 시 되돌림 + Notice. `over_capacity` → Notice "정원을 넘겨 확정됐어요".
    - SettingsForm(접기): 이름, 운영 방식(`Choice`), 대기 접수(체크), time: 시작·종료 시각·시간당 타임수(1~6)·타임당 인원, fcfs: 선착순 인원; 0 = 제한 없음 안내; 422 필드 오류 표시; 저장 후 갱신.
    - 하단 동작: 명단 엑셀(`buildRosterWorkbook` + `rosterFileName("booth", …)`), 초기화(ConfirmDialog, 본문에 "신청 N건이 모두 삭제돼요"), QrPanel(부스 관리·방문객 신청 QR 미리보기 + PNG 내려받기 + 링크 복사).
    - `access === "own"`일 때만 `extraOwnActions` 렌더(2-C에서 행사 이동·삭제·재발급을 넣음).
  - `BoothLinkPage`(`/b/:token`): `PageFrame surface="paper" width="wide"` 안에 `BoothConsole source={boothLinkSource(token)} access="manage"`; 404 → NotFound "이 링크는 더 이상 쓸 수 없어요. 담당자에게 새 링크를 받아 주세요."

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/booth.test.tsx`, 가짜 `BoothSource` 객체로):
  - 명단이 슬롯 순서로 묶여 표시, 검색 "1234"로 한 명만.
  - waiting 행 [확정] → `setStatus(rid,"normal")` 호출, 응답 `over_capacity:true` → "정원을 넘겨 확정됐어요".
  - [노쇼] 클릭 즉시 행이 노쇼로 바뀌고, `setStatus`가 reject하면 원래 상태로 되돌아오며 오류 Notice.
  - 초기화: 대화상자 본문에 신청 건수, 확인 → `clear` 호출.
  - `access="manage"`면 `extraOwnActions` 미표시, `"own"`이면 표시.
  - SettingsForm에서 422 `{fields:{end_hour:"…"}}` → 종료 시각 필드에 오류.
  - BoothLinkPage 404 → 링크 만료 문구.
- [ ] **Step 2: 실패 확인** — `npm test -- tests/booth.test.tsx`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run build`
- [ ] **Step 5: 커밋** — `[feat] 부스 관리 화면과 부스 링크 추가`

---

### Task 8: 운영 단체 실적 화면

**Files:**
- Create: `src/links/PartnerPage.tsx`, `src/links/PartnerBoothPage.tsx`, `src/booth/StatsPanel.tsx`, `tests/partner.test.tsx`
- Modify: `src/routes.tsx`(`/p/:token`, `/p/:token/booths/:boothId`)

**Interfaces:**
- Consumes: Task 3 `getPartner`, `partnerStats`, `partnerExport`; Task 6 엑셀; Task 7 `BoothConsole`, `partnerBoothSource`, `StatsTable`.
- Produces:
  - `StatsPanel({booths: Booth[], loadStats(ids, mode), loadExport(ids), fileName(): string})` — 부스 다중 선택(전체 선택/해제), 단순/엄격 `Tabs`, StatsTable, 통합 엑셀 버튼. 2-C 행사 실적 탭에서 재사용.
  - `PartnerPage`(`/p/:token`): 머리(운영 단체 이름, 행사·주최 기관 이름) → 부스 `Stub` 목록(각 → `/p/:token/booths/:id`, 운영 중/마감 도장, 신청 수) → StatsPanel(기본 전체 선택, 단순 합계). 엑셀 파일명 `rosterFileName("partner", event.name, partner.name)`. 부스 0개면 EmptyState "아직 배정된 부스가 없어요."
  - `PartnerBoothPage`: 뒤로(운영 단체로) + `BoothConsole source={partnerBoothSource(token, id)} access="manage"`.
  - 폐기된 토큰 404 → BoothLinkPage와 같은 만료 문구.

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/partner.test.tsx`, `src/api/link.ts` mock):
  - 부스 목록 링크가 `/p/tok/booths/12`.
  - 엄격 탭 전환 → `partnerStats(tok, {booth_ids:[…], mode:"strict"})` 호출.
  - 부스 하나 선택 해제 → 그 id가 빠진 `booth_ids`로 호출.
  - 통합 엑셀 → `partnerExport` 호출 후 `buildRosterWorkbook`이 실적 데이터로 호출(모듈 mock으로 확인).
  - 0개 부스 → EmptyState 문구.
- [ ] **Step 2: 실패 확인** — `npm test -- tests/partner.test.tsx`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — `npm test && npm run typecheck && npm run build`
- [ ] **Step 5: 커밋** — `[feat] 운영 단체 실적 화면 추가`

---

### Task 9: 실제 동작·화면 확인

**Files:**
- Create: `../NR_ChildDay2026-BE/scripts/seed_demo.py`(백엔드 저장소, 개발용), `docs/verification/2b/`(캡처 이미지), `docs/verification/2b/README.md`(확인 결과표)
- Modify: 확인 중 발견한 결함 수정(해당 파일)

**Interfaces:**
- Produces:
  - `python scripts/seed_demo.py --out <DATA_DIR>/app.db` (백엔드): 빈 경로에만 생성. 기관 `nareum`(로고 없음)·`gmyouth`(작은 PNG 로고), 행사 2개(하나는 안내 문구, 40자 넘는 긴 행사 이름 하나), 부스 6개(time·fcfs·대기 접수·마감·비활성·긴 부스 이름), 운영 단체 1개(부스 2개 배정), 신청 30건(모든 상태 포함). 실행 끝에 부스 링크 2개·운영 단체 링크 1개·방문객 주소를 출력.
  - `docs/verification/2b/README.md`: 아래 확인 항목별 통과/수정 내용 표.

- [ ] **Step 1: 시드와 서버** — 백엔드: `DATA_DIR=<임시> python scripts/seed_demo.py --out <임시>/app.db` 후 `SESSION_COOKIE_SECURE=0 CORS_ORIGINS=http://localhost:5173 TRUSTED_PROXY_HOPS=0 DATA_DIR=<임시> flask --app wsgi.py run -p 5005`. 프론트: `VITE_API_TARGET=http://localhost:5005 npm run dev`(개발 서버 proxy, `VITE_API_BASE` 비움).
- [ ] **Step 2: 흐름 확인(브라우저 자동화 또는 직접)** — 각 항목 결과를 README 표에 기록:
  1. `/nareum` 목록 → 열린 부스 신청 → 입장권 → 새로고침해도 입장권 유지 → 취소.
  2. 같은 이름·번호로 다시 신청 → "이미 신청했어요".
  3. 마감 부스는 목록에서 링크 없음, 대기 접수 부스는 "대기" 안내 후 대기 입장권.
  4. `/reserve/<id>` 옛 주소 → 새 주소로 이동.
  5. 부스 링크: 노쇼·완료·대기 확정·되돌리기·삭제, 설정 변경(타임 수 축소), 운영 마감/시작, 명단 엑셀 열어서 시트 확인, QR PNG 두 종 내려받아 확인(스마트폰 카메라로 읽히는지 포함).
  6. 운영 단체 링크: 부스 이동, 단순/엄격 전환, 통합 엑셀.
  7. 백엔드를 끈 상태에서 신청 → 네트워크 문구.
  8. 폐기된 토큰(`/b/없는토큰`) → 만료 문구.
- [ ] **Step 3: 화면 캡처와 규칙 검토** — 390×844, 1440×900으로 `/nareum`, 신청, 입장권, 부스 링크, 운영 단체 화면을 `docs/verification/2b/`에 저장. 검토 항목: 토큰 외 색 없음, 둥글기 3단계, 도장·절취선이 의미 있는 곳에만, 긴 이름 줄바꿈(가로 스크롤 없음), 포커스 표시(키보드 Tab), 글자 대비. 결함은 수정 후 다시 캡처.
- [ ] **Step 4: 전체 확인** — `npm test && npm run typecheck && npm run build && npm run lint`, 백엔드 `python -m pytest -q`.
- [ ] **Step 5: 커밋** — 프론트 `[test] 2-B 동작·화면 확인 기록`, 백엔드 `[chore] 개발용 시드 스크립트 추가`.
