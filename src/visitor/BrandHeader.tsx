import type { ReactNode } from "react";
import { ApiError, apiUrl } from "../api/client";
import { messageFor } from "../api/messages";
import { Notice, NotFound, PageFrame } from "../ui";

function Logo({ url, name }: { url: string; name: string }) {
  return <img src={apiUrl(url)} alt={`${name} 로고`} className="h-8 w-auto max-w-full object-contain" />;
}

export function BrandHeader({
  orgName,
  orgLogoUrl,
  eventName,
  eventLogoUrl,
  asTitle = false,
}: {
  orgName: string;
  orgLogoUrl?: string | null;
  eventName?: string;
  eventLogoUrl?: string | null;
  /** 기관 첫 화면에서는 기관 이름이 페이지 제목(h1) */
  asTitle?: boolean;
}) {
  const org = orgLogoUrl ? (
    <Logo url={orgLogoUrl} name={orgName} />
  ) : (
    <span className="text-18 font-extrabold break-words">{orgName}</span>
  );
  return (
    <header className="mb-5">
      <div className="flex min-h-8 items-center gap-3">
        {asTitle ? (
          <h1 className="m-0">
            {org}
            {orgLogoUrl && <span className="sr-only">{orgName}</span>}
          </h1>
        ) : (
          org
        )}
      </div>
      {eventName && (
        <div className="mt-3 flex items-center gap-3">
          {eventLogoUrl && <Logo url={eventLogoUrl} name={eventName} />}
          <p className="min-w-0 text-15 break-words text-rule">{eventName}</p>
        </div>
      )}
    </header>
  );
}

/** 방문객 화면 공통 틀: 잉크 바탕, 기관 머리글, 하단 저작권 줄. */
export function VisitorFrame({
  orgName,
  orgLogoUrl,
  eventName,
  eventLogoUrl,
  asTitle,
  children,
}: {
  orgName: string;
  orgLogoUrl?: string | null;
  eventName?: string;
  eventLogoUrl?: string | null;
  asTitle?: boolean;
  children: ReactNode;
}) {
  return (
    <PageFrame surface="ink" width="narrow">
      <BrandHeader orgName={orgName} orgLogoUrl={orgLogoUrl} eventName={eventName} eventLogoUrl={eventLogoUrl} asTitle={asTitle} />
      <main className="space-y-4">{children}</main>
      <footer className="mt-8 text-12 text-faint">
        © {new Date().getFullYear()} {orgName}
      </footer>
    </PageFrame>
  );
}

/** 쿼리 실패 화면: 404 는 NotFound, 그 밖은 오류 안내 + 다시 시도. */
export function QueryFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (error instanceof ApiError && error.status === 404) {
    return (
      <PageFrame surface="ink" width="narrow">
        <NotFound />
      </PageFrame>
    );
  }
  return (
    <PageFrame surface="ink" width="narrow">
      <Notice tone="error" action={{ label: "다시 시도", onClick: onRetry }}>
        {messageFor(error)}
      </Notice>
    </PageFrame>
  );
}

