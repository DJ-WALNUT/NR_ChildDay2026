import type { ReactNode } from "react";
import { Perforation } from "./Perforation";

export function Ticket({
  header,
  children,
  tone = "ticket",
  onDark = true,
}: {
  header: ReactNode;
  children: ReactNode;
  tone?: "ticket" | "muted";
  onDark?: boolean;
}) {
  const head = tone === "muted" ? "bg-ink-2 text-paper" : "bg-ticket text-ink";
  return (
    <section>
      <div className={`rounded-t-lg px-4 py-4 ${head}`}>{header}</div>
      <div className="bg-paper">
        <Perforation onDark={onDark} />
      </div>
      <div className="rounded-b-lg bg-paper px-4 py-4 text-ink">{children}</div>
    </section>
  );
}
