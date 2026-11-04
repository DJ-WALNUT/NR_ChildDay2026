import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../src/api/client";
import type { AdminEvent, MeResponse, SessionOrg, SessionUser } from "../src/api/types";
import { routes } from "../src/routes";
import LogoField from "../src/manage/LogoField";

vi.mock("../src/api/admin", async (orig) => ({
  ...(await orig<typeof import("../src/api/admin")>()),
  getMe: vi.fn(),
  getOverview: vi.fn(),
  getEvent: vi.fn(),
  listBooths: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  uploadEventLogo: vi.fn(),
  removeEventLogo: vi.fn(),
}));
import * as admin from "../src/api/admin";

const ORG: SessionOrg = { id: 1, name: "나름교회", slug: "nareum", logo_url: null };
const USER: SessionUser = {
  id: 7,
  username: "staff",
  display_name: "담당자",
  org_id: 1,
  is_superadmin: false,
  must_change_password: false,
};
const me = (user: Partial<SessionUser> = {}, org: SessionOrg | null = ORG): MeResponse => ({
  user: { ...USER, ...user },
  csrf: "tok",
  org,
});
const EVENT: AdminEvent = {
  id: 10,
  name: "가을 축제",
  created_at: 1_700_000_000,
  booth_count: 3,
  partner_count: 0,
  logo_url: null,
  notice: null,
};

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient, where: () => router.state.location.pathname };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(admin.getMe).mockResolvedValue(me());
  vi.mocked(admin.getEvent).mockResolvedValue({ event: EVENT, org: ORG });
  vi.mocked(admin.listBooths).mockResolvedValue([]);
});

