import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { routes } from "../src/routes";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

describe("routes", () => {
  it("/ 는 랜딩 자리표시를 보여준다", () => {
    renderAt("/");
    expect(screen.getByTestId("placeholder")).toHaveTextContent("landing");
  });

  it("/nareum 은 기관 화면 자리표시를 보여준다", () => {
    renderAt("/nareum");
    expect(screen.getByTestId("placeholder")).toHaveTextContent("org");
  });

  it("/b/abc 는 /:slug 로 잡히지 않고 부스 링크로 간다", () => {
    renderAt("/b/abc");
    expect(screen.getByTestId("placeholder")).toHaveTextContent("booth-link");
  });

  it.each([
    ["/p/abc", "program-link"],
    ["/p/abc/booths/3", "program-booth"],
    ["/reserve/3", "reserve"],
    ["/check/3", "check"],
    ["/nareum/reserve/3", "reserve"],
    ["/nareum/check/3", "check"],
    ["/manage/booths", "manage"],
    ["/a/b/c/d", "not-found"],
  ])("%s", (path, name) => {
    renderAt(path);
    expect(screen.getByTestId("placeholder")).toHaveTextContent(name);
  });
});
