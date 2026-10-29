import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildRosterWorkbook, formatKst, rosterFileName, sheetName } from "../src/lib/excel";
import type { ExportData, Stats } from "../src/api/types";

const data: ExportData = {
  booths: [
    {
      booth_id: 1,
      event_name: "어린이날",
      booth_name: "페이스페인팅",
      rows: [
        { slot: "11시 A타임", name: "홍길동", gender: "남", age_group: "9~13세", code: "1234", status: "normal", created_at: Date.UTC(2026, 4, 5) / 1000 },
        { slot: "11시 B타임", name: "김영희", gender: "여", age_group: "4~8세", code: "0042", status: "noshow", created_at: Date.UTC(2026, 4, 5, 15, 30) / 1000 },
      ],
    },
    { booth_id: 2, event_name: "어린이날", booth_name: "로봇 코딩", rows: [] },
  ],
};
const stats: Stats = {
  rows: [
    { age_group: "9~13세", male: 1, female: 0, total: 1 },
    { age_group: "4~8세", male: 0, female: 1, total: 1 },
  ],
  male: 1,
  female: 1,
  total: 2,
};

async function load(mode: "simple" | "strict") {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await buildRosterWorkbook(data, stats, { mode }));
  return wb;
}
const cells = (ws: ExcelJS.Worksheet, n: number) => (ws.getRow(n).values as unknown[]).slice(1);

describe("buildRosterWorkbook", () => {
  it("부스별 시트 + 합계 시트", async () => {
    const wb = await load("simple");
    expect(wb.worksheets.map((w) => w.name)).toEqual(["페이스페인팅", "로봇 코딩", "합계"]);
    const ws = wb.worksheets[0];
    expect(cells(ws, 1)).toEqual(["시간", "이름", "성별", "연령", "식별번호", "상태", "신청 시각"]);
    expect(cells(ws, 2)).toEqual(["11시 A타임", "홍길동", "남", "9~13세", "1234", "입장 가능", "2026-05-05 09:00"]);
    expect(cells(ws, 3)).toEqual(["11시 B타임", "김영희", "여", "4~8세", "0042", "노쇼", "2026-05-06 00:30"]);
  });
  it("합계 시트", async () => {
    const wb = await load("strict");
    const ws = wb.getWorksheet("합계")!;
    expect(ws.getCell("A1").value).toBe("엄격 합계(이름·성별·연령 같으면 1명)");
    expect(ws.getRow(ws.rowCount).getCell(4).value).toBe(stats.total);
    expect((await load("simple")).getWorksheet("합계")!.getCell("A1").value).toBe("단순 합계");
  });
});

describe("추가 규칙", () => {
  it("상태 번역, 합계 시트 행, 수식 문자열", async () => {
    const d: ExportData = {
      booths: [
        {
          booth_id: 1,
          event_name: "행사",
          booth_name: "합계",
          rows: [
            { slot: "10시", name: "=1+1", gender: "남", age_group: "4~8세", code: "0001", status: "waiting", created_at: 0 },
            { slot: "10시", name: "다", gender: "여", age_group: "4~8세", code: "0002", status: "completed", created_at: 0 },
          ],
        },
      ],
    };
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await buildRosterWorkbook(d, stats, { mode: "simple" }));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["합계 (2)", "합계"]);
    const ws = wb.worksheets[0];
    expect(cells(ws, 2)[5]).toBe("대기");
    expect(cells(ws, 3)[5]).toBe("체험완료");
    const c = ws.getCell("B2");
    expect(c.value).toBe("=1+1");
    expect(c.type).toBe(ExcelJS.ValueType.String);
    const t = wb.getWorksheet("합계")!;
    expect(cells(t, 3)).toEqual(["9~13세", 1, 0, 1]);
    expect(cells(t, 4)).toEqual(["4~8세", 0, 1, 1]);
    expect(cells(t, 5)).toEqual(["전체 합계", 1, 1, 2]);
  });
});

describe("sheetName", () => {
  it("작은따옴표·History·합계 충돌", () => {
    expect(sheetName("'부스'", new Set())).toBe("부스");
    expect(sheetName("History", new Set())).toBe("History (2)");
    expect(sheetName("history", new Set())).toBe("history (2)");
    expect(sheetName("합계", new Set(["합계"]))).toBe("합계 (2)");
  });
  it("금지 문자 제거", () => expect(sheetName("a/b:c", new Set())).toBe("abc"));
  it("31자로 자름", () => expect([...sheetName("가".repeat(40), new Set())]).toHaveLength(31));
  it("비면 시트", () => expect(sheetName("///", new Set())).toBe("시트"));
  it("중복이면 번호", () => {
    const t = new Set<string>();
    expect(sheetName("부스", t)).toBe("부스");
    expect(sheetName("부스", t)).toBe("부스 (2)");
    expect(sheetName("부스", t)).toBe("부스 (3)");
    const long = "가".repeat(40);
    const t2 = new Set<string>();
    sheetName(long, t2);
    const second = sheetName(long, t2);
    expect([...second]).toHaveLength(31);
    expect(second.endsWith(" (2)")).toBe(true);
  });
});

describe("rosterFileName / formatKst", () => {
  it("파일명", () => {
    expect(rosterFileName("booth", "어린이날", "부스/1")).toBe("[어린이날]_부스1_명단.xlsx");
    expect(rosterFileName("partner", "행:사", "단체")).toBe("[행사]_단체_실적.xlsx");
    expect(rosterFileName("event", "어린이날")).toBe("[어린이날]_실적.xlsx");
  });
  it("KST", () => expect(formatKst(0)).toBe("1970-01-01 09:00"));
});
