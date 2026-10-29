import type { ExportData, ReservationStatus, Stats } from "../api/types";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  normal: "입장 가능",
  waiting: "대기",
  noshow: "노쇼",
  completed: "체험완료",
};

const HEADERS = ["시간", "이름", "성별", "연령", "식별번호", "상태", "신청 시각"];

/** 엑셀 시트 이름: 금지 문자 제거, 31자 이하, 비면 "시트", 중복이면 " (2)"… */
export function sheetName(raw: string, taken: Set<string>): string {
  const clean = (v: string) => v.trim().replace(/^'+|'+$/g, "").trim();
  let base = clean([...clean(raw.replace(/[\\/?*[\]:]/g, ""))].slice(0, 31).join(""));
  if (!base) base = "시트";
  // "History"는 엑셀 예약 이름
  const has = (n: string) =>
    n.toLowerCase() === "history" || [...taken].some((t) => t.toLowerCase() === n.toLowerCase());
  let name = base;
  for (let i = 2; has(name); i++) {
    const suffix = ` (${i})`;
    name = [...base].slice(0, 31 - suffix.length).join("") + suffix;
  }
  taken.add(name);
  return name;
}

/** UNIX 초 -> KST "YYYY-MM-DD HH:mm" (기기 시간대와 무관) */
export function formatKst(sec: number): string {
  const d = new Date((sec + 9 * 3600) * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export async function buildRosterWorkbook(
  data: ExportData,
  stats: Stats,
  opts: { mode: "simple" | "strict" },
): Promise<ArrayBuffer> {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const taken = new Set<string>(["합계"]); // 합계 시트 이름을 먼저 확보
  for (const b of data.booths) {
    const ws = wb.addWorksheet(sheetName(b.booth_name, taken));
    ws.addRow(HEADERS).font = { bold: true };
    for (const r of b.rows) {
      ws.addRow([
        r.slot,
        r.name,
        r.gender,
        r.age_group,
        r.code,
        STATUS_LABEL[r.status] ?? r.status,
        formatKst(r.created_at),
      ]);
    }
    ws.columns = [14, 16, 6, 12, 10, 12, 18].map((width) => ({ width }));
    ws.getColumn(5).numFmt = "@";
  }
  const ws = wb.addWorksheet("합계");
  ws.addRow([opts.mode === "strict" ? "엄격 합계(이름·성별·연령 같으면 1명)" : "단순 합계"]).font = { bold: true };
  ws.addRow(["연령대", "남", "여", "합계"]).font = { bold: true };
  for (const r of stats.rows) ws.addRow([r.age_group, r.male, r.female, r.total]);
  ws.addRow(["전체 합계", stats.male, stats.female, stats.total]).font = { bold: true };
  ws.columns = [24, 8, 8, 8].map((width) => ({ width }));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const stripName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();

export function rosterFileName(
  kind: "booth" | "partner" | "event",
  eventName: string,
  name?: string,
): string {
  const ev = stripName(eventName);
  if (kind === "event") return `[${ev}]_실적.xlsx`;
  const n = stripName(name ?? "");
  return kind === "booth" ? `[${ev}]_${n}_명단.xlsx` : `[${ev}]_${n}_실적.xlsx`;
}
