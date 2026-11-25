import type { Stats } from "../api/types";

const percent = (n: number, total: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

// 노랑은 종이 위 대비가 낮아서 잉크 테두리로 모양을 잡는다. 정확한 값은 옆 칸의 숫자가 맡는다.
const MALE = "rounded-sm bg-ink";
const FEMALE = "rounded-sm border border-ink bg-ticket";

/** 가장 많은 항목을 꽉 찬 길이로 두고, 그 안을 남·여 비율로 나눈 막대. */
function Bar({ male, female, max }: { male: number; female: number; max: number }) {
  const total = male + female;
  if (total === 0) return null;
  return (
    <div aria-hidden className="flex h-3 gap-0.5" style={{ width: `${percent(total, max)}%` }}>
      {male > 0 && <div className={MALE} style={{ flexGrow: male }} />}
      {female > 0 && <div className={FEMALE} style={{ flexGrow: female }} />}
    </div>
  );
}

function Num({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <td className={`whitespace-nowrap px-1 py-2 text-right tabular-nums sm:px-2 ${value === 0 ? "text-muted" : ""}`}>
      {value}
      {suffix}
    </td>
  );
}

const HEAD = "whitespace-nowrap px-1 py-2 text-right text-13 font-bold sm:px-2";

export function StatsTable({ stats }: { stats: Stats }) {
  const max = Math.max(0, ...stats.rows.map((r) => r.total));
  return (
    <section aria-label={`${stats.age_label}별 통계`} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-15 font-extrabold">{stats.age_label}·성별 통계</h2>
        <ul className="flex gap-3 text-13 font-bold">
          <li className="flex items-center gap-1">
            <span aria-hidden className={`size-3 ${MALE}`} />남
          </li>
          <li className="flex items-center gap-1">
            <span aria-hidden className={`size-3 ${FEMALE}`} />여
          </li>
        </ul>
      </div>
      <table className="w-full border-collapse text-15">
        <caption className="sr-only">{stats.age_label}·성별 통계</caption>
        <thead>
          <tr className="border-b-2 border-ink">
            <th scope="col" className="max-w-32 break-words py-2 pr-2 text-left text-13 font-bold sm:max-w-none">
              {stats.age_label}
            </th>
            <th scope="col" className={HEAD}>
              남
            </th>
            <th scope="col" className={HEAD}>
              여
            </th>
            <th scope="col" className={HEAD}>
              합계
            </th>
            <th scope="col" className={HEAD}>
              비율
            </th>
            <th scope="col" className="py-2 pl-2 text-left text-13 font-bold sm:w-1/3">
              분포
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.rows.map((r) => (
            <tr key={r.age_group} className="border-b border-rule-2">
              <th scope="row" className="max-w-32 break-words py-2 pr-2 text-left font-bold sm:max-w-none">
                {r.age_group}
                {r.removed && <span className="block text-13 font-normal text-muted">이전 선택지</span>}
              </th>
              <Num value={r.male} />
              <Num value={r.female} />
              <Num value={r.total} />
              <Num value={percent(r.total, stats.total)} suffix="%" />
              <td className="min-w-12 py-2 pl-2">
                <Bar male={r.male} female={r.female} max={max} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink font-extrabold">
            <th scope="row" className="py-2 pr-2 text-left">
              합계
            </th>
            <Num value={stats.male} />
            <Num value={stats.female} />
            <Num value={stats.total} />
            <Num value={stats.total === 0 ? 0 : 100} suffix="%" />
            <td />
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
