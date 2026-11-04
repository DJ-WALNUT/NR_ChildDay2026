import { Notice } from "../ui";

type Query = { isRefetchError: boolean; refetch: () => unknown };

/** 받아 둔 데이터가 있는데 다시 받기만 실패했을 때의 경고. 화면과 입력 중인 내용은 그대로 둔다. */
export function RefetchNotice({ queries }: { queries: Query[] }) {
  const failed = queries.filter((q) => q.isRefetchError);
  if (failed.length === 0) return null;
  return (
    <Notice tone="warn" action={{ label: "다시 시도", onClick: () => failed.forEach((q) => void q.refetch()) }}>
      최신 정보를 받지 못했어요. 지금 보이는 내용은 이전 정보일 수 있어요.
    </Notice>
  );
}
