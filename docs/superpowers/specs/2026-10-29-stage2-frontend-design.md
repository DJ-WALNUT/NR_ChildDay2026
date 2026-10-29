# 체험부스 예약 시스템 2단계: 프론트엔드 재작성 + 디자인 개편 설계

- 작성일: 2026-10-29
- 대상 저장소: `NR_ChildDay2026`(프론트엔드), `NR_ChildDay2026-BE`(백엔드 추가분), 두 저장소 모두 `update` 브랜치
- 선행 문서: 백엔드 저장소 `docs/superpowers/specs/2026-10-29-multitenant-design.md`(이하 "1단계 스펙"). API 계약은 1단계 스펙 7절이 기준이다.
- 참고 구현: `../walnutphoto/admin/`(API 클라이언트, 인증 컨텍스트, 오류 문구 패턴)

## 1. 목표

1. 1단계 백엔드(기관·계정·링크 권한)에 맞춰 프론트엔드를 새로 만든다.
2. 기능 개편(원래 2단계)과 디자인 개편(원래 3단계)을 합쳐, 모든 화면을 새 디자인으로 한 번에 만든다.
3. 디자인은 지금 화면의 톤(굵은 검정 제목, 노랑 강조, 확인 화면의 '입장권' 느낌)을 이어가되, 흔한 AI 생성 화면의 특징(크게 둥근 카드, 이모지 아이콘, 기본 Tailwind 파랑, 장식 그림자, 색만 다른 통계 카드)을 없앤다.
4. 1·2단계는 함께 배포한다(새 API는 기존 프론트와 호환되지 않는다).

## 2. 결정 사항

| 항목 | 결정 |
|---|---|
| 진행 방식 | 기능 + 디자인을 한 번에(같은 화면을 두 번 만들지 않는다) |
| 기술 | React 19 + Vite + TypeScript + TanStack Query + Tailwind 4 + React Router 7, 테스트 Vitest + Testing Library |
| 디자인 방향 | "현장 입장권" — 잉크와 입장권 종이 두 재료, 노랑은 입장권 몸통과 현재 선택, 상태는 도장 |
| 브랜딩 | 기관 로고 업로드 + 행사별 함께 표시할 로고(선택). 백엔드에 업로드 추가 |
| 행사 안내 문구 | 행사마다 선택 입력(신청 화면·입장권 아래 표시). `public/terms.md` 고정 문구 대체 |
| 엑셀 | `xlsx`(알려진 취약점) 제거 → `exceljs` |
| QR | `qrcode.react` 유지, 묶음 내려받기에 `jszip` |
| 배포 | 지금처럼 정적 빌드를 Apache(`nrbooth.team-cluster.kr`)에, `.htaccess` SPA 라우팅 유지. API 주소는 빌드 시 `VITE_API_BASE` |

## 3. 디자인 시스템

### 3.1 재료와 색 (Tailwind 4 `@theme` 토큰으로만 사용, 화면 코드에 임의 색 값 금지)

| 토큰 | 값 | 용도 |
|---|---|---|
| `ink` | `#16181d` | 글자, 방문객 화면 바탕, 관리자 사이드바, 주 버튼 |
| `ink-2` | `#2a2d34` | 잉크 바탕 위 비활성 면(마감 입장권, 선택 메뉴 바탕) |
| `paper` | `#f3efe4` | 입장권 종이, 현장 화면 바탕 |
| `paper-2` | `#f7f5ef` | 관리자 본문 바탕(더 낮은 대비) |
| `rule` | `#d8d2c2` | 종이 위 구분선 |
| `rule-2` | `#e3ddcf` | 관리자 표 행 구분선 |
| `muted` | `#5b5a55` | 보조 글자(종이 위) |
| `faint` | `#8a8780` | 비활성·자리표시 글자 전용(본문 글자에 쓰지 않음) |
| `ticket` | `#ffcc1a` | 입장권 몸통, 현재 선택 표시, 잉크 위 '운영 중' |
| `stamp-red` | `#e2533b` | 마감·노쇼·삭제 도장과 위험 동작 |
| `stamp-green` | `#1f6f4a` | 입장 가능·체험완료 도장 |
| `stamp-amber` | `#a15c00` | 대기 도장 |

- 파랑은 쓰지 않는다. 링크는 밑줄, 포커스는 아래 3.4 규칙.
- 그라데이션, 장식 그림자, 이모지 아이콘을 쓰지 않는다. 아이콘이 필요하면 `lucide-react` 선 아이콘만.

