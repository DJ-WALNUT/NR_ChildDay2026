import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Stats } from "../api/types";
import { DataTable } from "../ui";

type Row = { age_group: string; male: number; female: number; total: number };

export function StatsTable({ stats }: { stats: Stats }) {
  const [open, setOpen] = useState(false);
  const rows: Row[] = [...stats.rows, { age_group: "합계", male: stats.male, female: stats.female, total: stats.total }];
  return (
    <section aria-label="연령대별 통계">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center justify-between text-15 font-extrabold"
      >
        연령대·성별 통계
        <ChevronDown aria-hidden className={`size-5 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <DataTable
          rows={rows}
          rowKey={(r) => r.age_group}
          columns={[
            { key: "age_group", header: "연령대" },
            { key: "male", header: "남", numeric: true },
            { key: "female", header: "여", numeric: true },
            { key: "total", header: "합계", numeric: true },
          ]}
        />
      )}
    </section>
  );
}
