import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { BULK_HEADERS, MAX_BULK, buildBulkTemplate, bulkErrors, parseBulkWorkbook } from "../src/lib/bulkBooths";

type Cell = ExcelJS.CellValue;

/** 머리글 + 데이터 행으로 파일을 만들어 바이트로 돌려준다. */
async function sheet(rows: Cell[][], headers: string[] = BULK_HEADERS): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("부스");
  ws.addRow(headers);
  rows.forEach((r, i) => {
    // 빈 줄은 건너뛰고 실제 행 번호에 쓴다.
    const row = ws.getRow(i + 2);
    r.forEach((v, c) => {
      row.getCell(c + 1).value = v;
    });
  });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const NAME_ONLY = (name: string): Cell[] => [name];

describe("buildBulkTemplate", () => {
  it("머리글만 담고 예시 행은 없다", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await buildBulkTemplate());
    const ws = wb.worksheets[0];
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual(BULK_HEADERS);
    expect(ws.actualRowCount).toBe(1);
    const parsed = await parseBulkWorkbook(await buildBulkTemplate());
    expect(parsed).toEqual({ rows: [], problems: [] });
  });
});

describe("parseBulkWorkbook", () => {
  it("값을 서버 값으로 바꾼다", async () => {
    const r = await parseBulkWorkbook(
      await sheet([
        ["페이스페인팅", "타임별", 0, 11, 16, 3, 5, "Y"],
        ["풍선", "선착순", 30, null, null, null, null, "n"],
        ["소문자", "타임별", null, null, null, null, null, "y"],
      ]),
    );
    expect(r.problems).toEqual([]);
    expect(r.rows.map((x) => x.body)).toEqual([
      { name: "페이스페인팅", mode: "time", total_limit: 0, start_hour: 11, end_hour: 16, slots_per_hour: 3, limit_per_slot: 5, use_waitlist: true },
      { name: "풍선", mode: "fcfs", total_limit: 30, use_waitlist: false },
      { name: "소문자", mode: "time", use_waitlist: true },
    ]);
  });

  it("빈 칸은 키를 넣지 않는다", async () => {
    const r = await parseBulkWorkbook(await sheet([NAME_ONLY("솜사탕")]));
    expect(r.rows[0].body).toEqual({ name: "솜사탕" });
    expect(Object.keys(r.rows[0].body)).toEqual(["name"]);
  });

  it("빈 줄을 건너뛰어도 sheetRow 는 실제 행 번호다", async () => {
    const r = await parseBulkWorkbook(await sheet([NAME_ONLY("가"), [], NAME_ONLY("나")]));
    expect(r.rows.map((x) => x.sheetRow)).toEqual([2, 4]);
  });

  it("열 순서가 달라도 머리글 이름으로 읽는다", async () => {
    const r = await parseBulkWorkbook(await sheet([[11, "가"]], ["시작시각", "부스이름"]));
    expect(r.problems).toEqual([]);
    expect(r.rows[0].body).toEqual({ name: "가", start_hour: 11 });
  });

  it("머리글이 없거나 부스이름 열이 없으면 첫 줄 문제", async () => {
    const msg = { sheetRow: 1, message: "양식의 첫 줄을 확인해 주세요." };
    expect((await parseBulkWorkbook(await sheet([["가"]], ["이름", "방식"]))).problems).toEqual([msg]);
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("빈 시트");
    const empty = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    expect((await parseBulkWorkbook(empty)).problems).toEqual([msg]);
  });

  it("시각 셀은 여러 모양을 받는다", async () => {
    const time = new Date(Date.UTC(1899, 11, 30, 10, 0));
    const cases: Cell[] = [10, "10", "10:00", "10시", time, { formula: "5*2", result: 10 }];
    const r = await parseBulkWorkbook(await sheet(cases.map((v) => ["가", null, null, v])));
    expect(r.problems).toEqual([]);
    expect(r.rows.map((x) => x.body.start_hour)).toEqual([10, 10, 10, 10, 10, 10]);
  });

  it("서식 있는 글자는 이어 붙여 읽는다", async () => {
    const rich: Cell = { richText: [{ text: "풍" }, { text: "선", font: { bold: true } }] };
    const r = await parseBulkWorkbook(await sheet([[rich]]));
    expect(r.rows[0].body.name).toBe("풍선");
  });

  it("수식 결과를 읽는다", async () => {
    const r = await parseBulkWorkbook(await sheet([["가", null, null, { formula: "6+6", result: 12 }]]));
    expect(r.rows[0].body.start_hour).toBe(12);
  });

  it("숫자가 아닌 시각은 그 행의 문제", async () => {
    const r = await parseBulkWorkbook(await sheet([NAME_ONLY("가"), ["나", null, null, "오전"]]));
    expect(r.problems).toEqual([{ sheetRow: 3, message: "시작시각을 숫자로 입력해 주세요." }]);
  });

  it("운영방식이 낯선 값이면 문제", async () => {
    const r = await parseBulkWorkbook(await sheet([["가", "상시"]]));
    expect(r.problems).toEqual([{ sheetRow: 2, message: "운영방식은 타임별 또는 선착순이에요." }]);
  });

  it("이름 없이 다른 값만 있는 행은 문제", async () => {
    const r = await parseBulkWorkbook(await sheet([[null, "타임별"]]));
    expect(r.problems).toEqual([{ sheetRow: 2, message: "부스이름을 입력해 주세요." }]);
  });

  it(`${MAX_BULK}개를 넘으면 문제`, async () => {
    const rows = Array.from({ length: MAX_BULK + 1 }, (_, i) => NAME_ONLY(`부스${i}`));
    const r = await parseBulkWorkbook(await sheet(rows));
    expect(r.problems.map((p) => p.message)).toContain("한 번에 500개까지 등록할 수 있어요.");
  }, 20_000);

  it("손상된 파일은 예외 대신 문제로 돌려준다", async () => {
    const bytes = new Uint8Array(64).map((_, i) => (i * 37) % 251).buffer;
    const r = await parseBulkWorkbook(bytes);
    expect(r.rows).toEqual([]);
    expect(r.problems).toEqual([{ sheetRow: 1, message: "엑셀 파일을 읽지 못했어요." }]);
  });
});

