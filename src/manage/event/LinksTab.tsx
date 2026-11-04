import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileArchive } from "lucide-react";
import { adminKeys, listBooths, listPartners } from "../../api/admin";
import { messageFor } from "../../api/messages";
import { downloadBlob } from "../../lib/download";
import { buildLinksWorkbook, safeFileName, type LinkSheetInput } from "../../lib/excel";
import { buildQrZip, qrEntries } from "../../lib/qrZip";
import { Button, Notice, Spinner } from "../../ui";
import type { EventTabProps } from "./EventPage";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function LinksTab({ event, org }: EventTabProps) {
  const boothsQ = useQuery({ queryKey: adminKeys.booths(event.id), queryFn: () => listBooths(event.id) });
  const partnersQ = useQuery({ queryKey: adminKeys.partners(event.id), queryFn: () => listPartners(event.id) });
  const [busy, setBusy] = useState<"zip" | "xlsx" | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const failed = [boothsQ, partnersQ].find((q) => q.isError);
  if (failed) {
    return (
      <Notice tone="error" action={{ label: "다시 시도", onClick: () => void failed.refetch() }}>
        {messageFor(failed.error)}
      </Notice>
    );
  }
  if (!boothsQ.data || !partnersQ.data) return <Spinner />;

  const origin = window.location.origin;
  // 방문객 주소의 기관은 탭에 넘어온 소유 기관이다(슈퍼관리자가 열어도 같다).
  const input: LinkSheetInput = {
    eventName: event.name,
    booths: boothsQ.data.map((b) => ({
      name: b.name,
      manage: `${origin}/b/${b.manage_token}`,
      reserve: `${origin}/${org.slug}/reserve/${b.id}`,
    })),
    partners: partnersQ.data.map((p) => ({ name: p.name, link: `${origin}/p/${p.access_token}` })),
  };
  const empty = input.booths.length === 0;

  async function run(kind: "zip" | "xlsx") {
    setError(null);
    setBusy(kind);
    setProgress(null);
    try {
      if (kind === "zip") {
        const zip = await buildQrZip(qrEntries(input), (done, total) => setProgress({ done, total }));
        downloadBlob(zip, `[${safeFileName(event.name)}]_QR.zip`, "application/zip");
      } else {
        downloadBlob(await buildLinksWorkbook(input), `[${safeFileName(event.name)}]_링크.xlsx`, XLSX);
      }
    } catch (err) {
      setError(messageFor(err, "파일을 만들지 못했어요. 다시 시도해 주세요."));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-15">부스와 운영 단체의 링크·QR 을 한 번에 내려받아 인쇄하거나 나눠 줄 수 있어요.</p>
      {empty && <Notice tone="info">부스를 먼저 추가해 주세요. 부스가 있어야 내려받을 수 있어요.</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button loading={busy === "zip"} disabled={empty || busy !== null} onClick={() => void run("zip")}>
          <FileArchive aria-hidden className="size-4" />
          QR 묶음 내려받기
        </Button>
        <Button variant="secondary" loading={busy === "xlsx"} disabled={empty || busy !== null} onClick={() => void run("xlsx")}>
          <FileSpreadsheet aria-hidden className="size-4" />
          링크 엑셀 내려받기
        </Button>
      </div>
      <div aria-live="polite" className="min-h-6 text-15 tabular-nums">
        {progress && `QR 만드는 중 ${progress.done}/${progress.total}`}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
