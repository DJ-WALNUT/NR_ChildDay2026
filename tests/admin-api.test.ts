import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiBlob, setCsrf } from "../src/api/client";
import { adminKeys, listAudit, updateEvent, uploadEventLogo } from "../src/api/admin";
import { adminBoothSource } from "../src/booth/adminSource";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Init = { method: string; credentials: string; headers: Record<string, string>; body?: unknown };
let fetchMock: ReturnType<typeof vi.fn<(url: string, init: Init) => Promise<Response>>>;
let unauthorized: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE", "");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  unauthorized = vi.fn();
  window.addEventListener("nr:unauthorized", unauthorized);
  setCsrf("tok");
});
afterEach(() => {
  window.removeEventListener("nr:unauthorized", unauthorized);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  setCsrf(null);
});

describe("apiBlob", () => {
  it("returns the body as a Blob", async () => {
    fetchMock.mockResolvedValue(
      new Response("DBDATA", { status: 200, headers: { "content-type": "application/octet-stream" } }),
    );
    const blob = await apiBlob("/api/admin/super/backup");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(6);
  });

  it("raises nr:unauthorized and ApiError(401) on 401", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(401, { error: "unauthorized" })));
    const err = await apiBlob("/api/admin/super/backup").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, code: "unauthorized" });
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
});

describe("admin requests", () => {
  it("uploads a logo as FormData field 'file' with CSRF", async () => {
    fetchMock.mockResolvedValue(json(200, { logo_url: "/x.png" }));
    const file = new File(["x"], "a.png", { type: "image/png" });
    await uploadEventLogo(1, file);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/events/1/logo");
    expect(init.method).toBe("PUT");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
    expect(init.headers["X-CSRF-Token"]).toBe("tok");
  });

  it("sends an explicit null notice", async () => {
    fetchMock.mockResolvedValue(json(200, { event: { id: 1 } }));
    await updateEvent(1, { notice: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/events/1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"notice":null}');
  });

  it("builds the audit query only from given params", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(200, { items: [], next_before: null })));
    await listAudit(1, { before: 9, action: "booth" });
    await listAudit(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/orgs/1/audit?before=9&action=booth");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/admin/orgs/1/audit");
  });

  it("scopes every key under 'admin'", () => {
    const keys = [
      adminKeys.overview(1),
      adminKeys.events(1),
      adminKeys.event(1),
      adminKeys.booths(1),
      adminKeys.partners(1),
      adminKeys.linkTargets(1),
      adminKeys.members(1),
      adminKeys.audit(1, "booth"),
      adminKeys.superOrgs(),
    ];
    for (const k of keys) expect(k[0]).toBe("admin");
  });
});

describe("adminBoothSource", () => {
  const booth = { id: 7, name: "부스" };
  const org = { name: "기관", slug: "org" };
  const stats = { rows: [], male: 0, female: 0, total: 0 };

  it("merges booth+org, reservations and stats from admin routes only", async () => {
    fetchMock.mockImplementation((url) => {
      if (url === "/api/admin/booths/7") return Promise.resolve(json(200, { booth, org }));
      if (url === "/api/admin/booths/7/reservations") return Promise.resolve(json(200, { reservations: [{ id: 1 }] }));
      if (url === "/api/admin/stats") return Promise.resolve(json(200, stats));
      return Promise.resolve(json(404, { error: "not_found" }));
    });
    const src = adminBoothSource(7);
    expect(src.key).toEqual(["admin", "booth", 7]);
    const d = await src.get();
    expect(d).toEqual({ booth, org, reservations: [{ id: 1 }], stats });
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => u.includes("/api/public/"))).toBe(false);
    const statsCall = fetchMock.mock.calls.find((c) => c[0] === "/api/admin/stats")!;
    expect(statsCall[1].body).toBe('{"booth_ids":[7],"mode":"simple"}');
  });

  it("exports through POST /api/admin/export", async () => {
    fetchMock.mockResolvedValue(json(200, { booths: [] }));
    await adminBoothSource(7).exportData();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/export");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"booth_ids":[7]}');
  });
});
