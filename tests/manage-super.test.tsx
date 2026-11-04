import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../src/api/client";
import type { AuditPage, MeResponse, Member, Overview, SessionUser, SuperOrg } from "../src/api/types";
import { routes } from "../src/routes";

vi.mock("../src/api/admin", async (orig) => ({
  ...(await orig<typeof import("../src/api/admin")>()),
  getMe: vi.fn(),
  getOverview: vi.fn(),
  createEvent: vi.fn(),
  listMembers: vi.fn(),
  resetMemberPassword: vi.fn(),
  listSuperOrgs: vi.fn(),
  createSuperOrg: vi.fn(),
  updateSuperOrg: vi.fn(),
  listSuperAudit: vi.fn(),
  downloadBackup: vi.fn(),
  whoamiIp: vi.fn(),
}));
vi.mock("../src/lib/download", () => ({ downloadBlob: vi.fn() }));
import * as admin from "../src/api/admin";
import { adminKeys } from "../src/api/admin";
import { downloadBlob } from "../src/lib/download";

const SUPER: SessionUser = {
  id: 1,
  username: "root",
  display_name: "총괄",
  org_id: null,
  is_superadmin: true,
  must_change_password: false,
};
const ME: MeResponse = { user: SUPER, csrf: "tok", org: null };

function org(id: number, over: Partial<SuperOrg> = {}): SuperOrg {
  return { id, name: `기관${id}`, slug: `org${id}`, is_active: true, created_at: 1_700_000_000, user_count: 3, event_count: 2, ...over };
}
const ORGS = [
  org(1),
  org(2, { name: "푸른교회", slug: "blue", user_count: 5, event_count: 4 }),
  org(3, { name: "쉬는기관", is_active: false }),
];

const OVERVIEW: Overview = {
  org: { id: 2, name: "푸른교회", slug: "blue" },
  owned: [],
  linked: [],
  totals: { today: 0, total: 0, booths: 0, active_booths: 0 },
};
const MEMBERS: Member[] = [
  { id: 20, username: "staff", display_name: "담당", is_active: true, must_change_password: false, last_login_at: null, created_at: 1 },
];
const EMPTY_AUDIT: AuditPage = { items: [], next_before: null };

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(queryClient, "invalidateQueries");
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { spy, router, queryClient };
}
const keysOf = (spy: ReturnType<typeof renderAt>["spy"]) => spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(admin.getMe).mockResolvedValue(ME);
  vi.mocked(admin.listSuperOrgs).mockResolvedValue(ORGS);
  vi.mocked(admin.getOverview).mockResolvedValue(OVERVIEW);
  vi.mocked(admin.listMembers).mockResolvedValue(MEMBERS);
  vi.mocked(admin.listSuperAudit).mockResolvedValue(EMPTY_AUDIT);
});

