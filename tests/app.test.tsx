import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../src/api/client";
import { routes } from "../src/routes";

vi.mock("../src/api/link", async (orig) => ({
  ...(await orig<typeof import("../src/api/link")>()),
  getBoothLink: vi.fn(),
  getPartner: vi.fn(),
  getPartnerBooth: vi.fn(),
  listReservationsPartnerBooth: vi.fn(),
  partnerStats: vi.fn(),
}));
import * as link from "../src/api/link";

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
    vi.mocked(link.getBoothLink).mockRejectedValue(new ApiError(404, "not_found"));
    renderAt("/b/abc");
    // 부스 링크 화면은 따로 불러온다. 조회를 흉내 내서 불러온 화면이 abc 토큰으로 조회하는지 본다.
    expect(await screen.findByText("이 링크는 더 이상 쓸 수 없어요.", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(link.getBoothLink).toHaveBeenCalledWith("abc");
  });

  it("/p/abc 는 /:slug 로 잡히지 않고 운영 단체 링크로 간다", async () => {
    vi.mocked(link.getPartner).mockRejectedValue(new ApiError(404, "not_found"));
    renderAt("/p/abc");
    expect(await screen.findByText("이 링크는 더 이상 쓸 수 없어요.", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(link.getPartner).toHaveBeenCalledWith("abc");
  });

  it("/p/abc/booths/3 은 운영 단체의 부스 화면으로 간다", async () => {
    vi.mocked(link.getPartnerBooth).mockRejectedValue(new ApiError(404, "not_found"));
    vi.mocked(link.listReservationsPartnerBooth).mockRejectedValue(new ApiError(404, "not_found"));
    vi.mocked(link.partnerStats).mockRejectedValue(new ApiError(404, "not_found"));
    vi.mocked(link.getPartner).mockRejectedValue(new ApiError(404, "not_found"));
    renderAt("/p/abc/booths/3");
    expect(await screen.findByText("이 링크는 더 이상 쓸 수 없어요.", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(link.getPartnerBooth).toHaveBeenCalledWith("abc", "3");
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
    ["/manage/booths", "manage"],
  ])("%s", (path, name) => {
    renderAt(path);
    expect(screen.getByTestId("placeholder")).toHaveTextContent(name);
  });
});
