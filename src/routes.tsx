import type { RouteObject } from "react-router-dom";

function Placeholder({ name }: { name: string }) {
  return <div data-testid="placeholder">{name}</div>;
}

// 정적 경로(manage, b, p, reserve, check)는 /:slug 보다 먼저 매칭된다 (react-router 는 구체성 순위로 고른다).
export const routes: RouteObject[] = [
  { path: "/", element: <Placeholder name="landing" /> },
  { path: "/manage/*", element: <Placeholder name="manage" /> },
  { path: "/b/:token", element: <Placeholder name="booth-link" /> },
  { path: "/p/:token", element: <Placeholder name="program-link" /> },
  { path: "/p/:token/booths/:boothId", element: <Placeholder name="program-booth" /> },
  { path: "/reserve/:boothId", element: <Placeholder name="reserve" /> },
  { path: "/check/:boothId", element: <Placeholder name="check" /> },
  { path: "/:slug", element: <Placeholder name="org" /> },
  { path: "/:slug/reserve/:boothId", element: <Placeholder name="reserve" /> },
  { path: "/:slug/check/:boothId", element: <Placeholder name="check" /> },
  { path: "*", element: <Placeholder name="not-found" /> },
];
