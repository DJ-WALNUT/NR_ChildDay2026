import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download } from "lucide-react";
import { renderQrPng } from "../lib/qr";
import { downloadBlob } from "../lib/download";
import { Button, Notice } from "../ui";

function QrCard({ title, subtitle, value, boothName }: { title: string; subtitle: string; value: string; boothName: string }) {
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMsg({ tone: "info", text: "링크를 복사했어요." });
    } catch {
      setMsg({ tone: "error", text: "복사하지 못했어요. 주소를 길게 눌러 복사해 주세요." });
    }
  }
  async function png() {
    setBusy(true);
    try {
      const blob = await renderQrPng(value, boothName, subtitle);
      const safe = `${boothName}_${subtitle}_QR.png`.replace(/[\\/:*?"<>|]/g, "");
      downloadBlob(blob, safe, "image/png");
    } catch {
      setMsg({ tone: "error", text: "QR 이미지를 만들지 못했어요." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border-2 border-rule bg-paper-2 p-4">
      <h3 className="text-15 font-extrabold">{title}</h3>
      <div className="mx-auto my-3 w-40 text-ink">
        <QRCodeSVG
          value={value}
          size={160}
          marginSize={0}
          level="M"
          fgColor="currentColor"
          bgColor="transparent"
          role="img"
          aria-label={`${title} QR`}
        />
      </div>
      <p className="text-13 break-all text-muted">{value}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void copy()} aria-label={`${title} 복사`}>
          <Copy aria-hidden className="size-4" />
          링크 복사
        </Button>
        <Button variant="secondary" loading={busy} onClick={() => void png()} aria-label={`${title} PNG 내려받기`}>
          <Download aria-hidden className="size-4" />
          PNG 내려받기
        </Button>
      </div>
      {msg && (
        <div className="mt-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}
    </div>
  );
}

export function QrPanel({ boothName, links }: { boothName: string; links: { manage: string; reserve: string } }) {
  return (
    <section aria-label="QR와 링크" className="grid gap-3 sm:grid-cols-2">
      <QrCard title="부스 관리 링크" subtitle="부스 관리" value={links.manage} boothName={boothName} />
      <QrCard title="방문객 신청 링크" subtitle="방문객 신청" value={links.reserve} boothName={boothName} />
    </section>
  );
}
