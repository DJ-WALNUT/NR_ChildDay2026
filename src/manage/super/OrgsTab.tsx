import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys, createSuperOrg, listSuperOrgs, updateSuperOrg } from "../../api/admin";
import { ApiError } from "../../api/client";
import { fieldErrors, messageFor } from "../../api/messages";
import type { SuperOrg } from "../../api/types";
import { Button, ConfirmDialog, DataTable, EmptyState, Notice, Spinner, TextField, type Column } from "../../ui";
import { OrgEditDialog } from "./OrgEditDialog";

const linkCls = "inline-flex min-h-11 items-center text-15 font-bold underline";

function NewOrgForm() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (body: { name: string; slug: string }) => createSuperOrg(body),
    onSuccess: () => {
      setName("");
      setSlug("");
      void qc.invalidateQueries({ queryKey: adminKeys.superOrgs() });
    },
    onError: (err) => {
      const fields = fieldErrors(err);
      if (err instanceof ApiError && err.code === "slug_taken") fields.slug = messageFor(err);
      setErrors(fields);
      setFormError(Object.keys(fields).length === 0 ? messageFor(err) : null);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    create.mutate({ name: name.trim(), slug: slug.trim() });
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="기관 만들기">
      {formError && <Notice tone="error">{formError}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="새 기관 이름" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
        <TextField
          label="새 기관 주소"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          error={errors.slug}
          hint="영문 소문자·숫자·- 2~32자"
          autoComplete="off"
          required
        />
      </div>
      <Button type="submit" loading={create.isPending}>
        기관 만들기
      </Button>
    </form>
  );
}

export default function OrgsTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: adminKeys.superOrgs(), queryFn: listSuperOrgs });
  const [editing, setEditing] = useState<SuperOrg | null>(null);
  const [deactivating, setDeactivating] = useState<SuperOrg | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const setActive = useMutation({
    mutationFn: ({ org, active }: { org: SuperOrg; active: boolean }) => updateSuperOrg(org.id, { is_active: active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.superOrgs() }),
    onError: (err) => setRowError(messageFor(err)),
    onSettled: () => setDeactivating(null),
  });

  const columns: Column<SuperOrg>[] = [
    { key: "name", header: "이름", render: (o) => <span className="font-bold">{o.name}</span> },
    { key: "slug", header: "주소", render: (o) => <span className="break-all">{o.slug}</span> },
    { key: "status", header: "상태", render: (o) => (o.is_active ? "활성" : "비활성") },
    { key: "user_count", header: "계정", numeric: true, render: (o) => o.user_count },
    { key: "event_count", header: "행사", numeric: true, render: (o) => o.event_count },
    {
      key: "actions",
      header: <span className="sr-only">동작</span>,
      align: "right",
      render: (o) => (
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
          <Link to={`/manage/super/orgs/${o.id}`} aria-label={`${o.name} 행사 보기`} className={linkCls}>
            행사 보기
          </Link>
          <Link to={`/manage/super/orgs/${o.id}/members`} aria-label={`${o.name} 계정 관리`} className={linkCls}>
            계정 관리
          </Link>
          <Button variant="secondary" aria-label={`${o.name} 수정`} onClick={() => setEditing(o)}>
            수정
          </Button>
          <Button
            variant="secondary"
            aria-label={`${o.name} ${o.is_active ? "비활성화" : "활성화"}`}
            disabled={setActive.isPending}
            onClick={() => {
              setRowError(null);
              if (o.is_active) setDeactivating(o);
              else setActive.mutate({ org: o, active: true });
            }}
          >
            {o.is_active ? "비활성화" : "활성화"}
          </Button>
        </div>
      ),
    },
  ];

  let body;
  if (q.isPending) {
    body = <Spinner />;
  } else if (q.isError) {
    body = (
      <Notice tone="error" action={{ label: "다시 시도", onClick: () => void q.refetch() }}>
        {messageFor(q.error)}
      </Notice>
    );
  } else {
    body = (
      <DataTable
        caption="기관 목록"
        columns={columns}
        rows={q.data}
        rowKey={(o) => String(o.id)}
        empty={<EmptyState title="아직 기관이 없어요" body="위에서 첫 기관을 만들어 보세요." />}
      />
    );
  }

  return (
    <div className="space-y-6">
      <NewOrgForm />
      {rowError && <Notice tone="error">{rowError}</Notice>}
      {body}
      {editing && <OrgEditDialog key={editing.id} org={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deactivating !== null}
        danger
        title="기관을 비활성화할까요?"
        body={`${deactivating?.name ?? ""} 기관의 소속 계정이 모두 로그아웃돼요. 다시 활성화하기 전까지 로그인할 수 없어요.`}
        confirmLabel="비활성화하기"
        busy={setActive.isPending}
        onConfirm={() => deactivating && setActive.mutate({ org: deactivating, active: false })}
        onCancel={() => setDeactivating(null)}
      />
    </div>
  );
}
