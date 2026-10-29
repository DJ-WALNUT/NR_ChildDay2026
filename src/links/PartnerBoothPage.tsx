import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import BoothConsole from "../booth/BoothConsole";
import { partnerBoothSource } from "../booth/linkSources";
import { NotFound, PageFrame } from "../ui";

export default function PartnerBoothPage() {
  const { token = "", boothId = "" } = useParams();
  const source = useMemo(() => partnerBoothSource(token, boothId), [token, boothId]);
  return (
    <PageFrame surface="paper" width="wide">
      <div className="space-y-4">
        <Link to={`/p/${encodeURIComponent(token)}`} className="inline-flex min-h-11 items-center gap-1 text-15 font-bold">
          <ChevronLeft aria-hidden className="size-5" />
          운영 단체로
        </Link>
        <BoothConsole
          source={source}
          access="manage"
          notFound={<NotFound title="이 링크는 더 이상 쓸 수 없어요." body="담당자에게 새 링크를 받아 주세요." />}
        />
      </div>
    </PageFrame>
  );
}