describe("기관 목록", () => {
  it("이름·주소·상태·계정 수·행사 수와 링크를 보인다(비활성 기관도 행사 보기)", async () => {
    renderAt("/manage/super");
    const table = await screen.findByRole("region", { name: "기관 목록" });
    const row = within(table).getByRole("row", { name: /푸른교회/ });
    expect(within(row).getByText("blue")).toBeInTheDocument();
    expect(within(row).getByText("활성")).toBeInTheDocument();
    expect(within(row).getByText("5")).toBeInTheDocument();
    expect(within(row).getByText("4")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /행사 보기/ })).toHaveAttribute("href", "/manage/super/orgs/2");
    expect(within(row).getByRole("link", { name: /계정 관리/ })).toHaveAttribute("href", "/manage/super/orgs/2/members");
    const off = within(table).getByRole("row", { name: /쉬는기관/ });
    expect(within(off).getByText("비활성")).toBeInTheDocument();
    expect(within(off).getByRole("link", { name: /행사 보기/ })).toHaveAttribute("href", "/manage/super/orgs/3");
  });

  it("표에 좁은 화면 안내가 있다", async () => {
    renderAt("/manage/super");
    await screen.findByRole("region", { name: "기관 목록" });
    expect(screen.getByText("옆으로 밀면 더 있어요")).toBeInTheDocument();
  });

  it("기관을 만들고 목록을 무효화한다", async () => {
    vi.mocked(admin.createSuperOrg).mockResolvedValue(org(4));
    const { spy } = renderAt("/manage/super");
    await screen.findByRole("region", { name: "기관 목록" });
    await userEvent.type(screen.getByLabelText("새 기관 이름"), "새기관");
    await userEvent.type(screen.getByLabelText("새 기관 주소"), "new-org");
    await userEvent.click(screen.getByRole("button", { name: "기관 만들기" }));
    await waitFor(() => expect(admin.createSuperOrg).toHaveBeenCalledWith({ name: "새기관", slug: "new-org" }));
    await waitFor(() => expect(keysOf(spy)).toContain(JSON.stringify(adminKeys.superOrgs())));
  });

  it("slug_taken 을 주소 입력란에 보인다", async () => {
    vi.mocked(admin.createSuperOrg).mockRejectedValue(new ApiError(409, "slug_taken"));
    renderAt("/manage/super");
    await screen.findByRole("region", { name: "기관 목록" });
    await userEvent.type(screen.getByLabelText("새 기관 이름"), "새기관");
    await userEvent.type(screen.getByLabelText("새 기관 주소"), "blue");
    await userEvent.click(screen.getByRole("button", { name: "기관 만들기" }));
    expect(await screen.findByText("이미 사용 중인 주소예요.")).toBeInTheDocument();
    expect(screen.getByLabelText("새 기관 주소")).toHaveAttribute("aria-invalid", "true");
  });

  it("422 fields.slug 를 주소 입력란에 보인다", async () => {
    vi.mocked(admin.createSuperOrg).mockRejectedValue(new ApiError(422, "invalid", { slug: "예약된 주소예요." }));
    renderAt("/manage/super");
    await screen.findByRole("region", { name: "기관 목록" });
    await userEvent.type(screen.getByLabelText("새 기관 이름"), "새기관");
    await userEvent.type(screen.getByLabelText("새 기관 주소"), "manage");
    await userEvent.click(screen.getByRole("button", { name: "기관 만들기" }));
    expect(await screen.findByText("예약된 주소예요.")).toBeInTheDocument();
    expect(screen.getByLabelText("새 기관 주소")).toHaveAttribute("aria-invalid", "true");
  });

  it("주소를 바꾸면 확인 대화상자를 거친다", async () => {
    vi.mocked(admin.updateSuperOrg).mockResolvedValue(org(2));
    const { spy } = renderAt("/manage/super");
    await userEvent.click(await screen.findByRole("button", { name: "푸른교회 수정" }));
    const slug = within(screen.getByRole("dialog")).getByLabelText("기관 주소");
    await userEvent.clear(slug);
    await userEvent.type(slug, "green");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText(/기존 방문객 주소와 QR이 끊겨요/)).toBeInTheDocument();
    expect(admin.updateSuperOrg).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "주소 바꾸기" }));
    await waitFor(() => expect(admin.updateSuperOrg).toHaveBeenCalledWith(2, { slug: "green" }));
    await waitFor(() => expect(keysOf(spy)).toContain(JSON.stringify(adminKeys.superOrgs())));
  });

  it("이름만 바꾸면 대화상자 없이 저장한다", async () => {
    vi.mocked(admin.updateSuperOrg).mockResolvedValue(org(2));
    renderAt("/manage/super");
    await userEvent.click(await screen.findByRole("button", { name: "푸른교회 수정" }));
    const name = within(screen.getByRole("dialog")).getByLabelText("기관 이름");
    await userEvent.clear(name);
    await userEvent.type(name, "초록교회");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(admin.updateSuperOrg).toHaveBeenCalledWith(2, { name: "초록교회" }));
    expect(screen.queryByText(/QR이 끊겨요/)).not.toBeInTheDocument();
  });

  it("비활성화는 확인 뒤에 보낸다", async () => {
    vi.mocked(admin.updateSuperOrg).mockResolvedValue(org(2, { is_active: false }));
    renderAt("/manage/super");
    await userEvent.click(await screen.findByRole("button", { name: "푸른교회 비활성화" }));
    expect(await screen.findByText(/소속 계정이 모두 로그아웃돼요/)).toBeInTheDocument();
    expect(admin.updateSuperOrg).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "비활성화하기" }));
    await waitFor(() => expect(admin.updateSuperOrg).toHaveBeenCalledWith(2, { is_active: false }));
  });
});