### 3.2 글자

- 프리텐다드 한 가지(500/700/800), 자체 호스팅(`public/fonts/`, OFL 고지 포함).
- 고정 크기 단계: 12 / 13 / 15 / 18 / 22 / 28px. 방문객 화면 큰 제목만 28px, 관리자 화면 제목은 22px.
- 숫자(인원, 시간, 번호)는 `tabular-nums`.
- 자간: 제목만 `-0.03em`, 본문은 기본.

### 3.3 형태

- 둥글기 4 / 6 / 8px 세 단계만. 입장권 바깥 모서리 8px, 버튼·입력 6px, 도장·배지 4px.
- **입장권(Ticket)**: 노랑 몸통 + 절취선 + 종이 하단. 절취선 양끝은 바탕색 반원 홈.
- **번호 칸(Stub)**: 목록의 부스 번호. 본문과 점선 세로선으로 나뉜다.
- **도장(Stamp)**: 2px 테두리 + 같은 색 글자, -4~-8도 기울임. 상태 표시 전용(입장 가능·대기·마감·노쇼·체험완료).
- **절취선(Perforation)**: 2px 점선. 정보 묶음을 나누는 실제 구분선으로만 사용(장식 금지).
- 버튼: 주 버튼 = 잉크 바탕 + 흰 글자(잉크 바탕 위에서는 노랑 바탕 + 잉크 글자), 보조 버튼 = 2px 잉크 테두리, 위험 버튼 = `stamp-red` 테두리/바탕. 높이 44px 이상(현장 휴대폰 터치).
- 입력: 높이 44px, 2px 테두리(`rule` → 포커스 시 `ink`).

### 3.4 접근성

- 본문 글자 대비 4.5:1 이상(`faint`는 비활성·자리표시 전용).
- 포커스: 종이 위에서는 2px `ink` 외곽선 + 2px 간격, 잉크 위에서는 2px `ticket` 외곽선.
- 상태를 색으로만 표시하지 않는다(도장에 글자 포함).
- 휴대폰 우선: 방문객·현장 화면은 390px 기준으로 설계하고 1440px까지 깨지지 않는다.

### 3.5 화면별 재료 배분

| 화면 | 바탕 | 주 재료 |
|---|---|---|
| 방문객(목록·신청·입장권) | `ink` | 입장권(노랑 몸통 + 종이) |
| 현장 링크(`/b`, `/p`) | `paper` | 표, 도장, 잉크 버튼 |
| 관리자 | `paper-2` + `ink` 사이드바 | 표, 탭(선택 탭 아래 노랑 4px), 도장 |

## 4. 화면 구성

### 4.1 방문객 (로그인 없음, 휴대폰 위주)

| 경로 | 화면 |
|---|---|
| `/:slug` | 기관 첫 화면: 기관 로고·이름, 운영 중 행사별 부스 입장권 목록(번호 칸 + 이름 + 방식·남은 자리 요약), 마감은 `ink-2` 입장권 + 마감 도장 |
| `/:slug/reserve/:id` | 신청: 행사 로고(있으면)·부스 이름, 타임 선택(남은 자리 표시, 마감 타임은 비활성, 대기 접수 타임은 '대기' 표시), 참가자 이름·성별·연령대·식별번호, 동의 체크, 행사 안내 문구 |
| `/:slug/check/:id` | 내 신청 확인: 이 기기에 보관된 입장권이 있으면 바로 표시, 없으면 이름·식별번호 입력 → 입장권. 취소 버튼(입장 가능·대기 상태만) |
| `/reserve/:id`, `/check/:id` | 기존 QR 주소: `GET /api/public/booths/<id>/home`으로 slug를 얻어 새 주소로 이동. 실패 시 "부스를 찾을 수 없어요" |
| `/` | 기관 선택 안내(기관 목록은 공개하지 않음): "QR 또는 기관에서 받은 주소로 들어와 주세요" |

### 4.2 현장 링크 (로그인 없음, 휴대폰 위주)

| 경로 | 화면 |
|---|---|
| `/b/:token` | 부스 관리(BoothConsole, '관리' 권한) |
| `/p/:token` | 운영 단체: 단체·행사 이름, 배정 부스 목록(각 부스 → `/p/:token/booths/:id`), 합산 실적(단순/엄격 전환, 연령대×성별 표), 통합 엑셀 |
| `/p/:token/booths/:id` | 배정 부스의 BoothConsole('관리' 권한) |

