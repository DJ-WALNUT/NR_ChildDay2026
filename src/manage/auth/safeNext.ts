/** 로그인 뒤 돌아갈 주소. /manage 아래의 같은 출처 경로만 통과시키고, 그 밖에는 /manage. */
export function safeNext(raw: string | null): string {
  const fallback = "/manage";
  if (!raw) return fallback;
  // 역슬래시·제어문자는 브라우저가 슬래시로 읽어 다른 출처로 샐 수 있다.
  if (raw.includes("\\") || [...raw].some((c) => c.charCodeAt(0) < 0x20)) return fallback;
  if (!/^\/manage(?:[/?#]|$)/.test(raw)) return fallback;
  const path = raw.split(/[?#]/)[0];
  if (path.includes("//") || path.split("/").includes("..")) return fallback;
  return raw;
}
