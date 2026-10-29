export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;

  constructor(status: number, code: string, fields: Record<string, string> = {}) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let csrf: string | null = null;

export function setCsrf(token: string | null): void {
  csrf = token;
}

export function getCsrf(): string | null {
  return csrf;
}

/** API 서버 주소(빌드 시 VITE_API_BASE, 기본 같은 출처) + 경로. 로고 같은 절대 경로에도 쓴다. */
export function apiUrl(path: string): string {
  return `${(import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "")}${path}`;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// 이 경로의 401 은 전역 "로그인 필요" 이벤트를 일으키지 않는다(화면이 직접 처리).
const QUIET_401 = ["/api/admin/auth/login", "/api/admin/auth/me"];

function raisesUnauthorized(path: string): boolean {
  if (!path.startsWith("/api/admin/")) return false;
  return !QUIET_401.includes(path.split("?")[0]);
}

export async function api<T = unknown>(
  method: Method,
  path: string,
  body?: unknown | FormData,
): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (method !== "GET" && csrf && path.startsWith("/api/admin/")) headers["X-CSRF-Token"] = csrf;

  let res: Response;
  try {
    res = await fetch(apiUrl(path), { method, credentials: "include", headers, body: payload });
  } catch {
    throw new ApiError(0, "network");
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) return undefined as T;
    const text = await res.text();
    if (text.trim() === "") return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError(res.status, "bad_response");
    }
  }

  let code = `http_${res.status}`;
  let fields: Record<string, string> = {};
  if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const data = (await res.json()) as { error?: unknown; fields?: unknown };
      if (typeof data.error === "string") code = data.error;
      if (data.fields && typeof data.fields === "object") fields = data.fields as Record<string, string>;
    } catch {
      /* 본문이 깨졌으면 http_<status> 유지 */
    }
  }
  if (res.status === 401 && raisesUnauthorized(path)) window.dispatchEvent(new Event("nr:unauthorized"));
  throw new ApiError(res.status, code, fields);
}
