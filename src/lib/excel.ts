import type { ExportData, ReservationStatus, Stats } from "../api/types";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  normal: "입장 가능",
  waiting: "대기",
  noshow: "노쇼",
  completed: "체험완료",
};

const headers = (ageLabel: string) => ["시간", "이름", "성별", ageLabel, "식별번호", "상태", "신청 시각"];

/** 합계 방식 이름과 설명. 화면(StatsPanel)과 엑셀 합계 시트가 같은 문구를 써요. */
export const MODE_LABEL = { simple: "단순 합계", strict: "엄격 합계" } as const;
export const modeNote = (mode: "simple" | "strict", ageLabel: string) =>
  mode === "simple" ? "신청 건수를 그대로 더해요." : `이름·성별·${ageLabel} 항목이 같으면 1명으로 세요.`;

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
    ws.addRow(headers(stats.age_label)).font = { bold: true };
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
  ws.addRow([`${MODE_LABEL[opts.mode]} - ${modeNote(opts.mode, stats.age_label)}`]).font = { bold: true };
  ws.addRow([stats.age_label, "남", "여", "합계"]).font = { bold: true };
  for (const r of stats.rows) ws.addRow([r.removed ? `${r.age_group} (이전 선택지)` : r.age_group, r.male, r.female, r.total]);
  ws.addRow(["전체 합계", stats.male, stats.female, stats.total]).font = { bold: true };
  ws.columns = [24, 8, 8, 8].map((width) => ({ width }));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** 파일 이름에 못 쓰는 문자를 뺀다. */
export const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();

export function rosterFileName(
  kind: "booth" | "partner" | "event",
  eventName: string,
  name?: string,
): string {
  const ev = safeFileName(eventName);
  if (kind === "event") return `[${ev}]_실적.xlsx`;
  const n = safeFileName(name ?? "");
  return kind === "booth" ? `[${ev}]_${n}_명단.xlsx` : `[${ev}]_${n}_실적.xlsx`;
}

/** 행사 링크 모음. 주소는 모두 절대 주소여야 해요. */
export interface LinkSheetInput {
  eventName: string;
  booths: { name: string; manage: string; reserve: string }[];
  partners: { name: string; link: string }[];
}

export async function buildLinksWorkbook(input: LinkSheetInput): Promise<ArrayBuffer> {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const booths = wb.addWorksheet("부스 링크");
  booths.addRow(["행사", "부스", "부스 관리 링크", "방문객 신청 링크"]).font = { bold: true };
  for (const b of input.booths) booths.addRow([input.eventName, b.name, b.manage, b.reserve]);
  booths.columns = [20, 24, 50, 50].map((width) => ({ width }));
  if (input.partners.length > 0) {
    const ws = wb.addWorksheet("운영 단체 링크");
    ws.addRow(["행사", "운영 단체", "실적 링크"]).font = { bold: true };
    for (const p of input.partners) ws.addRow([input.eventName, p.name, p.link]);
    ws.columns = [20, 24, 50].map((width) => ({ width }));
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
