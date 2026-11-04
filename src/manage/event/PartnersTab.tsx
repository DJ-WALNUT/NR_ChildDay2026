import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, RefreshCw, Trash2 } from "lucide-react";
import {
  adminKeys,
  createPartner,
  deletePartner,
  listBooths,
  listLinkTargets,
  listPartners,
  rotatePartnerToken,
  updateBooth,
  updatePartner,
} from "../../api/admin";
import { fieldErrors, messageFor } from "../../api/messages";
import type { Booth, Partner } from "../../api/types";
import { downloadBlob } from "../../lib/download";
import { safeFileName } from "../../lib/excel";
import { renderQrPng } from "../../lib/qr";
import { Button, ConfirmDialog, DataTable, EmptyState, Notice, Spinner, TextField, type Column } from "../../ui";
import { RefetchNotice } from "../RefetchNotice";
import type { EventTabProps } from "./EventPage";
import { EditDialog, LinkedOrgSelect, NONE } from "./PartnerEdit";

const partnerLink = (p: Partner) => `${window.location.origin}/p/${p.access_token}`;
const selectClass = "h-11 rounded-md border-2 border-muted bg-paper-2 px-3 text-15 focus:border-ink";

export default function PartnersTab({ event, org }: EventTabProps) {
  const queryClient = useQueryClient();
  const partnersQ = useQuery({ queryKey: adminKeys.partners(event.id), queryFn: () => listPartners(event.id) });
  // 연결 기관은 행사를 연 사람이 아니라 행사 소유 기관 기준이다.
  const targetsQ = useQuery({ queryKey: adminKeys.linkTargets(org.id), queryFn: () => listLinkTargets(org.id) });
  const boothsQ = useQuery({ queryKey: adminKeys.booths(event.id), queryFn: () => listBooths(event.id) });
  const [name, setName] = useState("");
  const [linked, setLinked] = useState(NONE);
  const [nameError, setNameError] = useState<string | undefined>();
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [rotating, setRotating] = useState<Partner | null>(null);
  const [deleting, setDeleting] = useState<Partner | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<number | null>(null);

  const partners = partnersQ.data ?? [];
  const booths = boothsQ.data ?? [];
  const targets = targetsQ.data ?? [];

  // 단체가 바뀌면 부스 수·배정·행사 요약이 함께 달라진다.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.partners(event.id) }),
      queryClient.invalidateQueries({ queryKey: adminKeys.event(event.id) }),
      queryClient.invalidateQueries({ queryKey: adminKeys.booths(event.id) }),
    ]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setNameError(undefined);
    setAddError(null);
    setAdding(true);
    try {
      await createPartner(event.id, { name: name.trim(), linked_org_id: linked === NONE ? null : Number(linked) });
      setName("");
      setLinked(NONE);
      await refresh();
    } catch (err) {
      const fields = fieldErrors(err);
      setNameError(fields.name);
      if (Object.keys(fields).length === 0) setAddError(messageFor(err));
    } finally {
      setAdding(false);
    }
  }

  /** 확인 대화상자 뒤의 동작. 실패하면 대화상자를 닫고 오류를 알린다. */
  async function run(action: () => Promise<unknown>, close: () => void) {
    setRowError(null);
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (err) {
      setRowError(messageFor(err));
    } finally {
      setBusy(false);
      close();
    }
  }

  async function downloadQr(p: Partner) {
    setRowError(null);
    try {
      downloadBlob(await renderQrPng(partnerLink(p), p.name, "운영 단체 실적"), `${safeFileName(p.name)}_실적_QR.png`, "image/png");
    } catch {
      setRowError("QR 이미지를 만들지 못했어요.");
    }
  }

  async function assign(b: Booth, value: string) {
    setRowError(null);
    setAssigning(b.id);
    try {
      await updateBooth(b.id, { partner_id: value === NONE ? null : Number(value) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.booths(event.id) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.partners(event.id) }),
      ]);
    } catch (err) {
      setRowError(messageFor(err)); // 선택 상자는 부스 목록 값을 따르므로 이전 값으로 돌아간다.
    } finally {
      setAssigning(null);
    }
  }

  const iconBtn = (label: string, icon: React.ReactNode, onClick: () => void) => (
    <Button variant="secondary" aria-label={label} title={label} onClick={onClick}>
      {icon}
    </Button>
  );
  const partnerColumns: Column<Partner>[] = [
    { key: "name", header: "이름", wrap: true, render: (p) => <span className="font-bold">{p.name}</span> },
    { key: "org", header: "연결 기관", wrap: true, render: (p) => p.linked_org?.name ?? "연결 안 함" },
    { key: "count", header: "부스", numeric: true, render: (p) => p.booth_count },
    { key: "link", header: "실적 링크", wrap: true, render: (p) => <span className="text-13 break-all">{partnerLink(p)}</span> },
    {
      key: "actions",
      header: "관리",
      render: (p) => (
        <div className="flex gap-1">
          {iconBtn(`${p.name} 수정`, <Pencil aria-hidden className="size-4" />, () => setEditing(p))}
          {iconBtn(`${p.name} QR 내려받기`, <Download aria-hidden className="size-4" />, () => void downloadQr(p))}
          {iconBtn(`${p.name} 링크 재발급`, <RefreshCw aria-hidden className="size-4" />, () => setRotating(p))}
          {iconBtn(`${p.name} 삭제`, <Trash2 aria-hidden className="size-4" />, () => setDeleting(p))}
        </div>
      ),
    },
  ];
  const boothColumns: Column<Booth>[] = [
    { key: "name", header: "부스", wrap: true, render: (b) => <span className="font-bold">{b.name}</span> },
    {
      key: "partner",
      header: "운영 단체",
      render: (b) => (
        <select
          aria-label={`${b.name} 운영 단체`}
          className={selectClass}
          value={b.partner_id === null ? NONE : String(b.partner_id)}
          disabled={assigning === b.id}
          onChange={(e) => void assign(b, e.target.value)}
        >
          <option value={NONE}>미배정</option>
          {partners.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>
      ),
    },
  ];

  const failed = [partnersQ, boothsQ].find((q) => q.isError && !q.data);
  if (failed) {
    return (
      <Notice tone="error" action={{ label: "다시 시도", onClick: () => void failed.refetch() }}>
        {messageFor(failed.error)}
      </Notice>
    );
  }
  if (partnersQ.isPending || boothsQ.isPending) return <Spinner />;

  return (
    <div className="space-y-8">
      {rowError && <Notice tone="error">{rowError}</Notice>}
      <RefetchNotice queries={[partnersQ, boothsQ]} />
      <section className="space-y-3">
        <DataTable
          caption="운영 단체 목록"
          scrollHint
          columns={partnerColumns}
          rows={partners}
          rowKey={(p) => String(p.id)}
          empty={<EmptyState title="아직 운영 단체가 없어요" body="아래에서 첫 단체를 추가해 보세요." />}
        />
        <form onSubmit={add} className="space-y-3">
          {addError && <Notice tone="error">{addError}</Notice>}
          {targetsQ.isError && <Notice tone="error">{messageFor(targetsQ.error)}</Notice>}
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-60 flex-1">
              <TextField label="단체 이름" value={name} onChange={(e) => setName(e.target.value)} error={nameError} />
            </div>
            <div className="min-w-60 flex-1">
              <LinkedOrgSelect value={linked} onChange={setLinked} targets={targets} />
            </div>
            <Button type="submit" loading={adding} className="mt-6">
              단체 추가
            </Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="assign-title" className="space-y-3">
        <h2 id="assign-title" className="text-18 font-extrabold">
          부스 배정
        </h2>
        <DataTable
          caption="부스별 운영 단체"
          columns={boothColumns}
          rows={booths}
          rowKey={(b) => String(b.id)}
          empty={<EmptyState title="아직 부스가 없어요" />}
        />
      </section>

      {editing && (
        <EditDialog
          key={editing.id}
          partner={editing}
          targets={targets}
          onSave={async (body) => {
            await updatePartner(editing.id, body);
            await refresh();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={rotating !== null}
        title="실적 링크를 다시 만들까요?"
        body="이전 링크와 QR 은 바로 끊겨요. 새 링크를 단체에 다시 알려 주세요."
        confirmLabel="재발급"
        busy={busy}
        onConfirm={() => rotating && void run(() => rotatePartnerToken(rotating.id), () => setRotating(null))}
        onCancel={() => setRotating(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`${deleting?.name ?? ""} 단체를 삭제할까요?`}
        body={`배정된 부스 ${deleting?.booth_count ?? 0}개는 미배정이 돼요. 부스와 신청 기록은 그대로 남아요.`}
        confirmLabel="삭제"
        danger
        busy={busy}
        onConfirm={() => deleting && void run(() => deletePartner(deleting.id), () => setDeleting(null))}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