function file(name: string, type: string, size = 10) {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("LogoField", () => {
  function setup(over: Partial<React.ComponentProps<typeof LogoField>> = {}) {
    const props = {
      label: "행사 로고",
      logoUrl: null as string | null,
      upload: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      onChanged: vi.fn(),
      ...over,
    };
    render(<LogoField {...props} />);
    return props;
  }
  const input = () => screen.getByLabelText("행사 로고") as HTMLInputElement;

  it("1MB 초과 파일은 서버를 부르지 않는다", async () => {
    const p = setup();
    await userEvent.setup({ applyAccept: false }).upload(input(), file("a.png", "image/png", 1_048_577));
    expect(await screen.findByText("1MB 이하 파일만 올릴 수 있어요.")).toBeInTheDocument();
    expect(p.upload).not.toHaveBeenCalled();
  });

  it("1MB 정확히는 올릴 수 있다", async () => {
    const p = setup();
    await userEvent.setup().upload(input(), file("a.png", "image/png", 1_048_576));
    await waitFor(() => expect(p.onChanged).toHaveBeenCalled());
  });

  it("svg 는 서버를 부르지 않는다", async () => {
    const p = setup();
    await userEvent.setup({ applyAccept: false }).upload(input(), file("a.svg", "image/svg+xml"));
    expect(await screen.findByText("PNG, JPG, WebP 파일만 올릴 수 있어요.")).toBeInTheDocument();
    expect(p.upload).not.toHaveBeenCalled();
  });

  it("정상 파일은 올리고 onChanged 를 부르며 입력값을 비운다", async () => {
    const p = setup();
    const f = file("a.png", "image/png");
    await userEvent.setup().upload(input(), f);
    await waitFor(() => expect(p.onChanged).toHaveBeenCalledTimes(1));
    expect(p.upload).toHaveBeenCalledWith(f);
    expect(input().value).toBe("");
    expect(input()).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
  });

  it("서버 413·422 문구를 보여준다", async () => {
    const upload = vi.fn().mockRejectedValueOnce(new ApiError(413, "file_too_large"));
    setup({ upload });
    const u = userEvent.setup();
    await u.upload(input(), file("a.png", "image/png"));
    expect(await screen.findByText("파일이 너무 커요.")).toBeInTheDocument();
    upload.mockRejectedValueOnce(new ApiError(422, "invalid", { logo: "이미지 파일이 아니에요." }));
    await u.upload(input(), file("b.png", "image/png"));
    expect(await screen.findByText("이미지 파일이 아니에요.")).toBeInTheDocument();
  });

  it("로고가 있으면 apiUrl 을 붙여 보여주고 삭제할 수 있다", async () => {
    const p = setup({ logoUrl: "/assets/logo.png" });
    const img = screen.getByAltText("행사 로고") as HTMLImageElement;
    expect(img.getAttribute("src")).toMatch(/\/assets\/logo\.png$/);
    await userEvent.setup().click(screen.getByRole("button", { name: "로고 삭제" }));
    await waitFor(() => expect(p.onChanged).toHaveBeenCalled());
    expect(p.remove).toHaveBeenCalled();
  });

  it("로고가 없으면 삭제 버튼이 없다", () => {
    setup();
    expect(screen.queryByRole("button", { name: "로고 삭제" })).not.toBeInTheDocument();
  });
});

describe("행사 설정 탭", () => {
  const url = "/manage/events/10?tab=settings";

  it("이름과 안내 문구를 저장하고 비우면 null 이다", async () => {
    vi.mocked(admin.updateEvent).mockResolvedValue(EVENT);
    const { queryClient } = renderAt(url);
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const u = userEvent.setup();
    const name = await screen.findByLabelText("행사 이름");
    await u.clear(name);
    await u.type(name, "봄 축제");
    expect(screen.getByText("0/500")).toBeInTheDocument();
    await u.type(screen.getByLabelText("안내 문구"), "비가 오면 실내");
    expect(screen.getByText("8/500")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(admin.updateEvent).toHaveBeenCalledWith(10, { name: "봄 축제", notice: "비가 오면 실내" }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["admin", "event", 10] }));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["admin", "events", 1] });

    await u.clear(screen.getByLabelText("안내 문구"));
    await u.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(admin.updateEvent).toHaveBeenLastCalledWith(10, { name: "봄 축제", notice: null }));
  });

  it("501자는 저장할 수 없다", async () => {
    renderAt(url);
    const u = userEvent.setup();
    await u.click(await screen.findByLabelText("안내 문구"));
    await u.paste("가".repeat(501));
    expect(screen.getByText("501/500")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("다시 받아온 행사 정보가 입력 중인 글을 덮어쓰지 않는다", async () => {
    const { queryClient } = renderAt(url);
    const u = userEvent.setup();
    const name = await screen.findByLabelText("행사 이름");
    await u.type(name, "!");
    vi.mocked(admin.getEvent).mockResolvedValue({ event: { ...EVENT, name: "서버 이름" }, org: ORG });
    await queryClient.invalidateQueries({ queryKey: ["admin", "event", 10] });
    await waitFor(() => expect(admin.getEvent).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("행사 이름")).toHaveValue("가을 축제!");
  });

  it("저장 422 문구를 입력란에 보여준다", async () => {
    vi.mocked(admin.updateEvent).mockRejectedValue(new ApiError(422, "invalid", { name: "행사 이름을 입력해 주세요." }));
    renderAt(url);
    await userEvent.setup().click(await screen.findByRole("button", { name: "저장" }));
    expect(await screen.findByText("행사 이름을 입력해 주세요.")).toBeInTheDocument();
  });

  it("로고를 올리면 행사 정보를 새로 받는다", async () => {
    vi.mocked(admin.uploadEventLogo).mockResolvedValue({ logo_url: "/assets/x.png" });
    const { queryClient } = renderAt(url);
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const f = file("a.png", "image/png");
    await userEvent.setup().upload(await screen.findByLabelText("행사 로고"), f);
    await waitFor(() => expect(admin.uploadEventLogo).toHaveBeenCalledWith(10, f));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["admin", "event", 10] }));
  });

  async function openDelete() {
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "행사 삭제" }));
    const dlg = await screen.findByRole("dialog");
    return { u, dlg };
  }

  it("이름을 정확히 입력해야 삭제할 수 있고, 일반 계정은 내 대시보드로 간다", async () => {
    vi.mocked(admin.deleteEvent).mockResolvedValue(undefined);
    vi.mocked(admin.getOverview).mockResolvedValue({
      org: ORG,
      owned: [],
      linked: [],
      totals: { today: 0, total: 0, active_booths: 0, booths: 0 },
    });
    const { where, queryClient } = renderAt(url);
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const { u, dlg } = await openDelete();
    expect(within(dlg).getByText(/부스 3개와 모든 신청/)).toBeInTheDocument();
    const confirm = within(dlg).getByRole("button", { name: "삭제" });
    expect(confirm).toBeDisabled();
    await u.type(within(dlg).getByRole("textbox"), "가을 축제");
    expect(confirm).toBeEnabled();
    await u.click(confirm);
    await waitFor(() => expect(where()).toBe("/manage"));
    expect(admin.deleteEvent).toHaveBeenCalledWith(10);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["admin", "overview", 1] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["admin", "events", 1] });
  });

  it("슈퍼관리자는 기관 화면으로 간다", async () => {
    vi.mocked(admin.getMe).mockResolvedValue(me({ id: 1, org_id: null, is_superadmin: true }, null));
    vi.mocked(admin.deleteEvent).mockResolvedValue(undefined);
    const { where } = renderAt(url);
    const { u, dlg } = await openDelete();
    await u.type(within(dlg).getByRole("textbox"), "가을 축제");
    await u.click(within(dlg).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(where()).toBe("/manage/super/orgs/1"));
  });

  it("삭제 실패 문구를 보여주고 머문다", async () => {
    vi.mocked(admin.deleteEvent).mockRejectedValue(new ApiError(403, "forbidden"));
    const { where } = renderAt(url);
    const { u, dlg } = await openDelete();
    await u.type(within(dlg).getByRole("textbox"), "가을 축제");
    await u.click(within(dlg).getByRole("button", { name: "삭제" }));
    expect(await screen.findByText("이 작업을 할 권한이 없어요.")).toBeInTheDocument();
    expect(where()).toBe("/manage/events/10");
  });
});
