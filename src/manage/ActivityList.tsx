import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { messageFor } from "../api/messages";
import type { AuditItem, AuditPage } from "../api/types";
import { formatKst } from "../lib/excel";
import { Button, DataTable, EmptyState, Notice, SelectField, Spinner, type Column } from "../ui";

// 값은 action 접두사. 빈 값이면 전체.
const KINDS = [
  { value: "", label: "전체" },
  { value: "auth", label: "로그인·비밀번호" },
  { value: "user", label: "계정" },
  { value: "event", label: "행사" },
  { value: "booth", label: "부스" },
  { value: "partner", label: "운영 단체" },
  { value: "reservation", label: "신청" },
  { value: "export", label: "내려받기" },
  { value: "org", label: "기관" },
];

const COLUMNS: Column<AuditItem>[] = [
  { key: "at", header: "시각", numeric: true, align: "left", render: (a) => formatKst(a.at) },
  { key: "actor_label", header: "행위자", wrap: true, render: (a) => a.actor_label },
  { key: "summary", header: "내용", wrap: true, render: (a) => <span className="whitespace-pre-wrap break-words">{a.summary}</span> },
];

/**
 * 활동 기록 목록. 종류 필터와 "더 보기"를 직접 들고 있고, 어느 기록을 받을지는 load 가 정한다.
 * 필터가 바뀌면 queryKey 에 action 이 붙어 처음부터 다시 받는다.
 */
export default function ActivityList({
  queryKey,
  load,
}: {
  queryKey: unknown[];
  load: (p: { before?: number; action?: string }) => Promise<AuditPage>;
}) {
  const [kind, setKind] = useState("");
  const action = kind || undefined;
  const q = useInfiniteQuery({
    queryKey: [...queryKey, kind],
    queryFn: ({ pageParam }) => load({ before: pageParam, action }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.next_before ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  let body;
  if (q.isPending) {
    body = <Spinner />;
  } else if (!q.data) {
    body = (
      <Notice tone="error" action={{ label: "다시 시도", onClick: () => void q.refetch() }}>
        {messageFor(q.error)}
      </Notice>
    );
  } else {
    body = (
      <>
        <DataTable
          caption="활동 기록"
          columns={COLUMNS}
          rows={items}
          rowKey={(a) => String(a.id)}
          empty={<EmptyState title="활동 기록이 없어요" />}
        />
        {q.isFetchNextPageError && (
          <Notice tone="error" action={{ label: "다시 시도", onClick: () => void q.fetchNextPage() }}>
            {messageFor(q.error)}
          </Notice>
        )}
        {q.hasNextPage && !q.isFetchNextPageError && (
          <Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
            더 보기
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <SelectField label="종류" value={kind} onChange={(e) => setKind(e.target.value)} options={KINDS} />
      </div>
      {body}
    </div>
  );
}
