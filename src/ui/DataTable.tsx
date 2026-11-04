import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  numeric?: boolean;
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" };

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  /** 표 이름. 화면에는 보이지 않고 스크린리더가 읽어요. */
  caption?: string;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const align = (c: Column<T>) => ALIGN[c.align ?? (c.numeric ? "right" : "left")];
  return (
    // 가로로 스크롤되는 영역은 키보드로도 닿아야 해서 초점을 받게 한다.
    <div
      className="overflow-x-auto"
      tabIndex={0}
      role={caption ? "region" : undefined}
      aria-label={caption}
    >
      <table className="w-full border-collapse text-15">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b-2 border-ink">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`px-3 py-2 text-13 font-bold ${align(c)}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-rule-2">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${align(c)} ${c.numeric ? "tabular-nums" : ""}`}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
