import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  numeric?: boolean;
  /** 이름·문장처럼 긴 값이 들어가는 칸. 기본은 줄바꿈 없이 두고(좁은 화면에서 글자가 한 자씩 쪼개지지 않게), 이 칸만 줄바꿈한다. */
  wrap?: boolean;
}

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" };

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  caption,
  scrollHint = false,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  /** 표 이름. 화면에는 보이지 않고 스크린리더가 읽어요. */
  caption?: string;
  /** 뒤쪽 칸이 화면 밖으로 나가는 표. 좁은 화면에서만 표 위에 안내 글자를 둔다. */
  scrollHint?: boolean;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const align = (c: Column<T>) => ALIGN[c.align ?? (c.numeric ? "right" : "left")];
  return (
    <>
      {scrollHint && <p className="text-13 text-muted sm:hidden">옆으로 밀면 더 있어요</p>}
      {/* 가로로 스크롤되는 영역은 키보드로도 닿아야 해서 초점을 받게 한다. relative 는 머리글의 sr-only(absolute)가 영역 밖으로 새어 페이지를 넓히지 않게 한다. */}
      <div
        className="relative overflow-x-auto"
        tabIndex={0}
        role={caption ? "region" : undefined}
        aria-label={caption}
      >
        <table className="w-full border-collapse text-15">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b-2 border-ink">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 text-13 font-bold ${align(c)}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-rule-2">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 ${align(c)} ${c.numeric ? "tabular-nums" : ""} ${c.wrap ? "min-w-40 [overflow-wrap:anywhere]" : "whitespace-nowrap"}`}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
