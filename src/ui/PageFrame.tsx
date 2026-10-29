import type { ReactNode } from "react";

const SURFACE = {
  ink: "on-ink bg-ink text-paper",
  paper: "bg-paper text-ink",
  "paper-2": "bg-paper-2 text-ink",
};

export function PageFrame({
  surface,
  children,
  width = "narrow",
}: {
  surface: "ink" | "paper" | "paper-2";
  children: ReactNode;
  width?: "narrow" | "wide";
}) {
  return (
    <div className={`min-h-dvh ${SURFACE[surface]}`}>
      <div className={`mx-auto w-full px-4 py-6 ${width === "narrow" ? "max-w-120" : "max-w-300"}`}>{children}</div>
    </div>
  );
}