describe("기관별 화면", () => {
  it("기관별 대시보드에 기관 이름 제목이 하나만 있다", async () => {
    renderAt("/manage/super/orgs/2");
    expect(await screen.findByRole("heading", { level: 1, name: "푸른교회" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(admin.getOverview).toHaveBeenCalledWith(2);
  });

  it("행사 만들기는 그 기관으로 보낸다", async () => {
    vi.mocked(admin.createEvent).mockResolvedValue({ id: 9, name: "봄" } as never);
    renderAt("/manage/super/orgs/2");
    await userEvent.type(await screen.findByLabelText("행사 이름"), "봄 행사");
    await userEvent.click(screen.getByRole("button", { name: "행사 만들기" }));
    await waitFor(() => expect(admin.createEvent).toHaveBeenCalledWith(2, "봄 행사"));
  });

  it("없는 기관은 NotFound", async () => {
    renderAt("/manage/super/orgs/99");
    expect(await screen.findByText("찾을 수 없어요")).toBeInTheDocument();
    expect(admin.getOverview).not.toHaveBeenCalled();
  });

  it("숫자가 아닌 id 는 요청 없이 NotFound", async () => {
    renderAt("/manage/super/orgs/abc");
    expect(await screen.findByText("찾을 수 없어요")).toBeInTheDocument();
    expect(admin.listSuperOrgs).not.toHaveBeenCalled();
    expect(admin.getOverview).not.toHaveBeenCalled();
  });

  it("기관별 계정: orgId 로 받고 모든 행에 동작 버튼이 있다", async () => {
    renderAt("/manage/super/orgs/2/members");
    expect(await screen.findByRole("button", { name: "staff 비활성화" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "staff 비밀번호 초기화" })).toBeInTheDocument();
    expect(admin.listMembers).toHaveBeenCalledWith(2);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("기관 목록 재조회가 실패해도 표시 중인 임시 비밀번호를 잃지 않는다", async () => {
    vi.mocked(admin.resetMemberPassword).mockResolvedValue({ temp_password: "temp-1234" });
    const { queryClient } = renderAt("/manage/super/orgs/2/members");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "staff 비밀번호 초기화" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "초기화" }));
    expect(await screen.findByDisplayValue("temp-1234")).toBeInTheDocument();
    vi.mocked(admin.listSuperOrgs).mockRejectedValue(new ApiError(500, "server"));
    await act(() => queryClient.invalidateQueries({ queryKey: adminKeys.superOrgs() }));
    expect(await screen.findByText(/최신 정보를 받지 못했어요/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("temp-1234")).toBeInTheDocument();
  });

  it("기관별 계정: 표에 좁은 화면 안내가 있다", async () => {
    renderAt("/manage/super/orgs/2/members");
    await screen.findByRole("region", { name: "기관 계정 목록" });
    expect(screen.getByText("옆으로 밀면 더 있어요")).toBeInTheDocument();
  });

  it("기관별 계정: 없는 기관은 NotFound", async () => {
    renderAt("/manage/super/orgs/99/members");
    expect(await screen.findByText("찾을 수 없어요")).toBeInTheDocument();
    expect(admin.listMembers).not.toHaveBeenCalled();
  });
});

describe("전체 활동 기록", () => {
  it("기관 필터의 org_id 를 전달한다", async () => {
    renderAt("/manage/super?tab=activity");
    await waitFor(() => expect(admin.listSuperAudit).toHaveBeenCalled());
    expect(vi.mocked(admin.listSuperAudit).mock.calls[0][0]?.org_id).toBeUndefined();
    await userEvent.selectOptions(await screen.findByLabelText("기관"), "2");
    await waitFor(() => expect(admin.listSuperAudit).toHaveBeenLastCalledWith(expect.objectContaining({ org_id: 2 })));
  });
});

describe("시스템", () => {
  it("백업을 받아 KST 파일명으로 저장한다", async () => {
    const blob = new Blob(["db"]);
    vi.mocked(admin.downloadBackup).mockResolvedValue(blob);
    renderAt("/manage/super?tab=system");
    await userEvent.click(await screen.findByRole("button", { name: "백업 내려받기" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    const [data, name, type] = vi.mocked(downloadBlob).mock.calls[0];
    expect(data).toBe(blob);
    expect(name).toMatch(/^nrbooth-backup-\d{8}-\d{4}\.db$/);
    expect(type).toBe("application/octet-stream");
  });

  it("백업 중에는 버튼이 잠기고 실패하면 오류를 보인다", async () => {
    let reject!: (e: unknown) => void;
    vi.mocked(admin.downloadBackup).mockReturnValue(new Promise((_, r) => (reject = r)));
    renderAt("/manage/super?tab=system");
    const btn = await screen.findByRole("button", { name: "백업 내려받기" });
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
    reject(new ApiError(500, "http_500"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
    await waitFor(() => expect(btn).toBeEnabled());
  });

  it("접속 IP 를 보인다(헤더가 없으면 없음)", async () => {
    vi.mocked(admin.whoamiIp).mockResolvedValue({ remote_addr: "10.0.0.5", x_forwarded_for: null });
    renderAt("/manage/super?tab=system");
    await userEvent.click(await screen.findByRole("button", { name: "접속 IP 확인" }));
    expect(await screen.findByText("10.0.0.5")).toBeInTheDocument();
    expect(screen.getByText("없음")).toBeInTheDocument();
  });
});
