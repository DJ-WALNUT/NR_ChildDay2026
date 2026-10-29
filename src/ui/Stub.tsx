import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";

export function Stub({
  number,
  children,
  onClick,
  to,
  href,
  closed = false,
  right,
}: {
  number: string;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  /** 앱 안 이동(SPA). react-router Link 로 그려요. Router 안에서만 써요. */
  to?: string;
  /** 외부 주소 전용. 앱 안 이동에는 `to` 를 써요. */
  href?: string;
  closed?: boolean;
  right?: ReactNode;
}) {
  const body = closed ? "bg-ink-2 text-faint" : "bg-paper text-ink";
  const content = (
    <>
      <span className="flex w-16 shrink-0 items-center justify-center border-r-2 border-dashed border-rule text-22 font-extrabold">
        {number}
      </span>
      <span className="min-w-0 flex-1 px-3 py-3 text-left text-15">{children}</span>
      {right && <span className="flex shrink-0 items-center pr-3">{right}</span>}
    </>
  );
  const cls = `flex min-h-14 w-full items-stretch rounded-lg ${body}`;
  if (to) {
    return (
      <Link to={to} onClick={onClick} className={cls}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} onClick={onClick} className={cls}>
        {content}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {content}
      </button>
    );
  }
  return <div className={cls}>{content}</div>;
}