describe("bulkErrors", () => {
  const rows = [1, 2, 3].map((n) => ({ sheetRow: n + 1 + (n === 3 ? 1 : 0), body: { name: `부스${n}` } }));

  it("서버 인덱스를 엑셀 행 번호로 바꾼다", () => {
    const err = new ApiError(422, "invalid", { rows: { "1": "1~100자로 입력하세요." } } as unknown as Record<string, string>);
    expect(rows[1].sheetRow).toBe(3);
    expect(bulkErrors(err, rows)).toEqual([{ sheetRow: 3, message: "1~100자로 입력하세요." }]);
    const err2 = new ApiError(422, "invalid", { rows: { "2": "x" } } as unknown as Record<string, string>);
    expect(bulkErrors(err2, rows)).toEqual([{ sheetRow: 5, message: "x" }]);
  });

  it("rows 가 문자열이면 첫 줄에 붙인다", () => {
    const err = new ApiError(422, "invalid", { rows: "1~500개만 보낼 수 있어요." });
    expect(bulkErrors(err, rows)).toEqual([{ sheetRow: 1, message: "1~500개만 보낼 수 있어요." }]);
  });

  it("다른 오류는 null", () => {
    expect(bulkErrors(new ApiError(500, "server_error"), rows)).toBeNull();
    expect(bulkErrors(new ApiError(422, "invalid", { name: "x" }), rows)).toBeNull();
    expect(bulkErrors(new Error("x"), rows)).toBeNull();
  });
});

describe("parseBulkWorkbook 숫자 검증", () => {
  const first = async (row: Cell[]) => (await parseBulkWorkbook(await sheet([row]))).problems;
  const time = new Date(Date.UTC(1899, 11, 30, 10, 0));

  it.each([
    ["선착순 인원", 2, -1],
    ["선착순 인원", 2, 2.5],
    ["선착순 인원", 2, "2.5"],
    ["시작시각", 3, -1],
    ["종료시각", 4, "-3"],
    ["시간당 타임수", 5, 2.5],
    ["타임당 인원", 6, -1],
  ])("%s 에 %s 번째 칸 값 %s 는 문제", async (label, idx, value) => {
    const row: Cell[] = ["가", null, null, null, null, null, null];
    row[idx] = value;
    const p = await first(row);
    expect(p).toHaveLength(1);
    expect(p[0].sheetRow).toBe(2);
    expect(p[0].message).toContain(label);
  });

  it("시각이 아닌 칸에서는 HH:MM, N시, 날짜 셀을 받지 않는다", async () => {
    for (const v of ["10:30", "10시", time] as Cell[]) {
      expect((await first(["가", null, v])).length).toBe(1);
      expect((await first(["가", null, null, null, null, null, v])).length).toBe(1);
    }
  });

  it("시각 칸에서 0이 아닌 분은 문제", async () => {
    for (const col of [3, 4]) {
      const row: Cell[] = ["가", null, null, null, null];
      row[col] = "10:30";
      expect((await first(row)).length).toBe(1);
      row[col] = new Date(Date.UTC(1899, 11, 30, 10, 30));
      expect((await first(row)).length).toBe(1);
    }
  });
});
