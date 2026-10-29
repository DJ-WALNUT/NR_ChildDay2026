import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routes } from "../src/routes";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("routes", () => {
  it("/ 는 안내 화면을 보여준다", () => {
    renderAt("/");
    expect(screen.getByText(/QR 코드나 기관에서 받은 주소/)).toBeInTheDocument();
  });

  it("/b/abc 는 /:slug 로 잡히지 않고 부스 링크로 간다", async () => {
    renderAt("/b/abc");
    // 부스 링크 화면은 따로 불러오고, 불러온 뒤 조회를 시작한다(테스트에는 서버가 없어 연결 오류 안내가 보인다).
    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent("연결이 불안정해요");
  });

  it.each(["/b", "/p", "/reserve", "/check", "/a/b/c/d"])("%s 는 찾을 수 없어요 화면", (path) => {
    renderAt(path);
    expect(screen.getByText("찾을 수 없어요")).toBeInTheDocument();
  });

  it("/manage 는 기관(slug) 화면이 아니다", () => {
    renderAt("/manage");
    expect(screen.getByTestId("placeholder")).toHaveTextContent("manage");
  });

  it.each([
    ["/p/abc", "program-link"],
    ["/p/abc/booths/3", "program-booth"],
    ["/manage/booths", "manage"],
  ])("%s", (path, name) => {
    renderAt(path);
    expect(screen.getByTestId("placeholder")).toHaveTextContent(name);
  });
});
