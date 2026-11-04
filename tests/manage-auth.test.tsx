import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../src/api/client";
import { adminKeys } from "../src/api/admin";
import type { MeResponse, SessionOrg, SessionUser } from "../src/api/types";
import { safeNext } from "../src/manage/auth/safeNext";
import { routes } from "../src/routes";

vi.mock("../src/api/admin", async (orig) => ({
  ...(await orig<typeof import("../src/api/admin")>()),
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  getOverview: vi.fn(),
  getEvent: vi.fn(),
  listBooths: vi.fn(),
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
const SUPER = me({ id: 1, username: "root", org_id: null, is_superadmin: true }, null);

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  const where = () => router.state.location.pathname + router.state.location.search;
  return { router, queryClient, where };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(admin.logout).mockResolvedValue(undefined);
});

describe("safeNext", () => {
  it("/manage 아래 같은 출처 경로만 통과시킨다", () => {
    expect(safeNext("/manage/events/1?tab=stats")).toBe("/manage/events/1?tab=stats");
    expect(safeNext("/manage")).toBe("/manage");
  });
  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "/manage//evil.example", "/managex", "/nareum", "/manage/../nareum"])(
    "%j 는 /manage 로 돌린다",
    (raw) => {
      expect(safeNext(raw)).toBe("/manage");
    },
  );
});

describe("관리자 로그인", () => {
  it("미로그인으로 들어가면 로그인 화면으로 가고, 로그인하면 원래 주소로 돌아온다", async () => {
    vi.mocked(admin.getMe).mockRejectedValueOnce(new ApiError(401, "unauthorized"));
    const { where } = renderAt("/manage/events/1?tab=stats");
    expect(await screen.findByRole("heading", { name: "로그인" })).toBeInTheDocument();
    expect(where()).toBe(`/manage/login?next=${encodeURIComponent("/manage/events/1?tab=stats")}`);

    vi.mocked(admin.login).mockResolvedValue({ user: USER, csrf: "tok" });
    vi.mocked(admin.getMe).mockResolvedValue(me());
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("아이디"), "staff");
    await u.type(screen.getByLabelText("비밀번호"), "secret-pass");
    await u.click(screen.getByRole("button", { name: "로그인" }));
    await waitFor(() => expect(where()).toBe("/manage/events/1?tab=stats"));
    expect(admin.login).toHaveBeenCalledWith("staff", "secret-pass");
  });

  it("next 가 다른 출처면 /manage 로 간다", async () => {
    vi.mocked(admin.getMe).mockRejectedValueOnce(new ApiError(401, "unauthorized"));
    const { where } = renderAt("/manage/login?next=//evil.example");
    await screen.findByRole("heading", { name: "로그인" });
    vi.mocked(admin.login).mockResolvedValue({ user: USER, csrf: "tok" });
    vi.mocked(admin.getMe).mockResolvedValue(me());
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("아이디"), "staff");
    await u.type(screen.getByLabelText("비밀번호"), "secret-pass");
    await u.click(screen.getByRole("button", { name: "로그인" }));
    await waitFor(() => expect(where()).toBe("/manage"));
  });

  it("틀린 비밀번호면 문구를 보여주고 입력값을 그대로 둔다", async () => {
    vi.mocked(admin.getMe).mockRejectedValue(new ApiError(401, "unauthorized"));
    vi.mocked(admin.login).mockRejectedValue(new ApiError(401, "invalid_credentials"));
    renderAt("/manage/login");
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("아이디"), "staff");
    await u.type(screen.getByLabelText("비밀번호"), "wrong-pass");
    await u.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByText("아이디 또는 비밀번호가 맞지 않아요.")).toBeInTheDocument();
    expect(screen.getByLabelText("아이디")).toHaveValue("staff");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("wrong-pass");
  });

  it("getMe 가 401 이면 로그인 화면이고, 로그인 화면에서 다시 이동하지 않는다", async () => {
    vi.mocked(admin.getMe).mockRejectedValue(new ApiError(401, "unauthorized"));
    const { where } = renderAt("/manage/login");
    expect(await screen.findByRole("heading", { name: "로그인" })).toBeInTheDocument();
    expect(where()).toBe("/manage/login");
  });

  it("getMe 가 네트워크 오류면 로그인 화면으로 보내지 않고 다시 시도를 보여준다", async () => {
    vi.mocked(admin.getMe).mockRejectedValueOnce(new ApiError(0, "network"));
    const { where } = renderAt("/manage");
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    expect(where()).toBe("/manage");
    vi.mocked(admin.getMe).mockResolvedValue(me());
    await userEvent.setup().click(retry);
    await waitFor(() => expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument());
    expect(where()).toBe("/manage");
  });
});

