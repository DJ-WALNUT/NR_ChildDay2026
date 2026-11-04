import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../src/api/client";
import type { AdminEvent, Booth, MeResponse, Overview, SessionOrg, SessionUser } from "../src/api/types";
import { routes } from "../src/routes";

vi.mock("../src/api/admin", async (orig) => ({
  ...(await orig<typeof import("../src/api/admin")>()),
  getMe: vi.fn(),
  logout: vi.fn(),
  getOverview: vi.fn(),
  getEvent: vi.fn(),
  createEvent: vi.fn(),
  listBooths: vi.fn(),
  createBooth: vi.fn(),
  batchBoothStatus: vi.fn(),
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

const EVENT: AdminEvent = {
  id: 10,
  name: "가을 축제",
  created_at: 1_700_000_000,
  booth_count: 3,
  partner_count: 0,
  logo_url: null,
  notice: null,
};
function booth(id: number, over: Partial<Booth> = {}): Booth {
  return {
    id,
    event_id: 10,
    event_name: "가을 축제",
    org_id: 1,
    partner_id: null,
    partner_name: null,
    name: `부스${id}`,
    mode: "time",
    use_waitlist: false,
    total_limit: 0,
    start_hour: 11,
    end_hour: 16,
    slots_per_hour: 3,
    limit_per_slot: 0,
    is_active: true,
    manage_token: "t",
    count: id * 2,
    availability: { slots: [], is_closed: false },
    ...over,
  };
}
const OVERVIEW: Overview = {
  org: { id: 1, name: "나름교회", slug: "nareum" },
  owned: [
    {
      event: { id: 10, name: "가을 축제" },
      booths: [booth(1), booth(2, { is_active: false }), booth(3, { is_active: false })],
    },
  ],
  linked: [
    {
      partner: { id: 4, name: "청년부" },
      event: { id: 20, name: "연합 체육대회" },
      host: { id: 2, name: "은혜교회" },
      booths: [booth(30, { name: "농구 부스" })],
    },
  ],
  totals: { today: 5, total: 42, active_booths: 1, booths: 3 },
};

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
  vi.mocked(admin.getMe).mockResolvedValue(me());
  vi.mocked(admin.logout).mockResolvedValue(undefined);
  vi.mocked(admin.getOverview).mockResolvedValue(OVERVIEW);
  vi.mocked(admin.getEvent).mockResolvedValue({ event: EVENT, org: ORG });
  vi.mocked(admin.listBooths).mockResolvedValue([booth(1), booth(2, { is_active: false }), booth(3, { mode: "fcfs" })]);
});

describe("대시보드", () => {
  it("내 행사, 전체 수치, 참가한 연합 행사를 보여준다", async () => {
    renderAt("/manage");
    const own = await screen.findByRole("region", { name: "내 행사" });
    expect(within(own).getByRole("link", { name: "가을 축제" })).toHaveAttribute("href", "/manage/events/10");
    expect(within(own).getByText("운영 중 1 / 전체 3")).toBeInTheDocument();

    const dts = screen.getAllByRole("term").map((t) => t.textContent);
    expect(dts).toEqual(["오늘 신청", "전체 신청", "운영 중 부스", "전체 부스"]);
    expect(screen.getAllByRole("definition").map((d) => d.textContent)).toEqual(["5", "42", "1", "3"]);

    const linked = screen.getByRole("region", { name: "참가한 연합 행사" });
    expect(within(linked).getByText("연합 체육대회")).toBeInTheDocument();
    expect(within(linked).getByText("은혜교회 · 청년부")).toBeInTheDocument();
    expect(within(linked).getByRole("link", { name: "농구 부스" })).toHaveAttribute("href", "/manage/booths/30");
    expect(admin.getOverview).toHaveBeenCalledWith(1);
  });

  it("행사가 없으면 안내와 만들기 입력을 보여준다", async () => {
    vi.mocked(admin.getOverview).mockResolvedValue({ ...OVERVIEW, owned: [], linked: [] });
    renderAt("/manage");
    expect(await screen.findByText("아직 행사가 없어요")).toBeInTheDocument();
    expect(screen.getByLabelText("행사 이름")).toBeInTheDocument();
  });

  it("행사를 만들면 행사 화면으로 간다", async () => {
    vi.mocked(admin.createEvent).mockResolvedValue({ ...EVENT, id: 11, name: "봄 축제" });
    vi.mocked(admin.getEvent).mockResolvedValue({ event: { ...EVENT, id: 11, name: "봄 축제" }, org: ORG });
    const { where } = renderAt("/manage");
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("행사 이름"), "봄 축제");
    await u.click(screen.getByRole("button", { name: "행사 만들기" }));
    await waitFor(() => expect(where()).toBe("/manage/events/11"));
    expect(admin.createEvent).toHaveBeenCalledWith(1, "봄 축제");
  });

  it("422 문구를 입력란에 보여준다", async () => {
    vi.mocked(admin.createEvent).mockRejectedValue(new ApiError(422, "invalid", { name: "행사 이름을 입력해 주세요." }));
    const { where } = renderAt("/manage");
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "행사 만들기" }));
    expect(await screen.findByText("행사 이름을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByLabelText("행사 이름")).toHaveAttribute("aria-invalid", "true");
    expect(where()).toBe("/manage");
  });
});

