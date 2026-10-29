import type { RouteObject } from "react-router-dom";
import { NotFound, PageFrame, Spinner } from "./ui";
import CheckPage from "./visitor/CheckPage";
import LegacyRedirect from "./visitor/LegacyRedirect";
import OrgPage from "./visitor/OrgPage";
import ReservePage from "./visitor/ReservePage";
import RootPage from "./visitor/RootPage";

function NotFoundPage() {
  return (
    <PageFrame surface="ink" width="narrow">
      <main>
        <NotFound />
      </main>
    </PageFrame>
  );
}

function StaffFallback() {
  return (
    <PageFrame surface="paper" width="wide">
      <Spinner />
    </PageFrame>
  );
}

function Placeholder({ name }: { name: string }) {
  return <div data-testid="placeholder">{name}</div>;
}

// 정적 경로(manage, b, p, reserve, check)는 /:slug 보다 먼저 매칭된다 (react-router 는 구체성 순위로 고른다).
export const routes: RouteObject[] = [
  { path: "/", element: <RootPage /> },
  { path: "/manage/*", element: <Placeholder name="manage" /> },
  {
    path: "/b/:token",
    HydrateFallback: StaffFallback,
    // 현장 직원 화면은 방문객 첫 묶음(entry chunk)에 들어가지 않도록 따로 불러온다.
    lazy: async () => ({ Component: (await import("./links/BoothLinkPage")).default }),
  },
  {
    path: "/p/:token",
    HydrateFallback: StaffFallback,
    lazy: async () => ({ Component: (await import("./links/PartnerPage")).default }),
  },
  {
    path: "/p/:token/booths/:boothId",
    HydrateFallback: StaffFallback,
    lazy: async () => ({ Component: (await import("./links/PartnerBoothPage")).default }),
  },
  { path: "/reserve/:boothId", element: <LegacyRedirect to="reserve" /> },
  { path: "/check/:boothId", element: <LegacyRedirect to="check" /> },
  { path: "/b", element: <NotFoundPage /> },
  { path: "/p", element: <NotFoundPage /> },
  { path: "/reserve", element: <NotFoundPage /> },
  { path: "/check", element: <NotFoundPage /> },
  { path: "/:slug", element: <OrgPage /> },
  { path: "/:slug/reserve/:boothId", element: <ReservePage /> },
  { path: "/:slug/check/:boothId", element: <CheckPage /> },
  { path: "*", element: <NotFoundPage /> },
];
