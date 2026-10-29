import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeCode, normalizeName } from "../src/lib/identity";
import { availabilitySummary, compareSlots, slotHour } from "../src/lib/slots";
import { clearTicket, loadTicket, saveTicket } from "../src/lib/ticketStore";

describe("normalizeCode", () => {
  const cases: [string, string | null][] = [
    ["1234", "1234"], ["12-34", "1234"], [" 1 2 3 4 ", "1234"], ["１２３４", null], ["１2345", null],
    ["123", null], ["12345", null], ["abcd", null], ["", null], ["²345", null], ["١٢٣٤", null],
  ];
  it.each(cases)("%s -> %s", (input, want) => {
    const r = normalizeCode(input);
    if (want === null) expect(r.ok).toBe(false);
    else expect(r).toEqual({ ok: true, value: want });
  });
  it("messages", () => {
    const wide = { ok: false, message: "숫자는 일반 숫자(0~9)로 입력해 주세요." };
    expect(normalizeCode("１２３４")).toEqual(wide);
    expect(normalizeCode("１2345")).toEqual(wide);
    expect(normalizeCode("123")).toEqual({ ok: false, message: "식별번호는 숫자 4자리예요." });
    expect(normalizeCode("abcd")).toEqual({ ok: false, message: "식별번호는 숫자 4자리예요." });
  });
});

describe("normalizeName", () => {
  it("trims", () => expect(normalizeName("  홍길동 ")).toEqual({ ok: true, value: "홍길동" }));
  it("empty", () => {
    expect(normalizeName("")).toEqual({ ok: false, message: "참가자 이름을 입력해 주세요." });
    expect(normalizeName(" ")).toEqual({ ok: false, message: "참가자 이름을 입력해 주세요." });
  });
  it("length", () => {
    expect(normalizeName("가".repeat(50)).ok).toBe(true);
    expect(normalizeName("가".repeat(51))).toEqual({ ok: false, message: "이름은 50자까지 입력할 수 있어요." });
  });
});

describe("slots", () => {
  it("slotHour", () => {
    expect(slotHour("11시 A타임")).toBe(11);
    expect(slotHour("9시 B타임")).toBe(9);
    expect(slotHour("선착순")).toBe(-1);
    expect(slotHour("A 9시")).toBe(-1);
  });
  it("compareSlots orders like the server", () => {
    const l = ["11시 A타임", "9시 B타임", "9시 A타임", "선착순"];
    expect([...l].sort(compareSlots)).toEqual(["선착순", "9시 A타임", "9시 B타임", "11시 A타임"]);
    expect(compareSlots("a", "a")).toBe(0);
  });
  const t = (slots: { label: string; remaining: number | null; full: boolean }[], is_closed = false) => ({ slots, is_closed });
  const s = (label: string, remaining: number | null, full = false) => ({ label, remaining, full });
  it("availabilitySummary", () => {
    expect(availabilitySummary("time", t([s("9시", 2), s("10시", 3)]), false)).toBe("남은 자리 5");
    expect(availabilitySummary("time", t([s("9시", 2), s("10시", null)]), false)).toBe("자리 여유");
    expect(availabilitySummary("time", t([s("9시", 0, true), s("10시", 4)]), false)).toBe("남은 자리 4");
    expect(availabilitySummary("time", t([s("9시", 0, true)]), false)).toBe("마감");
    expect(availabilitySummary("time", t([s("9시", 0, true)]), true)).toBe("대기 접수 중");
    expect(availabilitySummary("time", t([s("9시", 1)], true), true)).toBe("마감");
    expect(availabilitySummary("fcfs", { remaining: 7, full: false, is_closed: false }, false)).toBe("남은 자리 7");
    expect(availabilitySummary("fcfs", { remaining: null, full: false, is_closed: false }, false)).toBe("자리 여유");
    expect(availabilitySummary("fcfs", { remaining: 0, full: true, is_closed: false }, false)).toBe("마감");
    expect(availabilitySummary("fcfs", { remaining: 0, full: true, is_closed: false }, true)).toBe("대기 접수 중");
    expect(availabilitySummary("fcfs", { remaining: 0, full: true, is_closed: true }, true)).toBe("마감");
  });
});

describe("ticketStore", () => {
  const tk = { booth_id: 3, slug: "nr", name: "홍길동", code: "1234" };
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  it("save then load, clear", () => {
    saveTicket(tk);
    expect(loadTicket(3)).toMatchObject(tk);
    expect(localStorage.getItem("nr.ticket.3")).not.toBeNull();
    clearTicket(3);
    expect(loadTicket(3)).toBeNull();
    expect(loadTicket(99)).toBeNull();
  });
  it("expires after 24h and removes the key", () => {
    const now = Date.now();
    saveTicket(tk);
    vi.spyOn(Date, "now").mockReturnValue(now + 25 * 3600 * 1000);
    expect(loadTicket(3)).toBeNull();
    expect(localStorage.getItem("nr.ticket.3")).toBeNull();
  });
  it("corrupt data returns null", () => {
    localStorage.setItem("nr.ticket.3", "{not json");
    expect(loadTicket(3)).toBeNull();
  });
  it("never throws when storage throws", () => {
    const boom = () => { throw new Error("denied"); };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);
    expect(loadTicket(3)).toBeNull();
    expect(() => saveTicket(tk)).not.toThrow();
    expect(() => clearTicket(3)).not.toThrow();
  });
});
