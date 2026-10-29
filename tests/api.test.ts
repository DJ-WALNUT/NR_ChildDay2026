import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiUrl, setCsrf } from "../src/api/client";
import { fieldErrors, messageFor } from "../src/api/messages";
import { getPartnerBooth } from "../src/api/link";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn<(url: string, init: { credentials: string; headers: Record<string, string> }) => Promise<Response>>>;
let unauthorized: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE", "https://api.test");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  unauthorized = vi.fn();
  window.addEventListener("nr:unauthorized", unauthorized);
  setCsrf(null);
});
afterEach(() => {
  window.removeEventListener("nr:unauthorized", unauthorized);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("prefixes VITE_API_BASE and sends credentials", async () => {
    fetchMock.mockResolvedValue(json(200, { ok: 1 }));
    await api("GET", "/api/public/orgs/a");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/public/orgs/a");
    expect(init.credentials).toBe("include");
    expect(apiUrl("/api/public/assets/x.png")).toBe("https://api.test/api/public/assets/x.png");
  });

  it("sends CSRF only on admin mutations", async () => {
    setCsrf("t");
    fetchMock.mockImplementation(() => Promise.resolve(json(200, {})));
    await api("POST", "/api/admin/x", {});
    await api("POST", "/api/public/booths/1/reservations", {});
    await api("GET", "/api/admin/x");
    expect(fetchMock.mock.calls[0][1].headers["X-CSRF-Token"]).toBe("t");
    expect(fetchMock.mock.calls[1][1].headers["X-CSRF-Token"]).toBeUndefined();
    expect(fetchMock.mock.calls[2][1].headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("dispatches nr:unauthorized only for admin 401 (not login/me/public/link)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(401, { error: "unauthorized" })));
    for (const p of ["/api/link/booth/x", "/api/public/orgs/a", "/api/admin/auth/me", "/api/admin/auth/login"]) {
      await expect(api("GET", p)).rejects.toBeInstanceOf(ApiError);
    }
    expect(unauthorized).not.toHaveBeenCalled();
    await expect(api("GET", "/api/admin/events/1")).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });

  it("maps error codes to ApiError and Korean messages", async () => {
    fetchMock.mockResolvedValue(json(409, { error: "full" }));
    const err = await api("POST", "/api/public/booths/1/reservations", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: "full" });
    expect(messageFor(err)).toBe("이 시간은 마감됐어요.");
  });

  it("exposes 422 fields", async () => {
    fetchMock.mockResolvedValue(json(422, { error: "invalid", fields: { code: "식별번호는 숫자 4자리입니다." } }));
    const err = await api("POST", "/x", {}).catch((e) => e);
    expect(fieldErrors(err)).toEqual({ code: "식별번호는 숫자 4자리입니다." });
    expect(fieldErrors(new Error("x"))).toEqual({});
    expect(fieldErrors(new ApiError(409, "full", { a: "b" }))).toEqual({});
  });

  it("turns fetch rejection into a network ApiError", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await api("GET", "/api/public/orgs/a").catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: "network" });
    expect(messageFor(err)).toBe("연결이 불안정해요. 잠시 뒤 다시 시도해 주세요.");
  });

  it("returns undefined for 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await api("POST", "/api/public/booths/1/cancel", {})).toBeUndefined();
  });

  it("2xx 인데 JSON 이 아닌 본문은 bad_response 로 실패한다", async () => {
    fetchMock.mockResolvedValue(new Response("<!doctype html><html></html>", { status: 200, headers: { "content-type": "text/html" } }));
    const err = await api("GET", "/api/public/orgs/a").catch((e) => e);
    expect(err).toMatchObject({ status: 200, code: "bad_response" });
    expect(messageFor(err)).toBe("서버 응답을 읽지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  });

  it("2xx 이고 본문이 비어 있으면 content-type 과 상관없이 undefined", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200, headers: { "content-type": "text/html" } }));
    expect(await api("POST", "/api/public/booths/1/cancel", {})).toBeUndefined();
  });

  it("falls back for unknown codes and covers required codes", () => {
    const generic = "문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";
    expect(messageFor(new ApiError(500, "weird"))).toBe(generic);
    expect(messageFor(new ApiError(500, "weird"), "대체")).toBe("대체");
    expect(messageFor("not an error")).toBe(generic);
    for (const c of ["full", "closed", "duplicate", "not_cancellable", "rate_limited", "not_found", "invalid",
      "network", "unauthorized", "forbidden", "csrf", "file_too_large", "password_change_required",
      "invalid_credentials", "username_taken", "slug_taken", "last_active_user", "cannot_deactivate_self",
      "use_password_change"]) {
      expect(messageFor(new ApiError(400, c))).not.toBe(generic);
    }
  });

  it("builds partner booth path", async () => {
    fetchMock.mockResolvedValue(json(200, { booth: {} }));
    await getPartnerBooth("tok", 5);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/link/partner/tok/booths/5");
  });

  it("strips trailing slashes from VITE_API_BASE", () => {
    vi.stubEnv("VITE_API_BASE", "https://api.test/");
    expect(apiUrl("/api/public/orgs/a")).toBe("https://api.test/api/public/orgs/a");
  });

  it("sends FormData without a JSON Content-Type", async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    const fd = new FormData();
    fd.append("file", new Blob(["x"]), "a.png");
    await api("POST", "/api/admin/assets", fd);
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect((init as unknown as { body: unknown }).body).toBe(fd);
  });

  it("keeps auth/me quiet with a query string but not auth/logout", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(401, { error: "unauthorized" })));
    await expect(api("GET", "/api/admin/auth/me?x=1")).rejects.toBeInstanceOf(ApiError);
    expect(unauthorized).not.toHaveBeenCalled();
    await expect(api("POST", "/api/admin/auth/logout", {})).rejects.toBeInstanceOf(ApiError);
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
});
