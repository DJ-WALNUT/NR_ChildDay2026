import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys, createMember, listMembers, resetMemberPassword, updateMember } from "../../api/admin";
import { ApiError } from "../../api/client";
import { fieldErrors, messageFor } from "../../api/messages";
import type { Member } from "../../api/types";
import { formatKst } from "../../lib/excel";
import { Button, ConfirmDialog, DataTable, EmptyState, Notice, Spinner, TextField, type Column } from "../../ui";
import { TempPasswordDialog } from "./TempPasswordDialog";

const statusOf = (m: Member) => (!m.is_active ? "비활성" : m.must_change_password ? "비밀번호 변경 전" : "활성");

/**
 * 기관 계정 목록과 발급·활성화·비밀번호 초기화.
 * selfId 와 같은 행에는 비활성화·초기화 버튼을 두지 않는다(슈퍼관리자 화면은 어느 행과도 맞지 않는 값을 넘긴다).
 */
export function MembersPanel({ orgId, selfId }: { orgId: number; selfId: number }) {
  const qc = useQueryClient();
  const membersQ = useQuery({ queryKey: adminKeys.members(orgId), queryFn: () => listMembers(orgId) });
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<Member | null>(null);
  // 임시 비밀번호는 쿼리·뮤테이션 캐시에 두지 않고 이 상태로만 들고 있다가 닫을 때 지운다.
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: adminKeys.members(orgId) });

  const create = useMutation({
    gcTime: 0,
    mutationFn: (body: { username: string; display_name: string }) => createMember(orgId, body),
    onSuccess: (res) => {
      setIssued({ username: res.user.username, password: res.temp_password });
      setUsername("");
      setDisplayName("");
      void refresh();
    },
    onError: (err) => {
      const fields = fieldErrors(err);
      if (err instanceof ApiError && err.code === "username_taken") fields.username = messageFor(err);
      setErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(messageFor(err));
    },
  });

  const reset = useMutation({
    gcTime: 0,
    mutationFn: (m: Member) => resetMemberPassword(m.id),
    onSuccess: (res, m) => {
      setResetting(null);
      setIssued({ username: m.username, password: res.temp_password });
    },
    onError: (err) => {
      setResetting(null);
      setRowError(messageFor(err));
    },
  });

  const toggle = useMutation({
    mutationFn: (m: Member) => updateMember(m.id, { is_active: !m.is_active }),
    onSuccess: () => void refresh(),
    onError: (err) => setRowError(messageFor(err)),
  });

  function closeIssued() {
    setIssued(null);
    create.reset();
    reset.reset();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    create.mutate({ username: username.trim(), display_name: displayName.trim() });
  }

  const columns: Column<Member>[] = [
    { key: "username", header: "아이디", render: (m) => <span className="font-bold">{m.username}</span> },
    { key: "display_name", header: "표시 이름", render: (m) => m.display_name },
    { key: "status", header: "상태", render: (m) => statusOf(m) },
    {
      key: "last_login_at",
      header: "마지막 접속",
      numeric: true,
      render: (m) => (m.last_login_at === null ? "접속 전" : formatKst(m.last_login_at)),
    },
    {
      key: "actions",
      header: <span className="sr-only">동작</span>,
      align: "right",
      render: (m) =>
        m.id === selfId ? null : (
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              aria-label={`${m.username} ${m.is_active ? "비활성화" : "활성화"}`}
              disabled={toggle.isPending}
              onClick={() => {
                setRowError(null);
                toggle.mutate(m);
              }}
            >
              {m.is_active ? "비활성화" : "활성화"}
            </Button>
            <Button
              variant="secondary"
              aria-label={`${m.username} 비밀번호 초기화`}
              onClick={() => {
                setRowError(null);
                setResetting(m);
              }}
            >
              비밀번호 초기화
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-3" aria-label="계정 발급">
        {formError && <Notice tone="error">{formError}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={errors.username}
            hint="영문 소문자·숫자·._- 3~32자"
            autoComplete="off"
            required
          />
          <TextField
            label="표시 이름"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={errors.display_name}
            maxLength={40}
            autoComplete="off"
            required
          />
        </div>
        <Button type="submit" loading={create.isPending}>
          계정 발급
        </Button>
      </form>

      {rowError && <Notice tone="error">{rowError}</Notice>}
      {membersQ.isPending ? (
        <Spinner />
      ) : membersQ.isError ? (
        <Notice tone="error" action={{ label: "다시 시도", onClick: () => void membersQ.refetch() }}>
          {messageFor(membersQ.error)}
        </Notice>
      ) : (
        <DataTable
          caption="기관 계정 목록"
          columns={columns}
          rows={membersQ.data}
          rowKey={(m) => String(m.id)}
          empty={<EmptyState title="계정이 없어요" />}
        />
      )}

      <ConfirmDialog
        open={resetting !== null}
        title="비밀번호 초기화"
        body={`${resetting?.username ?? ""} 계정의 비밀번호를 새 임시 비밀번호로 바꿔요. 로그인 중인 기기에서 로그아웃돼요.`}
        confirmLabel="초기화"
        danger
        busy={reset.isPending}
        onConfirm={() => resetting && reset.mutate(resetting)}
        onCancel={() => setResetting(null)}
      />
      {issued && <TempPasswordDialog username={issued.username} password={issued.password} onClose={closeIssued} />}
    </div>
  );
}
