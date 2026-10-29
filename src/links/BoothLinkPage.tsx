import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { boothLinkSource } from "../booth/linkSources";
import BoothConsole from "../booth/BoothConsole";
import { NotFound, PageFrame } from "../ui";

export default function BoothLinkPage() {
  const { token = "" } = useParams();
  const source = useMemo(() => boothLinkSource(token), [token]);
  return (
    <PageFrame surface="paper" width="wide">
      <BoothConsole
        source={source}
        access="manage"
        notFound={<NotFound title="이 링크는 더 이상 쓸 수 없어요." body="담당자에게 새 링크를 받아 주세요." />}
      />
    </PageFrame>
  );
}
