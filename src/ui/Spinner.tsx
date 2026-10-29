import { LoaderCircle } from "lucide-react";

export function Spinner({ label = "불러오는 중이에요" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-15">
      <LoaderCircle aria-hidden className="size-5 animate-spin" />
      <span>{label}</span>
    </span>
  );
}
