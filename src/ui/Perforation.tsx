export function Perforation({ onDark = false }: { onDark?: boolean }) {
  const notch = onDark ? "bg-ink" : "bg-paper";
  return (
    <div aria-hidden className="relative h-0 border-t-2 border-dashed border-rule">
      <span className={`absolute -left-2 -top-2.5 size-4 rounded-full ${notch}`} />
      <span className={`absolute -right-2 -top-2.5 size-4 rounded-full ${notch}`} />
    </div>
  );
}