### 4.3 관리자 (`/manage/*`, PC 위주, 휴대폰에서도 사용 가능)

| 경로 | 화면 |
|---|---|
| `/manage/login` | 로그인 |
| `/manage/password` | 비밀번호 변경(변경 의무 계정은 이 화면만 사용 가능) |
| `/manage` | 대시보드: 내 행사(최신순)와 참가한 연합 행사(주최 기관·운영 단체 이름), 오늘·전체 신청, 운영 중/전체 부스 |
| `/manage/events/:id` | 행사 상세. 탭: **부스**(목록, 추가, 엑셀 일괄 등록, 선택 부스 일괄 운영 시작/마감) · **운영 단체**(만들기, 이름, 연결 기관, 실적 링크·QR, 재발급, 삭제, 부스 배정) · **실적**(부스 선택, 단순/엄격, 표, 엑셀) · **링크·QR**(전체 링크 엑셀, QR 묶음 zip) · **설정**(이름, 행사 로고, 안내 문구, 삭제) |
| `/manage/booths/:id` | 부스 상세: BoothConsole('소유' 또는 '관리') + 소유 권한일 때 행사 이동·운영 단체 배정·링크 재발급·삭제 |
| `/manage/account` | 내 계정(표시 이름, 비밀번호 변경) |
| `/manage/members` | 같은 기관 계정 목록, 발급(임시 비밀번호 1회 표시 + 복사), 초기화, 비활성화/활성화 |
| `/manage/activity` | 활동 기록(최신순, 종류 필터, 더 보기) |
| `/manage/org` | 기관 설정(기관 로고) |
| `/manage/super` | 슈퍼관리자: 기관 목록·생성·수정(이름, slug, 활성), 기관별 계정 관리(members 화면 재사용), 전체 활동 기록, DB 백업 내려받기, 접속 IP 확인(`/super/whoami-ip`) |

- 연합 행사(연결 기관으로 참가한 행사)는 행사 상세가 아니라 대시보드의 참가 목록 → 부스 상세('관리' 권한)로 들어간다(1단계 규칙: 연결 기관은 행사 단위 접근 없음).

## 5. BoothConsole (부스 관리 화면 하나)

세 곳(부스 링크, 운영 단체 링크, 관리자 부스 상세)에서 같은 컴포넌트를 쓴다. 차이는 데이터를 가져오는 어댑터와 권한뿐이다.

```ts
type BoothAccess = "own" | "manage";
interface BoothSource {            // 어댑터: 링크용 / 관리자용
  get(): Promise<BoothDetail>;     // 부스 + 명단 + 통계
  patch(settings): Promise<Booth>;
  toggle(): Promise<{ is_active: boolean }>;
  setStatus(rid, status): Promise<{ reservation; over_capacity?: true }>;
  deleteReservation(rid): Promise<void>;
  clear(): Promise<{ deleted: number }>;
  export(): Promise<ExportData>;
}
```

- 권한: 링크로 들어오면 `manage`. 관리자 화면에서는 `booth.org_id === me.org.id || me.user.is_superadmin` → `own`, 아니면 `manage`.
- 구성: 상단(행사·부스 이름, 운영 중/마감 전환) → 숫자 표(신청·체험완료·대기·노쇼) → 연령대×성별 표(접기) → 명단(슬롯별 묶음, 검색, 노쇼·완료·대기→확정·되돌리기·삭제) → 설정(접기) → 엑셀·초기화·QR.
- 자동 갱신: 15초마다 + 창 포커스 시 + 수동 새로고침 버튼.
- 상태 변경은 즉시 화면에 반영하고 실패하면 되돌린다. `over_capacity`이면 "정원을 넘겨 확정됐어요" 안내.
- 초기화·삭제는 확인 대화상자. 초기화 대화상자에는 삭제될 건수를 표시.

## 6. 데이터 흐름과 공통 동작

### 6.1 API 클라이언트 (`src/api/client.ts`)

