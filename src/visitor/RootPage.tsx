import { EmptyState, PageFrame } from "../ui";

export default function RootPage() {
  return (
    <PageFrame surface="ink" width="narrow">
      <EmptyState title="QR 코드나 기관에서 받은 주소로 들어와 주세요." />
    </PageFrame>
  );
}
