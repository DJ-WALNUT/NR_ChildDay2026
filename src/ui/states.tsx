import type { ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { Button } from "./Button";

export function Notice({
  tone,
  children,
  action,
}: {
  tone: "info" | "error" | "warn";
  children: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  const border = tone === "error" ? "border-stamp-red" : tone === "warn" ? "border-stamp-amber" : "border-ink";
  const Icon = tone === "info" ? Info : tone === "warn" ? TriangleAlert : CircleAlert;
  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      className={`flex items-start gap-3 rounded-md border-2 bg-paper-2 p-3 text-15 text-ink ${border}`}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-18 font-extrabold tracking-[-0.03em]">{title}</p>
      {body && <p className="mt-2 text-15">{body}</p>}
    </div>
  );
}

export function NotFound({
  title = "찾을 수 없어요",
  body = "주소를 다시 확인해 주세요.",
}: {
  title?: string;
  body?: ReactNode;
}) {
  return <EmptyState title={title} body={body} />;
}