- `fetch(VITE_API_BASE + path, { credentials: "include" })`. JSON 본문은 JSON으로, `FormData`는 그대로.
- CSRF: `/auth/login`·`/auth/me` 응답의 `csrf`를 모듈 변수에 보관, `/api/admin/` 변경 요청에 `X-CSRF-Token`.
- 오류: `{error, fields}` → `ApiError(status, code, fields)`. 관리 API의 401은 `auth:unauthorized` 이벤트 → 로그인 화면(`?next=`). `/api/link/`, `/api/public/`, `/auth/login`, `/auth/me`는 제외.
- 오류 문구: `src/api/messages.ts` 한곳에서 코드 → 한국어(예: `full` "이 시간은 마감됐어요", `closed` "지금은 접수하지 않아요", `duplicate` "이미 신청했어요", `rate_limited` "잠시 뒤에 다시 시도해 주세요", `not_cancellable` "체험이 끝났거나 노쇼 처리된 신청은 취소할 수 없어요").
- TanStack Query: 4xx는 재시도하지 않음, 쿼리 키는 자원별(`["booth", id]` 등), 변경 후 관련 키 무효화.

### 6.2 인증

- `AuthProvider`: 시작 시 `GET /auth/me`, `{user, org, csrf}` 보관, `login`/`logout`/`refresh` 제공.
- `RequireAuth`: 로딩 중 표시 → 미로그인 시 로그인 화면(`next` 보존, 외부 주소 차단) → `must_change_password`이면 `/manage/password`만 허용.

### 6.3 방문객

- 남은 자리: 신청 화면에서 30초 간격 + 창 포커스 시 다시 받아옴. 신청이 `full`/`closed`로 거절되면 문구 표시 후 즉시 다시 받아옴.
- 입력 검사: 이름 앞뒤 공백 제거 1~50자, 식별번호는 ASCII 숫자만 남겨 4자리이며 전각 등 비ASCII 숫자가 있으면 오류(1단계 서버 규칙과 동일). 서버 422의 `fields`를 필드별로 표시.
- 입장권 보관: 신청 성공 시 `localStorage`에 `{booth_id, slug, name, code, saved_at}` 저장, 24시간 뒤 무효. 접근은 try/catch로 감싸고 실패해도 화면은 동작. 입장권 화면에 "이 기기에서 지우기".

### 6.4 엑셀 (`src/lib/excel.ts`, exceljs)

- 명단: 부스마다 시트 1개(열: 시간, 이름, 성별, 연령, 식별번호, 상태, 신청 시각 KST) + "합계" 시트(연령대×성별, 단순/엄격 표시). 시트 이름은 엑셀 제한(31자, `\ / ? * [ ] :` 금지)에 맞게 정리하고 중복 시 번호를 붙인다.
- 파일명: `[행사]_부스명_명단.xlsx`, `[행사]_운영단체명_실적.xlsx`, `[행사]_실적.xlsx`.
- 일괄 등록 양식: 열 `부스이름, 운영방식(타임별|선착순), 선착순 인원, 시작시각, 종료시각, 시간당 타임수, 타임당 인원, 대기자 접수(Y|N)`. 업로드 → 화면 미리보기 → `POST /events/<id>/booths/bulk` → 422면 `fields.rows`를 행 번호와 함께 표시(엑셀 행 번호 = 인덱스 + 2).
- 링크 목록: 행사·부스·부스 관리 링크·방문객 신청 링크(+ 운영 단체 실적 링크 시트).

### 6.5 QR (`src/lib/qr.ts`)

- PNG: QR(4배 해상도) 아래 부스 이름(넘치면 말줄임) + 용도("부스 관리" / "방문객 신청" / "운영 단체 실적"), 바탕 흰색(인쇄용).
- 링크·QR 탭: 모든 부스의 두 QR + 운영 단체 QR을 zip으로(`jszip`), 파일명 `01_부스명_방문객신청.png` 형식.
- 부스 관리 QR은 '관리' 권한 화면에서도 보인다(1단계 결정: 운영 단체가 자기 부스 스태프에게 배포).

## 7. 백엔드 추가분 (2-A)

### 7.1 스키마 (`migrations/002_branding.sql`)

```sql
ALTER TABLE organizations ADD COLUMN logo TEXT;   -- 자산 파일 이름(sha256.ext) 또는 NULL
ALTER TABLE events ADD COLUMN logo TEXT;          -- 행사에 함께 표시할 로고
ALTER TABLE events ADD COLUMN notice TEXT;        -- 행사 안내 문구(0~500자) 또는 NULL
```

### 7.2 저장과 제공

