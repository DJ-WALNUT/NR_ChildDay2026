import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../src/api/client";
import type { AuditItem, AuditPage, MeResponse, SessionOrg, SessionUser } from "../src/api/types";
import { routes } from "../src/routes";
import ActivityList from "../src/manage/ActivityList";

vi.mock("../src/api/admin", async (orig) => ({
  ...(await orig<typeof import("../src/api/admin")>()),
  getMe: vi.fn(),
  listAudit: vi.fn(),
  uploadOrgLogo: vi.fn(),
  removeOrgLogo: vi.fn(),
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

function item(id: number, over: Partial<AuditItem> = {}): AuditItem {
  return {
    id,
    org_id: 1,
    actor_org_id: 1,
    user_id: 7,
    actor: "staff",
    actor_label: `행위자${id}`,
    action: "booth.create",
    target: null,
    summary: `요약${id}`,
    detail: null,
    at: 1_700_000_000 + id * 60,
    ...over,
  };
}
const page = (items: AuditItem[], next_before: number | null = null): AuditPage => ({ items, next_before });

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderList(load: (p: { before?: number; action?: string }) => Promise<AuditPage>) {
  render(
    <QueryClientProvider client={client()}>
      <ActivityList queryKey={[...adminKeys.audit(1)]} load={load} />
    </QueryClientProvider>,
  );
}

function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={client()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(admin.getMe).mockResolvedValue(ME);
});

describe("활동 기록 목록", () => {
  it("시각(KST)·행위자·요약을 받은 순서대로 보여 준다", async () => {
    const load = vi.fn().mockResolvedValue(page([item(2, { at: 1_700_000_100 }), item(1, { at: 1_700_000_000 })]));
    renderList(load);
    const table = await screen.findByRole("region", { name: "활동 기록" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("2023-11-15 07:15")).toBeInTheDocument(); // 1_700_000_100 KST
    expect(within(rows[0]).getByText("행위자2")).toBeInTheDocument();
    expect(within(rows[0]).getByText("요약2")).toBeInTheDocument();
    expect(within(rows[1]).getByText("요약1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
  });

  it("빈 결과는 빈 상태 문구를 보여 준다", async () => {
    renderList(vi.fn().mockResolvedValue(page([])));
    expect(await screen.findByText("활동 기록이 없어요")).toBeInTheDocument();
  });

  it("종류를 바꾸면 접두사로 처음부터 다시 받는다", async () => {
    const load = vi.fn().mockResolvedValue(page([item(1)]));
    renderList(load);
    const u = userEvent.setup();
    await screen.findByText("요약1");
    expect(load).toHaveBeenLastCalledWith({ before: undefined, action: undefined });
    const select = screen.getByLabelText("종류");
    const labels = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(labels).toEqual([
      "전체",
      "로그인·비밀번호",
      "계정",
      "행사",
      "부스",
      "운영 단체",
      "신청",
      "내려받기",
      "기관",
    ]);
    await u.selectOptions(select, "부스");
    await waitFor(() => expect(load).toHaveBeenLastCalledWith({ before: undefined, action: "booth" }));
    await u.selectOptions(select, "로그인·비밀번호");
    await waitFor(() => expect(load).toHaveBeenLastCalledWith({ before: undefined, action: "auth" }));
    await u.selectOptions(select, "전체");
    await waitFor(() => expect(load).toHaveBeenLastCalledWith({ before: undefined, action: undefined }));
  });

  it("더 보기로 다음 쪽을 이어 붙이고 끝나면 버튼이 사라진다", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(page([item(2)], 1_700_000_050))
      .mockResolvedValueOnce(page([item(1)], null));
    renderList(load);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "더 보기" }));
    expect(await screen.findByText("요약1")).toBeInTheDocument();
    expect(load).toHaveBeenLastCalledWith({ before: 1_700_000_050, action: undefined });
    expect(screen.getByText("요약2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
  });

  it("추가 로드가 실패해도 받은 목록을 두고 다시 시도할 수 있다", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(page([item(2)], 1_700_000_050))
      .mockRejectedValueOnce(new ApiError(500, "server_error"))
      .mockResolvedValueOnce(page([item(1)], null));
    renderList(load);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "더 보기" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("요약2")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("요약1")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("첫 로드가 실패하면 오류와 다시 시도를 보여 준다", async () => {
    const load = vi.fn().mockRejectedValueOnce(new ApiError(500, "server_error")).mockResolvedValueOnce(page([item(1)]));
    renderList(load);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("요약1")).toBeInTheDocument();
  });
});

describe("활동 기록 화면", () => {
  it("내 기관의 기록을 받아 보여 준다", async () => {
    vi.mocked(admin.listAudit).mockResolvedValue(page([item(1)]));
    renderRoute("/manage/activity");
    expect(await screen.findByText("요약1")).toBeInTheDocument();
    expect(admin.listAudit).toHaveBeenCalledWith(1, { before: undefined, action: undefined });
  });
});

describe("기관 설정", () => {
  it("기관 이름과 주소를 보여 준다", async () => {
    renderRoute("/manage/org");
    expect(await screen.findByText("나름교회", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/nareum`)).toBeInTheDocument();
  });

  it("로고를 올리면 계정 정보를 다시 받는다", async () => {
    vi.mocked(admin.uploadOrgLogo).mockResolvedValue({} as never);
    renderRoute("/manage/org");
    const u = userEvent.setup();
    const input = await screen.findByLabelText("기관 로고");
    const before = vi.mocked(admin.getMe).mock.calls.length;
    const file = new File(["x"], "logo.png", { type: "image/png" });
    await u.upload(input, file);
    await waitFor(() => expect(admin.uploadOrgLogo).toHaveBeenCalledWith(1, file));
    await waitFor(() => expect(vi.mocked(admin.getMe).mock.calls.length).toBeGreaterThan(before));
  });
});
