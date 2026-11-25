import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../src/api/client";
import type { AdminEvent, Booth, MeResponse, Partner, SessionOrg, SessionUser, Stats } from "../src/api/types";
import { routes } from "../src/routes";
import { boothAccess } from "../src/manage/booth/BoothPage";

vi.mock("../src/api/admin", async (orig) => ({
  ...(await orig<typeof import("../src/api/admin")>()),
  getMe: vi.fn(),
  logout: vi.fn(),
  getBooth: vi.fn(),
  listReservations: vi.fn(),
  adminStats: vi.fn(),
  listEvents: vi.fn(),
  listPartners: vi.fn(),
  listBooths: vi.fn(),
  updateBooth: vi.fn(),
  rotateBoothToken: vi.fn(),
  deleteBooth: vi.fn(),
  getEvent: vi.fn(),
  getOverview: vi.fn(),
}));
vi.mock("../src/booth/QrPanel", () => ({
  QrPanel: (p: { links: { manage: string } }) => <div data-testid="qr">{p.links.manage}</div>,
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
const LINKED = me({ org_id: 2 }, { id: 2, name: "사랑교회", slug: "sarang", logo_url: null });

function booth(over: Partial<Booth> = {}): Booth {
  return {
    id: 5,
    event_id: 10,
    event_name: "가을 축제",
    org_id: 1,
    partner_id: null,
    partner_name: null,
    name: "농구 부스",
    mode: "time",
    use_waitlist: false,
    total_limit: 0,
    start_hour: 11,
    end_hour: 16,
    slots_per_hour: 3,
    limit_per_slot: 0,
    is_active: true,
    manage_token: "tok1",
    count: 0,
    availability: { slots: [], is_closed: false },
    ...over,
  };
}
const STATS: Stats = { age_label: "연령대", rows: [], male: 0, female: 0, total: 0 };
const ev = (id: number, name: string): AdminEvent => ({
  id,
  name,
  created_at: 1_700_000_000,
  booth_count: 1,
  partner_count: 0,
  logo_url: null,
  notice: null,
  age_label: "연령대",
  age_options: ["0~8세"],
});
const PARTNERS: Partner[] = [
  { id: 3, name: "청년부", linked_org: null, access_token: "p3", booth_count: 0 },
  { id: 4, name: "중고등부", linked_org: null, access_token: "p4", booth_count: 0 },
];
const detail = (b: Booth) => ({ booth: b, org: { name: "나름교회", slug: "nareum" } });

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(queryClient, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  const keys = () => spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
  return { router, keys, queryClient, unmount: view.unmount };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(admin.getMe).mockResolvedValue(me());
  vi.mocked(admin.getBooth).mockResolvedValue(detail(booth()));
  vi.mocked(admin.listReservations).mockResolvedValue([]);
  vi.mocked(admin.adminStats).mockResolvedValue(STATS);
  vi.mocked(admin.listEvents).mockResolvedValue([ev(10, "가을 축제"), ev(11, "봄 축제")]);
  vi.mocked(admin.listPartners).mockResolvedValue(PARTNERS);
  vi.mocked(admin.updateBooth).mockResolvedValue(booth());
  vi.mocked(admin.getEvent).mockResolvedValue({ event: ev(10, "가을 축제"), org: ORG });
  vi.mocked(admin.listBooths).mockResolvedValue([]);
});

describe("boothAccess", () => {
  it.each([
    ["소유 기관", USER, ORG, "own"],
    ["슈퍼관리자(다른 기관 부스도)", SUPER.user, null, "own"],
    ["연결 기관", LINKED.user, LINKED.org, "manage"],
  ] as const)("%s → %s", (_name, user, org, want) => {
    expect(boothAccess(booth(), user, org)).toBe(want);
  });
});

describe("부스 상세", () => {
  it("소유 사용자는 행사로 돌아가는 링크와 소유자 동작을 본다", async () => {
    renderAt("/manage/booths/5");
    expect(await screen.findByRole("heading", { level: 1, name: "농구 부스" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /행사로 돌아가기/ })).toHaveAttribute("href", "/manage/events/10");
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(await screen.findByRole("button", { name: "행사 이동" })).toBeInTheDocument();
    expect(admin.getBooth).toHaveBeenCalledWith(5);
  });

  it("연결 기관은 소유자 동작이 없고 명단·설정·QR은 보이며 조회도 하지 않는다", async () => {
    vi.mocked(admin.getMe).mockResolvedValue(LINKED);
    renderAt("/manage/booths/5");
    await screen.findByRole("heading", { level: 1, name: "농구 부스" });
    expect(screen.getByRole("link", { name: /돌아가기/ })).toHaveAttribute("href", "/manage");
    expect(screen.getByRole("heading", { name: "명단" })).toBeInTheDocument();
    expect(screen.getByTestId("qr")).toBeInTheDocument();
    for (const name of ["행사 이동", "운영 단체 배정", "링크 재발급", "부스 삭제"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(admin.listEvents).not.toHaveBeenCalled();
    expect(admin.listPartners).not.toHaveBeenCalled();
  });

  it("슈퍼관리자는 다른 기관 부스에서도 own 이고 조회는 부스의 기관 기준이다", async () => {
    vi.mocked(admin.getMe).mockResolvedValue(SUPER);
    renderAt("/manage/booths/5");
    expect(await screen.findByRole("button", { name: "행사 이동" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /행사로 돌아가기/ })).toHaveAttribute("href", "/manage/events/10");
    await waitFor(() => expect(admin.listEvents).toHaveBeenCalledWith(1));
    expect(admin.listPartners).toHaveBeenCalledWith(10);
  });

  it("없는 부스(404)는 NotFound 이고 숫자가 아닌 id 는 요청하지 않는다", async () => {
    vi.mocked(admin.getBooth).mockRejectedValue(new ApiError(404, "not_found"));
    const first = renderAt("/manage/booths/5");
    expect(await screen.findByRole("heading", { name: "찾을 수 없어요" })).toBeInTheDocument();
    first.unmount();
    vi.mocked(admin.getBooth).mockClear();
    renderAt("/manage/booths/abc");
    expect(await screen.findByRole("heading", { name: "찾을 수 없어요" })).toBeInTheDocument();
    expect(admin.getBooth).not.toHaveBeenCalled();
  });

  it("행사 이동: 현재 행사는 빼고, 확인 뒤 event_id 를 보내고 관련 키를 무효화한다", async () => {
    vi.mocked(admin.updateBooth).mockResolvedValue(booth({ event_id: 11 }));
    const { keys } = renderAt("/manage/booths/5");
    const user = userEvent.setup();
    const select = await screen.findByLabelText("이동할 행사");
    await screen.findByRole("option", { name: "봄 축제" });
    expect(within(select).queryByRole("option", { name: "가을 축제" })).not.toBeInTheDocument();
    await user.selectOptions(select, "봄 축제");
    await user.click(screen.getByRole("button", { name: "행사 이동" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/운영 단체 배정이 해제돼요/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "이동" }));
    await waitFor(() => expect(admin.updateBooth).toHaveBeenCalledWith(5, { event_id: 11 }));
    await waitFor(() =>
      expect(keys()).toEqual(
        expect.arrayContaining([
          JSON.stringify(["admin", "booth", 5]),
          JSON.stringify(["admin", "booths", 10]),
          JSON.stringify(["admin", "booths", 11]),
          JSON.stringify(["admin", "event", 10]),
          JSON.stringify(["admin", "event", 11]),
          JSON.stringify(["admin", "partners", 10]),
          JSON.stringify(["admin", "partners", 11]),
          JSON.stringify(["admin", "overview", 1]),
        ]),
      ),
    );
  });

  it("다른 행사가 없으면 이동 영역이 잠긴다", async () => {
    vi.mocked(admin.listEvents).mockResolvedValue([ev(10, "가을 축제")]);
    renderAt("/manage/booths/5");
    expect(await screen.findByText(/옮길 수 있는 다른 행사가 없어요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "행사 이동" })).toBeDisabled();
  });

  it("운영 단체 배정: 미배정 옵션과 함께 partner_id 를 보낸다", async () => {
    const { keys } = renderAt("/manage/booths/5");
    const user = userEvent.setup();
    const select = await screen.findByLabelText("운영 단체");
    await screen.findByRole("option", { name: "청년부" });
    expect(within(select).getByRole("option", { name: "미배정" })).toBeInTheDocument();
    await user.selectOptions(select, "청년부");
    await user.click(screen.getByRole("button", { name: "운영 단체 배정" }));
    await waitFor(() => expect(admin.updateBooth).toHaveBeenCalledWith(5, { partner_id: 3 }));
    await waitFor(() => expect(keys()).toContain(JSON.stringify(["admin", "partners", 10])));
  });

  it("링크 재발급: 확인 뒤 rotateBoothToken, 콘솔 쿼리를 무효화해 QR 이 새 주소가 된다", async () => {
    vi.mocked(admin.rotateBoothToken).mockResolvedValue({ manage_token: "tok2" });
    vi.mocked(admin.getBooth)
      .mockResolvedValueOnce(detail(booth()))
      .mockResolvedValue(detail(booth({ manage_token: "tok2" })));
    const { keys } = renderAt("/manage/booths/5");
    const user = userEvent.setup();
    expect(await screen.findByTestId("qr")).toHaveTextContent("/b/tok1");
    await user.click(await screen.findByRole("button", { name: "링크 재발급" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "재발급" }));
    await waitFor(() => expect(admin.rotateBoothToken).toHaveBeenCalledWith(5));
    await waitFor(() => expect(screen.getByTestId("qr")).toHaveTextContent("/b/tok2"));
    expect(keys()).toEqual(
      expect.arrayContaining([
        JSON.stringify(["admin", "booth", 5]),
        JSON.stringify(["admin", "booths", 10]),
        JSON.stringify(["admin", "event", 10]),
        JSON.stringify(["admin", "partners", 10]),
        JSON.stringify(["admin", "overview", 1]),
      ]),
    );
  });

  it("삭제: 부스 이름을 입력해야 열리고 성공하면 행사로 이동한다", async () => {
    vi.mocked(admin.deleteBooth).mockResolvedValue(undefined);
    const { router } = renderAt("/manage/booths/5");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "부스 삭제" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "삭제" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "농구 부스");
    await user.click(confirm);
    await waitFor(() => expect(admin.deleteBooth).toHaveBeenCalledWith(5));
    await waitFor(() => expect(router.state.location.pathname).toBe("/manage/events/10"));
  });

  it("행사 목록을 못 받으면 오류와 다시 시도를 보이고 이동 선택은 잠긴다", async () => {
    vi.mocked(admin.listEvents).mockRejectedValueOnce(new ApiError(500, "server_error"));
    renderAt("/manage/booths/5");
    const user = userEvent.setup();
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    expect(screen.getByLabelText("이동할 행사")).toBeDisabled();
    await user.click(retry);
    await waitFor(() => expect(screen.getByLabelText("이동할 행사")).toBeEnabled());
  });

  it("운영 단체 목록을 못 받으면 오류와 다시 시도를 보이고 배정 선택은 잠긴다", async () => {
    vi.mocked(admin.listPartners).mockRejectedValueOnce(new ApiError(500, "server_error"));
    renderAt("/manage/booths/5");
    const user = userEvent.setup();
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    expect(screen.getByLabelText("운영 단체")).toBeDisabled();
    expect(screen.getByRole("button", { name: "운영 단체 배정" })).toBeDisabled();
    await user.click(retry);
    await waitFor(() => expect(screen.getByLabelText("운영 단체")).toBeEnabled());
  });

  it("배정이 422 면 서버의 필드 문구를 보인다", async () => {
    vi.mocked(admin.updateBooth).mockRejectedValue(new ApiError(422, "invalid", { partner_id: "다른 행사의 단체예요." }));
    renderAt("/manage/booths/5");
    const user = userEvent.setup();
    await screen.findByRole("option", { name: "청년부" });
    await user.selectOptions(screen.getByLabelText("운영 단체"), "청년부");
    await user.click(screen.getByRole("button", { name: "운영 단체 배정" }));
    expect(await screen.findByText("다른 행사의 단체예요.")).toBeInTheDocument();
  });

  it("삭제 뒤에는 기록을 대체해 이동하고 지운 부스 캐시를 비운다", async () => {
    vi.mocked(admin.deleteBooth).mockResolvedValue(undefined);
    const { router, queryClient } = renderAt("/manage/booths/5");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "부스 삭제" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "농구 부스");
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/manage/events/10"));
    expect(router.state.historyAction).toBe("REPLACE");
    expect(queryClient.getQueryData(["admin", "booth", 5])).toBeUndefined();
  });
});
