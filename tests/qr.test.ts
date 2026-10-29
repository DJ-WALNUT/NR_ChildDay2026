import { describe, expect, it } from "vitest";
import { qrLabelLayout } from "../src/lib/qr";

const measure = (s: string) => [...s].length * 10;

describe("qrLabelLayout", () => {
  it("짧으면 그대로", () => {
    expect(qrLabelLayout("부스", "부스 관리", 100, measure)).toEqual({ title: "부스", subtitle: "부스 관리" });
  });
  it("길면 …로 줄여 폭 안에 넣음", () => {
    const r = qrLabelLayout("가나다라마바사아자차", "방문객 신청", 55, measure);
    expect(r.title.endsWith("…")).toBe(true);
    expect(measure(r.title)).toBeLessThanOrEqual(55);
    expect(r.title).toBe("가나다라…");
    expect(r.subtitle).toBe("방문객 신청");
  });
});