describe("비밀번호 변경", () => {
  it("변경 전에는 다른 화면으로 못 나가고, 성공하면 refresh 후 /manage 로 간다", async () => {
    vi.mocked(admin.getMe).mockResolvedValueOnce(me({ must_change_password: true }));
    const { router, where } = renderAt("/manage");
    await screen.findByRole("heading", { name: "비밀번호 변경" });
    expect(where()).toBe("/manage/password");

    await act(() => router.navigate("/manage/events/3"));
    expect(where()).toBe("/manage/password");

    vi.mocked(admin.changePassword).mockResolvedValue(undefined);
    vi.mocked(admin.getMe).mockResolvedValue(me());
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("현재 비밀번호"), "temp-pass");
    await u.type(screen.getByLabelText("새 비밀번호"), "brand-new-pass");
    await u.type(screen.getByLabelText("새 비밀번호 확인"), "brand-new-pass");
    await u.click(screen.getByRole("button", { name: "비밀번호 바꾸기" }));
    await waitFor(() => expect(where()).toBe("/manage"));
    expect(admin.changePassword).toHaveBeenCalledWith("temp-pass", "brand-new-pass");
    expect(admin.getMe).toHaveBeenCalledTimes(2);
  });

  it("422 필드 오류를 각 입력란에 보여준다", async () => {
    vi.mocked(admin.getMe).mockResolvedValue(me({ must_change_password: true }));
    vi.mocked(admin.changePassword).mockRejectedValue(
      new ApiError(422, "invalid", { current: "현재 비밀번호가 맞지 않아요.", new: "8자 이상이어야 해요." }),
    );
    renderAt("/manage/password");
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("현재 비밀번호"), "x");
    await u.type(screen.getByLabelText("새 비밀번호"), "short");
    await u.type(screen.getByLabelText("새 비밀번호 확인"), "short");
    await u.click(screen.getByRole("button", { name: "비밀번호 바꾸기" }));
    expect(await screen.findByText("현재 비밀번호가 맞지 않아요.")).toBeInTheDocument();
    expect(screen.getByText("8자 이상이어야 해요.")).toBeInTheDocument();
  });

  it("새 비밀번호 확인이 다르면 서버를 부르지 않는다", async () => {
    vi.mocked(admin.getMe).mockResolvedValue(me({ must_change_password: true }));
    renderAt("/manage/password");
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("현재 비밀번호"), "temp-pass");
    await u.type(screen.getByLabelText("새 비밀번호"), "brand-new-pass");
    await u.type(screen.getByLabelText("새 비밀번호 확인"), "another-pass");
    await u.click(screen.getByRole("button", { name: "비밀번호 바꾸기" }));
    expect(await screen.findByText("새 비밀번호가 서로 달라요.")).toBeInTheDocument();
    expect(admin.changePassword).not.toHaveBeenCalled();
  });
});

describe("접근 보호", () => {
  it("org 가 없는 슈퍼관리자는 /manage 에서 /manage/super 로 간다", async () => {
    vi.mocked(admin.getMe).mockResolvedValue(SUPER);
    const { where } = renderAt("/manage");
    await waitFor(() => expect(where()).toBe("/manage/super"));
  });

  it("일반 계정은 /manage/super 에서 /manage 로 돌아온다", async () => {
    vi.mocked(admin.getMe).mockResolvedValue(me());
    const { where } = renderAt("/manage/super");
    await waitFor(() => expect(where()).toBe("/manage"));
  });
});