- 파일: `DATA_DIR/assets/<sha256>.<png|jpg|webp>`(내용 주소, 같은 파일은 한 번만 저장).
- 형식: PNG·JPEG·WebP만, 파일 앞부분의 시그니처로 판별(확장자·Content-Type을 믿지 않음). SVG 거부. 1MB 초과 413/422.
- 제공: `GET /api/public/assets/<name>` — 이름 형식 검증 후 파일 전송, `Cache-Control: public, max-age=31536000, immutable`, 올바른 이미지 Content-Type, `X-Content-Type-Options: nosniff`. (이 경로만 `/api/*` 기본 `no-store`의 예외.)
- 교체·삭제 시 이전 파일은 다른 곳에서 참조하지 않으면 삭제(트랜잭션 커밋 후).

### 7.3 API

| 메서드 | 경로 | 권한 |
|---|---|---|
| PUT | `/api/admin/orgs/<org>/logo` (multipart `file`) | require_org → `{"logo_url"}` |
| DELETE | `/api/admin/orgs/<org>/logo` | require_org → 204 |
| PUT | `/api/admin/events/<id>/logo` (multipart `file`) | require_event → `{"logo_url"}` |
| DELETE | `/api/admin/events/<id>/logo` | require_event → 204 |
| PATCH | `/api/admin/events/<id>` | 기존 `{name}`에 `notice`(문자열 0~500자 또는 null) 추가 |

- 응답 확장: 방문객 `GET /orgs/<slug>`의 `org`에 `logo_url`, 각 `event`에 `logo_url`, `notice`; `GET /orgs/<slug>/booths/<id>`의 `org.logo_url`, `event.logo_url`, `event.notice`; 관리 행사 JSON에 `logo_url`, `notice`; `auth/me`의 `org`에 `logo_url`. 로고가 없으면 `null`.
- `logo_url`은 API 기준 절대 경로(`/api/public/assets/<name>`), 프론트가 `VITE_API_BASE`를 붙인다.
- 감사 로그: `org.logo`, `event.logo`(설정/삭제), `event.update`에 notice 변경 포함.
- 격리 매트릭스에 새 관리 라우트 추가(다른 기관 → 404). 1단계 스펙 7절 갱신.

## 8. 테스트

- **단위·컴포넌트(Vitest + Testing Library, jsdom)**: API 클라이언트(CSRF, 401 처리 범위, 오류 문구), 권한 판단(own/manage에 따른 버튼), 식별번호·이름 정규화(서버 규칙과 같은 사례표), 남은 자리 표시·슬롯 정렬, 엑셀(만든 파일을 exceljs로 다시 읽어 시트·합계 검증, 시트 이름 정리), 입장권 보관(24시간 만료, 지우기, storage 예외), 로그인 흐름(`next` 복귀, 외부 주소 차단, 변경 의무 강제), 일괄 등록 오류 행 번호 매핑.
- **백엔드(pytest)**: 로고 업로드 형식 판별(SVG·가짜 확장자 거부), 크기 제한, 공개 제공 헤더, 교체 시 이전 파일 정리, 권한·격리, 응답 확장 필드.
- **실제 동작 확인**: 로컬에서 Flask(시드 데이터)와 Vite를 함께 띄워 브라우저로 따라간다 — 신청 → 입장권 → 취소, 부스 링크로 노쇼·완료·대기 확정, 운영 단체 실적·엑셀, 로그인 → 행사 → 부스 추가 → 일괄 등록 → QR 묶음, 계정 발급 → 첫 로그인 비밀번호 변경.
- **화면 확인**: 390px·1440px로 주요 화면 캡처, 3절 규칙(토큰 외 색 없음, 둥글기 3단계, 도장·절취선 용도, 대비) 검토.

## 9. 작업 단계

| 계획 | 범위 | 끝 상태 |
|---|---|---|
| 2-A 백엔드 추가 | 7절 전부 | 백엔드 `update`에 커밋, 테스트 통과 |
| 2-B 프론트 기반 + 방문객 + 현장 링크 | 프로젝트 재구성(TS·테스트·토큰·글꼴), UI 부품, API·인증 골격, 방문객 4.1, BoothConsole, 현장 링크 4.2 | 방문객·현장 화면 동작 |
| 2-C 관리자 | 4.3 전부, 엑셀 일괄 등록, QR 묶음 | 전체 완성 → 1·2단계 함께 배포 |

각 계획은 1단계와 같은 방식(태스크별 구현 → 검토, 마지막에 전체 검토)으로 실행한다.

## 10. 범위 밖

기관 목록 공개 페이지, 다국어, 방문객 알림(문자·카카오), 대기자 자동 승급, 기관별 OG 이미지(정적 SPA라 SNS 미리보기는 공통 이미지 사용), PWA·오프라인, 다크/라이트 전환(화면별 재료가 고정).
