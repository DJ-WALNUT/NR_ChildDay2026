# 체험부스 신청 (프런트엔드)

React + TypeScript + Vite 로 만든 체험부스 신청·현장 운영 화면이에요. API 는 별도 Flask 서버(`NR_ChildDay2026-BE`)를 써요.

## 개발

```
npm install
npm run dev
```

개발 서버는 `/api` 요청을 `VITE_API_TARGET`(기본 `http://localhost:5000`)으로 프록시해요. 다른 주소를 쓰려면 `.env.local` 에 적어 주세요.

```
VITE_API_TARGET=http://localhost:5000
```

검사: `npm test`, `npm run typecheck`, `npm run lint`.

## 빌드

```
npm run build
```

`dist/` 에 결과물이 생겨요. 빌드 끝에 방문객 첫 묶음 크기와 직원용 라이브러리 유입을 검사해요.

## Apache 에 배포

`dist/` 안의 모든 파일(`.htaccess` 포함)을 웹 루트에 올려 주세요. `.htaccess` 는 SPA 주소 재작성, `Referrer-Policy: no-referrer`, `nosniff`, 캐시 설정을 담고 있어요. `mod_rewrite` 와 `mod_headers` 가 켜져 있어야 해요.

## 환경 변수

| 이름 | 쓰임 |
| --- | --- |
| `VITE_API_BASE` | 빌드할 때 API 서버 주소. `.env.production` 에 운영 주소(`https://child-api.team-cluster.kr`)가 들어 있어요. 비우면 같은 출처로 요청해요. |
| `VITE_API_TARGET` | 개발 서버 프록시 대상(개발 전용). |

## 백엔드 CORS

프런트엔드와 API 의 출처가 다르면 백엔드의 `CORS_ORIGINS` 에 프런트엔드 출처(예: `https://nrbooth.team-cluster.kr`)를 꼭 넣어 주세요. 빠지면 브라우저가 모든 API 요청을 막아요.
