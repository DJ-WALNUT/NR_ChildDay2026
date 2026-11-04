import { useId, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { adminKeys, bulkCreateBooths } from "../../api/admin";
import { messageFor } from "../../api/messages";
import type { AdminEvent } from "../../api/types";
import {
  BULK_FILE_NAME,
  buildBulkTemplate,
  bulkErrors,
  parseBulkWorkbook,
  type BulkProblem,
  type BulkRow,
} from "../../lib/bulkBooths";
import { downloadBlob } from "../../lib/download";
import { Button, DataTable, Modal, Notice, type Column } from "../../ui";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MODE = { time: "시간대별", fcfs: "선착순" };

const columns: Column<BulkRow>[] = [
  { key: "row", header: "행 번호", numeric: true, render: (r) => r.sheetRow },
  { key: "name", header: "이름", wrap: true, render: (r) => <span className="font-bold">{r.body.name}</span> },
  { key: "mode", header: "방식", render: (r) => (r.body.mode ? MODE[r.body.mode] : "기본값") },
];

function ProblemList({ items }: { items: BulkProblem[] }) {
  return (
    <ul className="space-y-1">
      {items.map((p, i) => (
        <li key={i}>
          <span className="font-bold tabular-nums">{p.sheetRow}행</span> <span>{p.message}</span>
        </li>
      ))}
    </ul>
  );
}

export default function BulkImport({ event, onClose }: { event: AdminEvent; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileId = useId();
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [problems, setProblems] = useState<BulkProblem[]>([]);
  const [serverProblems, setServerProblems] = useState<BulkProblem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setServerProblems([]);
    setError(null);
    setDone(null);
    // 파일 읽기 자체가 실패해도 문제 목록으로 보여 준다.
    const result = await file
      .arrayBuffer()
      .then(parseBulkWorkbook)
      .catch(() => ({ rows: [], problems: [{ sheetRow: 1, message: "엑셀 파일을 읽지 못했어요." }] }));
    setRows(result.rows);
    setProblems(result.problems);
  }

  async function submit() {
    setError(null);
    setServerProblems([]);
    setBusy(true);
    try {
      const res = await bulkCreateBooths(
        event.id,
        rows.map((r) => r.body),
      );
      setDone(res.created);
      setRows([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.booths(event.id) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.event(event.id) }),
      ]);
    } catch (err) {
      const list = bulkErrors(err, rows);
      if (list) setServerProblems(list);
      else setError(messageFor(err)); // 미리보기는 그대로 둬서 다시 시도할 수 있게 한다.
    } finally {
      setBusy(false);
    }
  }

  const blocked = problems.length > 0 || rows.length === 0;

  return (
    <Modal title="엑셀로 부스 등록" onClose={onClose} width="md">
      <div className="mt-3 space-y-4">
        <p className="text-15">
          양식을 내려받아 부스를 채운 뒤 올려 주세요. 부스이름만 있어도 등록돼요. 한 번에 500개까지 올릴 수 있어요.
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            void buildBulkTemplate()
              .then((buf) => downloadBlob(buf, BULK_FILE_NAME, XLSX))
              .catch(() => setError("양식을 만들지 못했어요. 다시 시도해 주세요."))
          }
        >
          양식 내려받기
        </Button>
        <div>
          <label htmlFor={fileId} className="block text-13 font-bold">
            엑셀 파일 선택
          </label>
          <input
            id={fileId}
            type="file"
            accept=".xlsx"
            onChange={(e) => void pick(e)}
            className="mt-1 block min-h-11 w-full text-15"
          />
        </div>

        {done !== null && <Notice tone="info">부스 {done}개를 등록했어요.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {problems.length > 0 && (
          <Notice tone="error">
            <p className="font-bold">고쳐야 할 곳이 있어요.</p>
            <ProblemList items={problems} />
          </Notice>
        )}
        {serverProblems.length > 0 && (
          <Notice tone="error">
            <p className="font-bold">서버가 등록을 받지 않았어요.</p>
            <ProblemList items={serverProblems} />
          </Notice>
        )}
        {rows.length > 0 && (
          <DataTable caption="등록할 부스" columns={columns} rows={rows} rowKey={(r) => String(r.sheetRow)} />
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button disabled={blocked} loading={busy} onClick={() => void submit()}>
            {rows.length}개 등록
          </Button>
        </div>
      </div>
    </Modal>
  );
}
