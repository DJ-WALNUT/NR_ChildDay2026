import type { CellValue } from "exceljs";
import { ApiError } from "../api/client";
import type { BoothSettings } from "../api/types";
import { downloadBlob } from "./download";

export const BULK_HEADERS = ["부스이름", "운영방식", "선착순 인원", "시작시각", "종료시각", "시간당 타임수", "타임당 인원", "대기자 접수"];
export const MAX_BULK = 500;
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const BULK_FILE_NAME = "부스_일괄등록_양식.xlsx";

/** sheetRow 는 엑셀의 실제 행 번호. 서버에는 보내지 않는다. */
export interface BulkRow {
  sheetRow: number;
  body: Partial<BoothSettings> & { name: string };
}
export type BulkProblem = { sheetRow: number; message: string };
export type ParseResult = { rows: BulkRow[]; problems: BulkProblem[] };

const HEADER_PROBLEM: BulkProblem = { sheetRow: 1, message: "양식의 첫 줄을 확인해 주세요." };

/** 양식 머리글에 달아 둘 입력 안내(셀 메모). */
const HINTS = [
  "예: 페이스페인팅",
  "타임별 또는 선착순. 비우면 타임별",
  "선착순일 때 정원. 0 또는 비우면 무제한",
  "0~23. 예: 11",
  "0~23. 예: 16",
  "1~6. 예: 3",
  "한 타임 정원. 0 또는 비우면 무제한",
  "Y 또는 N. 비우면 N",
];

export async function downloadBulkTemplate(): Promise<void> {
  downloadBlob(await buildBulkTemplate(), BULK_FILE_NAME, XLSX);
}

export async function buildBulkTemplate(): Promise<ArrayBuffer> {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const ws = wb.addWorksheet("부스");
  const head = ws.addRow(BULK_HEADERS);
  head.font = { bold: true };
  head.eachCell((cell, col) => {
    cell.note = HINTS[col - 1];
  });
  ws.columns = BULK_HEADERS.map(() => ({ width: 16 }));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** 셀 값을 글자 하나로: 수식은 결과, 서식 글자는 이어 붙임, 날짜·오류는 빈 글자. 숫자는 그대로 둔다. */
function plain(v: CellValue | undefined): string | number | Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || v instanceof Date) return v;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "boolean") return String(v);
  if ("result" in v) return plain(v.result as CellValue);
  if ("richText" in v) return v.richText.map((t) => t.text).join("").trim() || null;
  if ("text" in v) return String(v.text).trim() || null; // 하이퍼링크
  return null; // 오류 값
}

const eul = (label: string) => {
  const code = label.charCodeAt(label.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? "을" : "를";
};

/** 0 이상의 정수로 읽는다. 못 읽으면 undefined. 시각 칸(hour)만 "10:00", "10시", 시간 형식 날짜도 받고, 분이 0이 아니면 못 읽은 것으로 본다. */
function toInt(v: string | number | Date, hour: boolean): number | undefined {
  if (v instanceof Date) return hour && v.getUTCMinutes() === 0 ? v.getUTCHours() : undefined;
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 ? v : undefined;
  if (/^\d+$/.test(v)) return Number(v);
  const m = hour ? /^(\d{1,2})(?::(\d{2})(?::\d{2})?|\s*시)$/.exec(v) : null;
  return m && (m[2] === undefined || Number(m[2]) === 0) ? Number(m[1]) : undefined;
}

const MODES: Record<string, BoothSettings["mode"]> = { 타임별: "time", 선착순: "fcfs" };

const NUMBER_FIELDS = [
  ["선착순 인원", "total_limit"],
  ["시작시각", "start_hour"],
  ["종료시각", "end_hour"],
  ["시간당 타임수", "slots_per_hour"],
  ["타임당 인원", "limit_per_slot"],
] as const;

export async function parseBulkWorkbook(data: ArrayBuffer): Promise<ParseResult> {
  const fail = (problem: BulkProblem): ParseResult => ({ rows: [], problems: [problem] });
  let ws;
  try {
    const { Workbook } = await import("exceljs");
    const wb = new Workbook();
    await wb.xlsx.load(data);
    ws = wb.worksheets[0];
  } catch {
    return fail({ sheetRow: 1, message: "엑셀 파일을 읽지 못했어요." });
  }
  if (!ws) return fail(HEADER_PROBLEM);

  // 머리글 이름 -> 열 번호. 열 순서가 바뀌어도 읽는다.
  const col: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, n) => {
    const label = plain(cell.value);
    if (typeof label === "string" && BULK_HEADERS.includes(label)) col[label] = n;
  });
  if (!col["부스이름"]) return fail(HEADER_PROBLEM);

  const rows: BulkRow[] = [];
  const problems: BulkProblem[] = [];
  let filled = 0;
  for (let n = 2; n <= ws.rowCount; n++) {
    const raw: Record<string, ReturnType<typeof plain>> = {};
    for (const h of BULK_HEADERS) if (col[h]) raw[h] = plain(ws.getRow(n).getCell(col[h]).value);
    if (BULK_HEADERS.every((h) => raw[h] == null)) continue; // 빈 줄
    filled++;
    const bad = (message: string) => problems.push({ sheetRow: n, message });

    const name = raw["부스이름"];
    if (name == null) {
      bad("부스이름을 입력해 주세요.");
      continue;
    }
    const body: BulkRow["body"] = { name: String(name) };

    const mode = raw["운영방식"];
    if (mode != null) {
      const parsed = typeof mode === "string" ? MODES[mode] : undefined;
      if (parsed) body.mode = parsed;
      else bad("운영방식은 타임별 또는 선착순이에요.");
    }
    for (const [label, key] of NUMBER_FIELDS) {
      const v = raw[label];
      if (v == null) continue;
      const num = toInt(v, label === "시작시각" || label === "종료시각");
      if (num === undefined) bad(`${label}${eul(label)} 숫자로 입력해 주세요.`);
      else body[key] = num;
    }
    const wait = raw["대기자 접수"];
    if (wait != null) {
      const yn = String(wait).toUpperCase();
      if (yn === "Y" || yn === "N") body.use_waitlist = yn === "Y";
      else bad("대기자 접수는 Y 또는 N으로 입력해 주세요.");
    }
    rows.push({ sheetRow: n, body });
  }

  if (filled > MAX_BULK) return fail({ sheetRow: 1, message: `한 번에 ${MAX_BULK}개까지 등록할 수 있어요.` });
  return { rows, problems };
}

/** 서버의 422 `fields.rows`(문자열 또는 {인덱스: 문구})를 엑셀 행 번호별 문구로. 그 밖의 오류는 null. */
export function bulkErrors(err: unknown, rows: BulkRow[]): BulkProblem[] | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null;
  const raw: unknown = err.fields.rows;
  if (typeof raw === "string") return [{ sheetRow: 1, message: raw }];
  if (!raw || typeof raw !== "object") return null;
  return Object.entries(raw)
    .map(([index, message]) => ({ sheetRow: rows[Number(index)]?.sheetRow ?? 1, message: String(message) }))
    .sort((a, b) => a.sheetRow - b.sheetRow);
}
