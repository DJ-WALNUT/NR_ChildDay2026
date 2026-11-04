import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../src/api/client";
import type { MeResponse, Member, SessionOrg, SessionUser } from "../src/api/types";
import { routes } from "../src/routes";
import { MembersPanel } from "../src/manage/account/MembersPanel";

vi.mock("../src/api/admin", async (orig) => ({
  ...(await orig<typeof import("../src/api/admin")>()),
  getMe: vi.fn(),
  listMembers: vi.fn(),
  createMember: vi.fn(),
  updateMember: vi.fn(),
  resetMemberPassword: vi.fn(),
  changePassword: vi.fn(),
}));
import * as admin from "../src/api/admin";
import { adminKeys } from "../src/api/admin";

const ORG: SessionOrg = { id: 1, name: "나름교회", slug: "nareum", logo_url: null };
const USER: SessionUser = {
  id: 7,
  username: "staff",
  display_name: "담당자",
  org_id: 1,
  is_superadmin: false,
  must_change_password: false,
};
const ME: MeResponse = { user: USER, csrf: "tok", org: ORG };
const TEMP = "Zq7-temp-PW-4829";

function member(id: number, over: Partial<Member> = {}): Member {
  return {
    id,
    username: `user${id}`,
    display_name: `이름${id}`,
    is_active: true,
    must_change_password: false,
    last_login_at: 1_700_000_000,
    created_at: 1_690_000_000,
    ...over,
  };
}
const MEMBERS = [
  member(7, { username: "staff", display_name: "담당자" }),
  member(8, { username: "helper", display_name: "도우미", last_login_at: null, must_change_password: true }),
  member(9, { username: "old", display_name: "전임자", is_active: false }),
];

function client() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { queryClient, spy: vi.spyOn(queryClient, "invalidateQueries") };
}
const keysOf = (spy: ReturnType<typeof client>["spy"]) => spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));

function renderPanel(selfId = 7) {
  const c = client();
  render(
    <QueryClientProvider client={c.queryClient}>
      <MembersPanel orgId={1} selfId={selfId} />
    </QueryClientProvider>,
  );
  return c;
}

function renderAccount() {
  const c = client();
  const router = createMemoryRouter(routes, { initialEntries: ["/manage/account"] });
  render(
    <QueryClientProvider client={c.queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...c, router };
}

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(admin.getMe).mockResolvedValue(ME);
  vi.mocked(admin.listMembers).mockResolvedValue(MEMBERS);
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

describe("내 계정", () => {
  it("표시 이름을 저장하고 계정 정보를 다시 받는다", async () => {
    vi.mocked(admin.updateMember).mockResolvedValue(member(7));
    const { spy } = renderAccount();
    const u = userEvent.setup();
    const name = await screen.findByLabelText("표시 이름");
    expect(name).toHaveValue("담당자");
    const before = vi.mocked(admin.getMe).mock.calls.length;
    await u.clear(name);
    await u.type(name, "새 이름");
    await u.click(screen.getByRole("button", { name: "이름 저장" }));
    await waitFor(() => expect(admin.updateMember).toHaveBeenCalledWith(7, { display_name: "새 이름" }));
    await waitFor(() => expect(vi.mocked(admin.getMe).mock.calls.length).toBeGreaterThan(before));
    await waitFor(() => expect(keysOf(spy)).toContain(JSON.stringify(adminKeys.members(1))));
  });

  it("표시 이름 422 는 입력란에 보인다", async () => {
    vi.mocked(admin.updateMember).mockRejectedValue(new ApiError(422, "invalid", { display_name: "1~40자로 써 주세요." }));
    renderAccount();
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "이름 저장" }));
    expect(await screen.findByText("1~40자로 써 주세요.")).toBeInTheDocument();
  });

  it("비밀번호 변경 폼을 쓰고, 바꾸면 알려 준다", async () => {
    vi.mocked(admin.changePassword).mockResolvedValue(undefined as never);
    renderAccount();
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("현재 비밀번호"), "oldpass12");
    await u.type(screen.getByLabelText("새 비밀번호"), "newpass123");
    await u.type(screen.getByLabelText("새 비밀번호 확인"), "newpass123");
    await u.click(screen.getByRole("button", { name: "비밀번호 바꾸기" }));
    await waitFor(() => expect(admin.changePassword).toHaveBeenCalledWith("oldpass12", "newpass123"));
    expect(await screen.findByText("비밀번호를 바꿨어요.")).toBeInTheDocument();
    expect(screen.getByLabelText("현재 비밀번호")).toHaveValue("");

    vi.mocked(admin.changePassword).mockRejectedValue(new ApiError(422, "invalid", { current: "맞지 않아요." }));
    await u.type(screen.getByLabelText("현재 비밀번호"), "x");
    await u.type(screen.getByLabelText("새 비밀번호"), "newpass456");
    await u.type(screen.getByLabelText("새 비밀번호 확인"), "newpass456");
    await u.click(screen.getByRole("button", { name: "비밀번호 바꾸기" }));
    expect(await screen.findByText("맞지 않아요.")).toBeInTheDocument();
    expect(screen.queryByText("비밀번호를 바꿨어요.")).not.toBeInTheDocument();
  });
});

