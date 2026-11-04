import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys, batchBoothStatus, createBooth, listBooths } from "../../api/admin";
import { fieldErrors, messageFor } from "../../api/messages";
import type { Booth } from "../../api/types";
import { Button, DataTable, EmptyState, Notice, Spinner, Stamp, TextField, type Column } from "../../ui";
import type { EventTabProps } from "./EventPage";

const MODE = { time: "시간대별", fcfs: "선착순" };

export default function BoothsTab({ event, org }: EventTabProps) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: adminKeys.booths(event.id), queryFn: () => listBooths(event.id) });
  const [picked, setPicked] = useState<number[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const booths = q.data ?? [];
  const selected = picked.filter((id) => booths.some((b) => b.id === id)); // 사라진 부스는 선택에서 뺀다.
  const all = booths.length > 0 && selected.length === booths.length;

  // 부스 수·운영 상태는 행사 정보와 대시보드에도 쓰이므로 함께 새로 받는다.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.booths(event.id) }),
      queryClient.invalidateQueries({ queryKey: adminKeys.event(event.id) }),
      queryClient.invalidateQueries({ queryKey: adminKeys.overview(org.id) }),
    ]);

  const toggle = (id: number) => setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  async function setStatus(active: boolean) {
    setBatchError(null);
    setBatchBusy(true);
    try {
      await batchBoothStatus(selected, active);
      await refresh();
      setPicked([]);
    } catch (err) {
      setBatchError(messageFor(err)); // 선택은 그대로 둬서 다시 시도할 수 있게 한다.
    } finally {
      setBatchBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setNameError(undefined);
    setAddError(null);
    setAdding(true);
    try {
      await createBooth(event.id, { name: name.trim() });
      setName("");
      await refresh();
    } catch (err) {
      const fields = fieldErrors(err);
      setNameError(fields.name);
      if (Object.keys(fields).length === 0) setAddError(messageFor(err));
    } finally {
      setAdding(false);
    }
  }

  const columns: Column<Booth>[] = [
    {
      key: "pick",
      header: (
        <input
          type="checkbox"
          aria-label="전체 선택"
          className="size-5 accent-ink"
          checked={all}
          onChange={() => setPicked(all ? [] : booths.map((b) => b.id))}
        />
      ),
      render: (b) => (
        <input
          type="checkbox"
          aria-label={`${b.name} 선택`}
          className="size-5 accent-ink"
          checked={selected.includes(b.id)}
          onChange={() => toggle(b.id)}
        />
      ),
    },
    { key: "no", header: "번호", numeric: true, render: (b) => String(booths.indexOf(b) + 1).padStart(2, "0") },
    { key: "name", header: "이름", render: (b) => <span className="font-bold">{b.name}</span> },
    { key: "mode", header: "방식", render: (b) => MODE[b.mode] },
    { key: "count", header: "신청 수", numeric: true, render: (b) => b.count },
    { key: "status", header: "상태", render: (b) => <Stamp kind={b.is_active ? "live" : "closed"} /> },
    {
      key: "detail",
      header: "상세",
      render: (b) => (
        <Link
          to={`/manage/booths/${b.id}`}
          aria-label={`${b.name} 상세`}
          className="inline-flex min-h-11 items-center underline"
        >
          상세
        </Link>
      ),
    },
  ];

  if (q.isPending) return <Spinner />;
  if (q.isError) {
    return (
      <Notice tone="error" action={{ label: "다시 시도", onClick: () => void q.refetch() }}>
        {messageFor(q.error)}
      </Notice>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-15 tabular-nums">{selected.length}개 선택</span>
          <Button disabled={selected.length === 0} loading={batchBusy} onClick={() => void setStatus(true)}>
            운영 시작
          </Button>
          <Button
            variant="secondary"
            disabled={selected.length === 0 || batchBusy}
            onClick={() => void setStatus(false)}
          >
            운영 마감
          </Button>
        </div>
        {batchError && <Notice tone="error">{batchError}</Notice>}
        <DataTable
          caption="부스 목록"
          columns={columns}
          rows={booths}
          rowKey={(b) => String(b.id)}
          empty={<EmptyState title="아직 부스가 없어요" body="아래에서 첫 부스를 추가해 보세요." />}
        />
      </section>
      <form onSubmit={add} className="space-y-3">
        {addError && <Notice tone="error">{addError}</Notice>}
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-60 flex-1">
            <TextField
              label="부스 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameError}
              hint="방식·시간 같은 상세 설정은 부스 상세에서 바꿔요."
            />
          </div>
          <Button type="submit" loading={adding} className="mt-6">
            부스 추가
          </Button>
        </div>
      </form>
    </div>
  );
}
