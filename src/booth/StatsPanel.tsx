import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { messageFor } from "../api/messages";
import type { Booth, ExportData, Stats, StatsMode } from "../api/types";
import { downloadBlob } from "../lib/download";
import { buildRosterWorkbook, MODE_LABEL, MODE_NOTE } from "../lib/excel";
import { Button, Notice, Spinner, Tabs } from "../ui";
import { StatsTable } from "./StatsTable";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MODES = [
  { id: "simple", label: MODE_LABEL.simple },
  { id: "strict", label: MODE_LABEL.strict },
];

type Shown = { key: string; stats: Stats };
type Failed = { key: string; error: unknown };

/**
 * 부스를 골라 합계를 보고 통합 엑셀을 받는 패널. 운영 단체 화면과 행사 실적 탭이 함께 써요.
 * 선택 상태는 처음 받은 booths 로 정해져요. 부스 목록이나 loadStats/loadExport 가 바뀌는 곳
 * (다른 토큰·행사)에서는 부모가 `key` 를 바꿔 새로 시작하게 해 주세요.
 */
export function StatsPanel({
  booths,
  loadStats,
  loadExport,
  fileName,
}: {
  booths: Booth[];
  loadStats: (ids: number[], mode: StatsMode) => Promise<Stats>;
  loadExport: (ids: number[]) => Promise<ExportData>;
  fileName: () => string;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(booths.map((b) => b.id)));
  const [mode, setMode] = useState<StatsMode>("simple");
  const [shown, setShown] = useState<Shown | null>(null);
  const [failed, setFailed] = useState<Failed | null>(null);
  const [retry, setRetry] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // 부스 목록 순서를 지킨 선택 id
  const ids = booths.filter((b) => selected.has(b.id)).map((b) => b.id);
  const key = `${mode}:${ids.join(",")}`;
  const load = useRef(loadStats);
  load.current = loadStats;

  useEffect(() => {
    if (ids.length === 0) return;
    let stale = false;
    setFailed((f) => (f && f.key === key ? null : f)); // 다시 방문한 선택은 옛 오류를 지우고 새로 받는다
    load.current(ids, mode).then(
      (s) => {
        if (stale) return;
        setShown({ key, stats: s });
        setFailed((f) => (f && f.key === key ? null : f));
      },
      (e) => !stale && setFailed({ key, error: e }),
    );
    return () => {
      stale = true;
    };
    // ids 는 key 에서 나온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // 보이는 값은 key 가 맞는 것만 인정해서, 선택이 바뀐 바로 그 렌더부터 옛 오류·옛 숫자가 현재 것으로 보이지 않게 한다.
  const current = shown && shown.key === key ? shown.stats : null;
  const error = failed && failed.key === key ? failed.error : null;
  // 새 값을 기다리는 동안엔 이전 숫자를 흐리게 남겨 깜빡임을 줄인다.
  const previous = !current && !error ? (shown?.stats ?? null) : null;
  const display = current ?? previous;

  async function exportXlsx() {
    if (!current) return;
    setExporting(true);
    setExportError(null);
    try {
      const data = await loadExport(ids);
      const buf = await buildRosterWorkbook(data, current, { mode });
      downloadBlob(buf, fileName(), XLSX);
    } catch (err) {
      setExportError(messageFor(err, "엑셀 파일을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요."));
    } finally {
      setExporting(false);
    }
  }

  return (
    <section aria-label="실적" className="space-y-4">
      <fieldset className="space-y-1">
        <legend className="text-15 font-extrabold">합계에 포함할 부스</legend>
        <div className="flex flex-wrap gap-2 py-1">
          <Button variant="secondary" onClick={() => setSelected(new Set(booths.map((b) => b.id)))}>
            전체 선택
          </Button>
          <Button variant="secondary" onClick={() => setSelected(new Set())}>
            전체 해제
          </Button>
        </div>
        {booths.map((b) => (
          <label key={b.id} className="flex min-h-11 items-center gap-3 text-15 font-bold break-words">
            <input type="checkbox" className="size-5 shrink-0 accent-ink" checked={selected.has(b.id)} onChange={() => toggle(b.id)} />
            {b.name}
          </label>
        ))}
      </fieldset>

      <Tabs items={MODES} value={mode} onChange={(m) => setMode(m as StatsMode)} />
      <p className="text-13 text-muted">{MODE_NOTE[mode]}</p>

      <div aria-live="polite" aria-busy={ids.length > 0 && !current && !error}>
        {ids.length === 0 ? (
          <p className="text-15 text-muted">부스를 하나 이상 골라 주세요.</p>
        ) : error ? (
          <Notice
            tone="error"
            action={{
              label: "다시 시도",
              onClick: () => {
                setFailed(null);
                setRetry((n) => n + 1);
              },
            }}
          >
            {messageFor(error)}
          </Notice>
        ) : display ? (
          <div className={current ? "" : "opacity-50"}>
            <Totals stats={display} />
            <StatsTable stats={display} />
          </div>
        ) : (
          <Spinner />
        )}
      </div>

      {exportError && <Notice tone="error">{exportError}</Notice>}
      <Button variant="secondary" loading={exporting} disabled={ids.length === 0 || !current} onClick={() => void exportXlsx()}>
        <Download aria-hidden className="size-4" />
        통합 엑셀
      </Button>
    </section>
  );
}

function Totals({ stats }: { stats: Stats }) {
  const cells: [string, number][] = [
    ["남", stats.male],
    ["여", stats.female],
    ["합계", stats.total],
  ];
  return (
    <dl aria-label="합계" className="mb-4 grid grid-cols-3 gap-2 text-15">
      {cells.map(([label, v]) => (
        <div key={label} className="rounded-md border border-rule-2 p-3">
          <dt className="text-13 text-muted">{label}</dt>
          <dd className="text-22 font-extrabold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