describe("관리자 메뉴", () => {
  it("기관 계정과 슈퍼관리자의 메뉴가 다르다", async () => {
    renderAt("/manage");
    const nav = await screen.findByRole("navigation", { name: "관리 메뉴" });
    const links = within(nav)
      .getAllByRole("link")
      .map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["대시보드", "/manage"],
      ["활동 기록", "/manage/activity"],
      ["기관 계정", "/manage/members"],
      ["기관 설정", "/manage/org"],
      ["내 계정", "/manage/account"],
    ]);
    expect(within(nav).getByRole("link", { name: "대시보드" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "활동 기록" })).not.toHaveAttribute("aria-current");
  });

  it("슈퍼관리자 메뉴는 슈퍼관리자와 내 계정이다", async () => {
    vi.mocked(admin.getMe).mockResolvedValue(SUPER);
    renderAt("/manage/super");
    const nav = await screen.findByRole("navigation", { name: "관리 메뉴" });
    const links = within(nav)
      .getAllByRole("link")
      .map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["슈퍼관리자", "/manage/super"],
      ["내 계정", "/manage/account"],
    ]);
  });

  it("휴대폰 메뉴 버튼이 열고 닫고, 링크를 누르면 닫힌다", async () => {
    renderAt("/manage");
    const u = userEvent.setup();
    const btn = await screen.findByRole("button", { name: "메뉴" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await u.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    await u.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await u.click(btn);
    await u.click(screen.getByRole("link", { name: "대시보드" }));
    expect(screen.getByRole("button", { name: "메뉴" })).toHaveAttribute("aria-expanded", "false");
  });

  it("로그아웃 실패는 알리고 화면을 유지한다", async () => {
    vi.mocked(admin.logout).mockRejectedValue(new ApiError(0, "network"));
    const { where } = renderAt("/manage");
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "로그아웃" }));
    expect(await screen.findByText("연결이 불안정해요. 잠시 뒤 다시 시도해 주세요.")).toBeInTheDocument();
    expect(where()).toBe("/manage");
  });
});

describe("행사 화면", () => {
  it("?tab=stats 는 실적 탭을 선택하고 탭을 누르면 주소가 바뀐다", async () => {
    const { where } = renderAt("/manage/events/10?tab=stats");
    const stats = await screen.findByRole("tab", { name: "실적" });
    expect(stats).toHaveAttribute("aria-selected", "true");
    const u = userEvent.setup();
    await u.click(screen.getByRole("tab", { name: "부스" }));
    expect(where()).toBe("/manage/events/10?tab=booths");
    expect(screen.getByRole("tab", { name: "부스" })).toHaveAttribute("aria-selected", "true");
  });

  it("잘못된 tab 은 부스 탭이다", async () => {
    renderAt("/manage/events/10?tab=zzz");
    expect(await screen.findByRole("tab", { name: "부스" })).toHaveAttribute("aria-selected", "true");
  });

  it("행사 이름과 소유 기관이 보이고 돌아가기는 /manage 다", async () => {
    renderAt("/manage/events/10");
    expect(await screen.findByRole("heading", { name: "가을 축제" })).toBeInTheDocument();
    expect(screen.getByText("나름교회", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /돌아가기/ })).toHaveAttribute("href", "/manage");
    expect(admin.getEvent).toHaveBeenCalledWith(10);
  });

  it("숫자가 아닌 행사 번호는 API 를 부르지 않고 찾을 수 없어요", async () => {
    renderAt("/manage/events/abc");
    expect(await screen.findByRole("heading", { name: "찾을 수 없어요" })).toBeInTheDocument();
    expect(admin.getEvent).not.toHaveBeenCalled();
  });

  it("getEvent 가 404 면 찾을 수 없어요", async () => {
    vi.mocked(admin.getEvent).mockRejectedValue(new ApiError(404, "not_found"));
    renderAt("/manage/events/99");
    expect(await screen.findByRole("heading", { name: "찾을 수 없어요" })).toBeInTheDocument();
  });

  it("슈퍼관리자도 열 수 있고 소유 기관으로 돌아간다", async () => {
    vi.mocked(admin.getMe).mockResolvedValue(SUPER);
    vi.mocked(admin.getEvent).mockResolvedValue({ event: EVENT, org: { ...ORG, id: 5, name: "다른교회" } });
    renderAt("/manage/events/10");
    expect(await screen.findByRole("heading", { name: "가을 축제" })).toBeInTheDocument();
    expect(screen.getByText("다른교회", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /돌아가기/ })).toHaveAttribute("href", "/manage/super/orgs/5");
  });
});