describe("기관 계정 목록", () => {
  it("아이디·표시 이름·상태·마지막 접속을 보인다", async () => {
    renderPanel();
    const table = await screen.findByRole("region", { name: "기관 계정 목록" });
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]).getByText("staff")).toBeInTheDocument();
    expect(within(rows[1]).getByText("활성")).toBeInTheDocument();
    expect(within(rows[1]).getByText("2023-11-15 07:13")).toBeInTheDocument();
    expect(within(rows[2]).getByText("비밀번호 변경 전")).toBeInTheDocument();
    expect(within(rows[2]).getByText("접속 전")).toBeInTheDocument();
    expect(within(rows[3]).getByText("비활성")).toBeInTheDocument();
  });

  it("내 행에는 비활성화·초기화 버튼이 없다", async () => {
    renderPanel();
    await screen.findByText("helper");
    expect(screen.queryByRole("button", { name: "staff 비활성화" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "staff 비밀번호 초기화" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "helper 비활성화" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "old 활성화" })).toBeInTheDocument();
  });

  it("활성화·비활성화 뒤 목록을 무효화한다", async () => {
    vi.mocked(admin.updateMember).mockResolvedValue(member(8));
    const { spy } = renderPanel();
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "helper 비활성화" }));
    await waitFor(() => expect(admin.updateMember).toHaveBeenCalledWith(8, { is_active: false }));
    await waitFor(() => expect(keysOf(spy)).toContain(JSON.stringify(adminKeys.members(1))));
    await u.click(screen.getByRole("button", { name: "old 활성화" }));
    await waitFor(() => expect(admin.updateMember).toHaveBeenCalledWith(9, { is_active: true }));
  });

  it("마지막 활성 계정 409 는 문구로 보인다", async () => {
    vi.mocked(admin.updateMember).mockRejectedValue(new ApiError(409, "last_active_user"));
    renderPanel();
    await userEvent.setup().click(await screen.findByRole("button", { name: "helper 비활성화" }));
    expect(await screen.findByText("마지막 활성 계정은 비활성화할 수 없어요.")).toBeInTheDocument();
  });
});

describe("계정 발급", () => {
  async function issue() {
    vi.mocked(admin.createMember).mockResolvedValue({ user: member(10, { username: "newbie" }), temp_password: TEMP });
    const c = renderPanel();
    const u = userEvent.setup();
    // userEvent.setup() 이 clipboard 를 자기 것으로 바꾸므로 그 뒤에 다시 심는다.
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await screen.findByText("helper");
    await u.type(screen.getByLabelText("아이디"), "newbie");
    await u.type(screen.getByLabelText("표시 이름"), "새 담당");
    await u.click(screen.getByRole("button", { name: "계정 발급" }));
    const dialog = await screen.findByRole("dialog");
    return { ...c, u, dialog };
  }

  it("발급하면 임시 비밀번호를 읽기 전용 입력란에 보여 준다", async () => {
    const { dialog } = await issue();
    expect(admin.createMember).toHaveBeenCalledWith(1, { username: "newbie", display_name: "새 담당" });
    const input = within(dialog).getByLabelText("임시 비밀번호");
    expect(input).toHaveValue(TEMP);
    expect(input).toHaveAttribute("readonly");
    expect(within(dialog).getByText("이 화면을 닫으면 다시 볼 수 없어요.")).toBeInTheDocument();
  });

  it("복사하면 알리고, 거부되면 직접 복사 안내와 함께 값을 선택해 둔다", async () => {
    const { dialog, u } = await issue();
    await u.click(within(dialog).getByRole("button", { name: "복사" }));
    expect(writeText).toHaveBeenCalledWith(TEMP);
    expect(await within(dialog).findByText("복사했어요")).toBeInTheDocument();

    writeText.mockRejectedValue(new Error("denied"));
    await u.click(within(dialog).getByRole("button", { name: "복사" }));
    expect(await within(dialog).findByText("직접 복사해 주세요.")).toBeInTheDocument();
    expect(within(dialog).queryByText("복사했어요")).not.toBeInTheDocument();
    const input = within(dialog).getByLabelText("임시 비밀번호") as HTMLInputElement;
    expect(input).toHaveValue(TEMP);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(TEMP.length);
  });

  it("clipboard 가 없어도 직접 복사 안내를 보인다", async () => {
    const { dialog, u } = await issue();
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    await u.click(within(dialog).getByRole("button", { name: "복사" }));
    expect(await within(dialog).findByText("직접 복사해 주세요.")).toBeInTheDocument();
  });

  it("보이는 동안 목록을 무효화해도 유지되고, 닫은 뒤 캐시에 값이 남지 않는다", async () => {
    const { dialog, u, queryClient } = await issue();
    const before = vi.mocked(admin.listMembers).mock.calls.length;
    await queryClient.invalidateQueries({ queryKey: adminKeys.members(1) });
    await waitFor(() => expect(vi.mocked(admin.listMembers).mock.calls.length).toBeGreaterThan(before));
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(within(dialog).getByLabelText("임시 비밀번호")).toHaveValue(TEMP);
    await u.click(within(dialog).getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map((q) => q.state.data))).not.toContain(TEMP);
    expect(JSON.stringify(queryClient.getMutationCache().getAll().map((m) => m.state.data))).not.toContain(TEMP);
  });

  it("username_taken 은 아이디 입력란에, 422 는 각 입력란에 보인다", async () => {
    vi.mocked(admin.createMember).mockRejectedValueOnce(new ApiError(409, "username_taken"));
    renderPanel();
    const u = userEvent.setup();
    await screen.findByText("helper");
    await u.type(screen.getByLabelText("아이디"), "helper");
    await u.type(screen.getByLabelText("표시 이름"), "x");
    await u.click(screen.getByRole("button", { name: "계정 발급" }));
    expect(await screen.findByText("이미 사용 중인 아이디예요.")).toBeInTheDocument();

    vi.mocked(admin.createMember).mockRejectedValueOnce(
      new ApiError(422, "invalid", { username: "3~32자로 써 주세요.", display_name: "1~40자로 써 주세요." }),
    );
    await u.click(screen.getByRole("button", { name: "계정 발급" }));
    expect(await screen.findByText("3~32자로 써 주세요.")).toBeInTheDocument();
    expect(screen.getByText("1~40자로 써 주세요.")).toBeInTheDocument();
  });
});

