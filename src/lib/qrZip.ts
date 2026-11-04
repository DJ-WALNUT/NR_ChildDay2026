import { safeFileName, type LinkSheetInput } from "./excel";
import { renderQrPng } from "./qr";

export interface QrEntry {
  fileName: string;
  value: string;
  title: string;
  subtitle: string;
}

/**
 * 행사 QR 묶음의 항목 목록. 번호가 파일명 앞에 붙어서 이름이 같은 부스도 겹치지 않아요.
 * 번호는 두 자리, 부스가 100개 이상이면 세 자리.
 */
export function qrEntries({ booths, partners }: LinkSheetInput): QrEntry[] {
  const pad = (i: number, total: number) => String(i + 1).padStart(Math.max(2, String(total).length), "0");
  const out: QrEntry[] = [];
  booths.forEach((b, i) => {
    const no = pad(i, booths.length);
    const name = safeFileName(b.name);
    out.push({ fileName: `${no}_${name}_방문객신청.png`, value: b.reserve, title: b.name, subtitle: "방문객 신청" });
    out.push({ fileName: `${no}_${name}_부스관리.png`, value: b.manage, title: b.name, subtitle: "부스 관리" });
  });
  partners.forEach((p, i) => {
    out.push({
      fileName: `운영단체_${pad(i, partners.length)}_${safeFileName(p.name)}_실적.png`,
      value: p.link,
      title: p.name,
      subtitle: "운영 단체 실적",
    });
  });
  return out;
}

/** QR 을 하나씩 순서대로 만들어 zip 으로 묶는다(캔버스 메모리를 아끼려고 동시에 만들지 않아요). */
export async function buildQrZip(
  entries: QrEntry[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  let done = 0;
  for (const e of entries) {
    zip.file(e.fileName, await renderQrPng(e.value, e.title, e.subtitle));
    onProgress?.(++done, entries.length);
  }
  return zip.generateAsync({ type: "blob" });
}
