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
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const align = (c: Column<T>) => ALIGN[c.align ?? (c.numeric ? "right" : "left")];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-15">
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