describe("부스 탭", () => {
  it("번호·이름·방식·신청 수·상태·상세 링크를 표로 보여준다", async () => {
    renderAt("/manage/events/10");
    const table = await screen.findByRole("region", { name: "부스 목록" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    const first = within(rows[1]);
    expect(first.getByText("01")).toBeInTheDocument();
    expect(first.getByText("부스1")).toBeInTheDocument();
    expect(first.getByText("시간대별")).toBeInTheDocument();
    expect(first.getByText("2")).toBeInTheDocument();
    expect(first.getByText("운영 중")).toBeInTheDocument();
    expect(first.getByRole("link", { name: "부스1 상세" })).toHaveAttribute("href", "/manage/booths/1");
    expect(within(rows[2]).getByText("마감")).toBeInTheDocument();
    expect(within(rows[3]).getByText("선착순")).toBeInTheDocument();
  });

  it("선택한 부스를 일괄로 열고 목록을 다시 받고 선택을 해제한다", async () => {
    vi.mocked(admin.batchBoothStatus).mockResolvedValue({ updated: 2 });
    renderAt("/manage/events/10");
    const u = userEvent.setup();
    const start = await screen.findByRole("button", { name: "운영 시작" });
    expect(start).toBeDisabled();
    expect(screen.getByRole("button", { name: "운영 마감" })).toBeDisabled();

    await u.click(screen.getByRole("checkbox", { name: "부스1 선택" }));
    await u.click(screen.getByRole("checkbox", { name: "부스2 선택" }));
    expect(start).toBeEnabled();
    const calls = vi.mocked(admin.listBooths).mock.calls.length;
    await u.click(start);
    await waitFor(() => expect(admin.batchBoothStatus).toHaveBeenCalledWith([1, 2], true));
    await waitFor(() => expect(vi.mocked(admin.listBooths).mock.calls.length).toBeGreaterThan(calls));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "부스1 선택" })).not.toBeChecked());
    expect(screen.getByRole("button", { name: "운영 시작" })).toBeDisabled();
  });

  it("전체 선택으로 모두 고른다", async () => {
    vi.mocked(admin.batchBoothStatus).mockResolvedValue({ updated: 3 });
    renderAt("/manage/events/10");
    const u = userEvent.setup();
    await u.click(await screen.findByRole("checkbox", { name: "전체 선택" }));
    await u.click(screen.getByRole("button", { name: "운영 마감" }));
    await waitFor(() => expect(admin.batchBoothStatus).toHaveBeenCalledWith([1, 2, 3], false));
  });

  it("일괄 변경이 실패하면 오류를 알리고 선택을 유지한다", async () => {
    vi.mocked(admin.batchBoothStatus).mockRejectedValue(new ApiError(404, "not_found"));
    renderAt("/manage/events/10");
    const u = userEvent.setup();
    await u.click(await screen.findByRole("checkbox", { name: "부스1 선택" }));
    await u.click(screen.getByRole("button", { name: "운영 시작" }));
    expect(await screen.findByText("찾을 수 없어요.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "부스1 선택" })).toBeChecked();
  });

  it("이름만 입력해 부스를 추가하고 목록을 갱신한다", async () => {
    vi.mocked(admin.createBooth).mockResolvedValue(booth(4));
    renderAt("/manage/events/10");
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("부스 이름"), "새 부스");
    const calls = vi.mocked(admin.listBooths).mock.calls.length;
    const eventCalls = vi.mocked(admin.getEvent).mock.calls.length;
    await u.click(screen.getByRole("button", { name: "부스 추가" }));
    await waitFor(() => expect(admin.createBooth).toHaveBeenCalledWith(10, { name: "새 부스" }));
    await waitFor(() => expect(vi.mocked(admin.getEvent).mock.calls.length).toBeGreaterThan(eventCalls));
    await waitFor(() => expect(vi.mocked(admin.listBooths).mock.calls.length).toBeGreaterThan(calls));
    expect(screen.getByLabelText("부스 이름")).toHaveValue("");
  });

  it("빈 이름의 422 문구를 보여준다", async () => {
    vi.mocked(admin.createBooth).mockRejectedValue(new ApiError(422, "invalid", { name: "부스 이름을 입력해 주세요." }));
    renderAt("/manage/events/10");
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "부스 추가" }));
    expect(await screen.findByText("부스 이름을 입력해 주세요.")).toBeInTheDocument();
  });
});
