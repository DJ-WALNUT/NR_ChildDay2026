import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/qr", () => ({
  renderQrPng: vi.fn(async (value: string) => new Blob([value], { type: "image/png" })),
}));
import { renderQrPng } from "../src/lib/qr";
import { buildQrZip, qrEntries } from "../src/lib/qrZip";

const booth = (name: string) => ({ name, manage: `https://x/b/${name}`, reserve: `https://x/o/reserve/${name}` });

describe("qrEntries", () => {
  it("부스마다 방문객 신청·부스 관리, 이어서 운영 단체", () => {
    const list = qrEntries({
      eventName: "가을 축제",
      booths: [booth("a"), booth("b")],
      partners: [{ name: "청년부", link: "https://x/p/t" }],
    });
    expect(list.map((e) => e.fileName)).toEqual([
      "01_a_방문객신청.png",
      "01_a_부스관리.png",
      "02_b_방문객신청.png",
      "02_b_부스관리.png",
      "운영단체_01_청년부_실적.png",
    ]);
    expect(list[0]).toMatchObject({ value: "https://x/o/reserve/a", title: "a", subtitle: "방문객 신청" });
    expect(list[1]).toMatchObject({ value: "https://x/b/a", subtitle: "부스 관리" });
    expect(list[4]).toMatchObject({ value: "https://x/p/t", title: "청년부", subtitle: "운영 단체 실적" });
  });

  it("부스가 100개 이상이면 번호는 3자리", () => {
    const booths = Array.from({ length: 100 }, (_, i) => booth(`b${i}`));
    const list = qrEntries({ eventName: "e", booths, partners: [] });
    expect(list[0].fileName).toBe("001_b0_방문객신청.png");
    expect(list[list.length - 1].fileName).toBe("100_b99_부스관리.png");
  });

  it("이름이 같은 부스도 파일명이 모두 다르고, 금지 문자는 빠진다", () => {
    const list = qrEntries({
      eventName: "e",
      booths: [booth("같은"), booth("같은"), booth("a/b:c")],
      partners: [],
    });
    const names = list.map((e) => e.fileName);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("03_abc_방문객신청.png");
    for (const n of names) expect(n).not.toMatch(/[/:*?"<>|\\]/);
  });
});

describe("buildQrZip", () => {
  it("항목 수가 맞고 진행 표시의 마지막이 (n, n)", async () => {
    const entries = qrEntries({
      eventName: "e",
      booths: [booth("a"), booth("b")],
      partners: [{ name: "p", link: "https://x/p/t" }],
    });
    const onProgress = vi.fn();
    const blob = await buildQrZip(entries, onProgress);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(entries.map((e) => e.fileName).sort());
    expect(onProgress).toHaveBeenLastCalledWith(5, 5);
    expect(renderQrPng).toHaveBeenCalledTimes(5);
  });
});
