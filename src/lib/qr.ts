import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QRCodeCanvas } from "qrcode.react";

/** 폭을 넘는 제목은 "…"로 줄인다. 부제는 그대로. */
export function qrLabelLayout(
  title: string,
  subtitle: string,
  width: number,
  measure: (s: string) => number,
): { title: string; subtitle: string } {
  if (measure(title) <= width) return { title, subtitle };
  const chars = [...title];
  let n = chars.length;
  while (n > 0 && measure(chars.slice(0, n).join("").trimEnd() + "…") > width) n--;
  return { title: chars.slice(0, n).join("").trimEnd() + "…", subtitle };
}

const SCALE = 4;

export async function renderQrPng(value: string, title: string, subtitle: string): Promise<Blob> {
  if (document.fonts) {
    await Promise.all([
      document.fonts.load(`800 ${18 * SCALE}px Pretendard`),
      document.fonts.load(`700 ${15 * SCALE}px Pretendard`),
    ]);
    await document.fonts.ready;
  }
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => {
      root.render(createElement(QRCodeCanvas, { value, size: 256 * SCALE, marginSize: 0, level: "M" }));
    });
    const qr = host.querySelector("canvas");
    if (!qr) throw new Error("QR 캔버스를 만들지 못했어요.");

    const W = 320 * SCALE;
    const pad = 32 * SCALE;
    const qrSize = W - pad * 2;
    const titleSize = 18 * SCALE;
    const subSize = 15 * SCALE;
    const gap = 20 * SCALE;
    const H = pad + qrSize + gap + titleSize + 8 * SCALE + subSize + pad;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 사용할 수 없어요.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, pad, pad, qrSize, qrSize);

    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `800 ${titleSize}px Pretendard, system-ui, sans-serif`;
    const label = qrLabelLayout(title, subtitle, W - pad * 2, (s) => ctx.measureText(s).width);
    ctx.fillText(label.title, W / 2, pad + qrSize + gap);
    ctx.font = `700 ${subSize}px Pretendard, system-ui, sans-serif`;
    ctx.fillText(label.subtitle, W / 2, pad + qrSize + gap + titleSize + 8 * SCALE);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG를 만들지 못했어요."))), "image/png"),
    );
  } finally {
    root.unmount();
    host.remove();
  }
}