describe("로그아웃과 세션 만료 시 캐시", () => {
  it("로그아웃하면 쿼리 캐시가 비고 로그인 화면으로 간다", async () => {
    vi.mocked(admin.getMe).mockResolvedValue(me({ must_change_password: true }));
    const { queryClient, where } = renderAt("/manage/password");
    queryClient.setQueryData(adminKeys.overview(1), { any: "thing" });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
    await userEvent.setup().click(await screen.findByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(where()).toBe("/manage/login"));
    expect(admin.logout).toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });

  // 세션 만료 이벤트가 화면 커밋과 구독(passive effect) 사이에 끼어들면 쿼리가 비운 뒤에 다시 만들어진다.
  // MutationObserver 는 커밋 직후, passive effect 전에 불러서 그 순간을 결정적으로 만든다.
  function atCommit(text: string, fn: () => void) {
    const mo = new MutationObserver(() => {
      if (document.body.textContent?.includes(text)) {
        mo.disconnect();
        fn();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  const unauthorized = () => window.dispatchEvent(new Event("nr:unauthorized"));

  it("쿼리 화면이 마운트된 채 nr:unauthorized 가 와도 캐시가 비고 next 가 붙는다", async () => {
    vi.mocked(admin.getMe).mockResolvedValue(me());
    vi.mocked(admin.getOverview).mockResolvedValue({
      org: { id: 1, name: "나름교회", slug: "nareum" },
      owned: [],
      linked: [],
      totals: { today: 0, total: 0, active_booths: 0, booths: 0 },
    });
    const { queryClient, where } = renderAt("/manage");
    await screen.findByRole("heading", { name: "대시보드" });
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(1));
    act(unauthorized);
    await waitFor(() => expect(where()).toBe(`/manage/login?next=${encodeURIComponent("/manage")}`));
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it.each([
    ["/manage", "체험부스 관리"],
    ["/manage/events/10", "가을 축제"],
  ])("%s: 커밋과 구독 사이에 만료돼도 비운 뒤 쿼리가 다시 남지 않는다", async (path, marker) => {
    vi.mocked(admin.getMe).mockResolvedValue(me());
    vi.mocked(admin.getOverview).mockResolvedValue({
      org: { id: 1, name: "나름교회", slug: "nareum" },
      owned: [],
      linked: [],
      totals: { today: 0, total: 0, active_booths: 0, booths: 0 },
    });
    vi.mocked(admin.getEvent).mockResolvedValue({
      event: { id: 10, name: "가을 축제", created_at: 1, booth_count: 0, partner_count: 0, logo_url: null, notice: null },
      org: ORG,
    });
    vi.mocked(admin.listBooths).mockResolvedValue([]);
    const { queryClient, where } = renderAt(path);
    atCommit(marker, unauthorized);
    await waitFor(() => expect(where()).toContain("/manage/login"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });
});

describe("로그아웃 실패", () => {
  async function openPasswordPage() {
    vi.mocked(admin.getMe).mockResolvedValue(me({ must_change_password: true }));
    const ctx = renderAt("/manage/password");
    ctx.queryClient.setQueryData(adminKeys.overview(1), { any: "thing" });
    const button = await screen.findByRole("button", { name: "로그아웃" });
    return { ...ctx, click: () => userEvent.setup().click(button) };
  }

  it("네트워크 오류면 세션과 캐시를 그대로 두고 문구를 보여준다", async () => {
    vi.mocked(admin.logout).mockRejectedValue(new ApiError(0, "network"));
    const { queryClient, where, click } = await openPasswordPage();
    await click();
    expect(await screen.findByText("연결이 불안정해요. 잠시 뒤 다시 시도해 주세요.")).toBeInTheDocument();
    expect(where()).toBe("/manage/password");
    expect(screen.getByRole("heading", { name: "비밀번호 변경" })).toBeInTheDocument();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
  });

  it("401 이면 이미 로그아웃된 것이니 정리하고 로그인 화면으로 간다", async () => {
    vi.mocked(admin.logout).mockRejectedValue(new ApiError(401, "unauthorized"));
    const { queryClient, where, click } = await openPasswordPage();
    await click();
    await waitFor(() => expect(where()).toBe("/manage/login"));
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it("403 csrf 면 getMe 로 새 토큰을 받고 한 번 다시 시도해 성공한다", async () => {
    vi.mocked(admin.logout).mockRejectedValueOnce(new ApiError(403, "csrf")).mockResolvedValueOnce(undefined);
    const { queryClient, where, click } = await openPasswordPage();
    await click();
    await waitFor(() => expect(where()).toBe("/manage/login"));
    expect(admin.logout).toHaveBeenCalledTimes(2);
    expect(admin.getMe).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it("403 csrf 재시도도 실패하면 세션을 그대로 두고 문구를 보여준다", async () => {
    vi.mocked(admin.logout).mockRejectedValue(new ApiError(403, "csrf"));
    const { queryClient, where, click } = await openPasswordPage();
    await click();
    expect(await screen.findByText("화면이 오래되었어요. 새로고침한 뒤 다시 시도해 주세요.")).toBeInTheDocument();
    expect(admin.logout).toHaveBeenCalledTimes(2);
    expect(where()).toBe("/manage/password");
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
  });
});