describe("비밀번호 초기화", () => {
  it("확인 대화상자에서 세션이 끊긴다고 알리고, 확인하면 임시 비밀번호를 보이고 목록을 다시 받는다", async () => {
    vi.mocked(admin.resetMemberPassword).mockResolvedValue({ temp_password: TEMP });
    const { queryClient, spy } = renderPanel();
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "helper 비밀번호 초기화" }));
    const confirm = screen.getByRole("dialog");
    expect(within(confirm).getByText(/로그인 중인 기기에서 로그아웃돼요/)).toBeInTheDocument();
    expect(admin.resetMemberPassword).not.toHaveBeenCalled();
    await u.click(within(confirm).getByRole("button", { name: "초기화" }));
    await waitFor(() => expect(admin.resetMemberPassword).toHaveBeenCalledWith(8));
    const dialog = await screen.findByRole("dialog", { name: /임시 비밀번호/ });
    expect(within(dialog).getByLabelText("임시 비밀번호")).toHaveValue(TEMP);
    expect(keysOf(spy)).toContain(JSON.stringify(adminKeys.members(1)));
    await u.click(within(dialog).getByRole("button", { name: "닫기" }));
    expect(JSON.stringify(queryClient.getQueryCache().getAll().map((q) => q.state.data))).not.toContain(TEMP);
    expect(JSON.stringify(queryClient.getMutationCache().getAll().map((m) => m.state.data))).not.toContain(TEMP);
  });

  it("요청 중에는 취소해도 대화상자가 그대로이고, 결과는 하나의 임시 비밀번호 대화상자로만 나온다", async () => {
    let finish!: (v: { temp_password: string }) => void;
    vi.mocked(admin.resetMemberPassword).mockReturnValue(new Promise((r) => (finish = r)));
    renderPanel();
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "helper 비밀번호 초기화" }));
    await u.click(within(screen.getByRole("dialog")).getByRole("button", { name: "초기화" }));
    await waitFor(() => expect(admin.resetMemberPassword).toHaveBeenCalled());
    await u.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByRole("dialog", { name: "비밀번호 초기화" })).toBeInTheDocument();
    finish({ temp_password: TEMP });
    const dialog = await screen.findByRole("dialog", { name: /임시 비밀번호/ });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(dialog).getByLabelText("임시 비밀번호")).toHaveValue(TEMP);
  });
});

describe("처리 중 잠금", () => {
  it("발급 중에는 발급 버튼과 행의 초기화 버튼이 잠긴다", async () => {
    let finish!: (v: { user: Member; temp_password: string }) => void;
    vi.mocked(admin.createMember).mockReturnValue(new Promise((r) => (finish = r)));
    renderPanel();
    const u = userEvent.setup();
    await screen.findByText("helper");
    await u.type(screen.getByLabelText("아이디"), "newbie");
    await u.type(screen.getByLabelText("표시 이름"), "새 담당");
    await u.click(screen.getByRole("button", { name: "계정 발급" }));
    await waitFor(() => expect(admin.createMember).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "helper 비밀번호 초기화" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "계정 발급" })).toBeDisabled();
    finish({ user: member(10), temp_password: TEMP });
    expect(await screen.findByRole("dialog", { name: /임시 비밀번호/ })).toBeInTheDocument();
  });

  it("초기화 중에는 발급 버튼이 잠긴다", async () => {
    vi.mocked(admin.resetMemberPassword).mockReturnValue(new Promise(() => {}));
    renderPanel();
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "helper 비밀번호 초기화" }));
    await u.click(within(screen.getByRole("dialog")).getByRole("button", { name: "초기화" }));
    await waitFor(() => expect(admin.resetMemberPassword).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "계정 발급" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "old 비밀번호 초기화" })).toBeDisabled();
  });
});
