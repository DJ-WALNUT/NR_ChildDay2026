import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { ReactNode } from "react";
import { ApiError } from "../src/api/client";
import type { Booth, Reservation } from "../src/api/types";
import type { BoothDetail, BoothSource } from "../src/booth/BoothSource";
import BoothConsole from "../src/booth/BoothConsole";
import { routes } from "../src/routes";

vi.mock("../src/api/link", async (orig) => {
  const real = await orig<typeof import("../src/api/link")>();
  return { ...real, getBoothLink: vi.fn() };
});
import * as link from "../src/api/link";

const booth: Booth = {
  id: 7,
  event_id: 1,
  event_name: "어린이날 행사",
  org_id: 1,
  partner_id: null,
  partner_name: null,
  name: "비누 만들기",
  mode: "time",
  use_waitlist: true,
  total_limit: 0,
  start_hour: 10,
  end_hour: 14,
  slots_per_hour: 2,
  limit_per_slot: 5,
  is_active: true,
  manage_token: "tok",
  count: 3,
  availability: { slots: [], is_closed: false },
};
const res = (id: number, name: string, code: string, slot: string, status: Reservation["status"]): Reservation => ({
  id,
  booth_id: 7,
  name,
  gender: "여",
  age_group: "초등 저학년",
  code,
  slot,
  status,
  created_at: "2026-10-30T01:00:00",
});
const detail = (): BoothDetail => ({
  booth,
  org: { name: "나름교회", slug: "nareum" },
  reservations: [
    res(1, "박두리", "5678", "11시 B타임", "normal"),
    res(2, "김나름", "1234", "10시 A타임", "normal"),
    res(3, "이세나", "9999", "10시 A타임", "waiting"),
    res(4, "최하나", "1111", "11시 A타임", "completed"),
  ],
  stats: { rows: [{ age_group: "초등 저학년", male: 0, female: 4, total: 4 }], male: 0, female: 4, total: 4 },
});

function fakeSource(over: Partial<BoothSource> = {}): BoothSource {
  return {
    key: ["fake"],
    get: vi.fn(async () => detail()),
    patch: vi.fn(async () => booth),
    toggle: vi.fn(async () => ({ is_active: false })),
    setStatus: vi.fn(async (rid, status) => ({ reservation: { ...res(rid, "x", "0000", "s", status) } })),
    deleteReservation: vi.fn(async () => undefined),
    clear: vi.fn(async () => ({ deleted: 4 })),
    exportData: vi.fn(async () => ({ booths: [] })),
    links: { manage: "http://x/b/tok", reserve: "http://x/nareum/reserve/7" },
    ...over,
  };
}

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const row = (name: string) => screen.getByRole("listitem", { name });

describe("BoothConsole", () => {
  it("명단이 슬롯 순서로 묶여 보이고 숫자 표가 맞다", async () => {
    wrap(<BoothConsole source={fakeSource()} access="manage" />);
    await screen.findByRole("heading", { name: "비누 만들기" });
    const heads = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(heads.slice(0, 3)).toEqual(["10시 A타임2명", "11시 A타임1명", "11시 B타임1명"]);
    const dl = screen.getByLabelText("신청 현황");
    expect(dl).toHaveTextContent("신청4");
    expect(dl).toHaveTextContent("체험완료1");
    expect(dl).toHaveTextContent("대기1");
    expect(dl).toHaveTextContent("노쇼0");
  });

  it("식별번호 검색은 한 명만 남긴다", async () => {
    const user = userEvent.setup();
    wrap(<BoothConsole source={fakeSource()} access="manage" />);
    await screen.findByText("김나름");
    await user.type(screen.getByLabelText("이름·식별번호 검색"), "1234");
    expect(screen.getByText("김나름")).toBeInTheDocument();
    expect(screen.queryByText("박두리")).not.toBeInTheDocument();
  });

  it("빈 명단은 안내를 보여준다", async () => {
    wrap(<BoothConsole source={fakeSource({ get: async () => ({ ...detail(), reservations: [] }) })} access="manage" />);
    expect(await screen.findByText("아직 신청이 없어요.")).toBeInTheDocument();
  });

  it("상태 버튼은 사람 이름이 들어간 이름표와 44px 높이를 가진다", async () => {
    wrap(<BoothConsole source={fakeSource()} access="manage" />);
    const btn = await screen.findByRole("button", { name: "김나름 체험완료" });
    expect(btn).toHaveClass("h-11");
  });

  it("대기 행의 확정은 normal 로 보내고 정원 초과 안내를 보여준다", async () => {
    const user = userEvent.setup();
    const setStatus = vi.fn(async (rid: number, status: Reservation["status"]) => ({
      reservation: res(rid, "이세나", "9999", "10시 A타임", status),
      over_capacity: true as const,
    }));
    wrap(<BoothConsole source={fakeSource({ setStatus })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "이세나 확정" }));
    expect(setStatus).toHaveBeenCalledWith(3, "normal");
    expect(await screen.findByText("정원을 넘겨 확정됐어요.")).toBeInTheDocument();
  });

  it("노쇼는 즉시 반영되고 실패하면 되돌아오며 오류를 알린다", async () => {
    const user = userEvent.setup();
    let fail!: (e: unknown) => void;
    const setStatus = vi.fn(() => new Promise<never>((_, rej) => (fail = rej)));
    wrap(<BoothConsole source={fakeSource({ setStatus })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "김나름 노쇼" }));
    // 응답 전에 이미 노쇼로 보인다.
    expect(within(row("김나름")).getByText("노쇼", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByLabelText("신청 현황")).toHaveTextContent("노쇼1");
    fail(new ApiError(500, "http_500"));
    expect(await screen.findByRole("alert")).toHaveTextContent("문제가 생겼어요");
    await waitFor(() => expect(screen.getByLabelText("신청 현황")).toHaveTextContent("노쇼0"));
    expect(within(row("김나름")).queryByText("노쇼", { selector: "span" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "김나름 노쇼" })).toBeInTheDocument();
  });

  it("진행 중인 상태 변경 동안 자동 갱신이 낙관적 값을 덮어쓰지 않는다", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const get = vi.fn(async () => detail());
    const setStatus = vi.fn(
      (rid: number, status: Reservation["status"]) =>
        new Promise<{ reservation: Reservation }>((resolve) => {
          release = () => resolve({ reservation: res(rid, "김나름", "1234", "10시 A타임", status) });
        }),
    );
    wrap(<BoothConsole source={fakeSource({ get, setStatus })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "김나름 노쇼" }));
    await waitFor(() => expect(setStatus).toHaveBeenCalled());
    expect(screen.getByLabelText("신청 현황")).toHaveTextContent("노쇼1");
    release();
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThanOrEqual(2)); // 끝난 뒤 다시 맞춤
  });

  it("삭제는 확인을 거친다", async () => {
    const user = userEvent.setup();
    const source = fakeSource();
    wrap(<BoothConsole source={source} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "김나름 삭제" }));
    expect(source.deleteReservation).not.toHaveBeenCalled();
    const dlg = screen.getByRole("dialog");
    await user.click(within(dlg).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(source.deleteReservation).toHaveBeenCalledWith(2));
  });

  it("초기화 대화상자에 신청 건수가 나오고 확인하면 clear 를 부른다", async () => {
    const user = userEvent.setup();
    const source = fakeSource();
    wrap(<BoothConsole source={source} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "초기화" }));
    const dlg = screen.getByRole("dialog");
    expect(dlg).toHaveTextContent("신청 4건이 모두 삭제돼요");
    expect(source.clear).not.toHaveBeenCalled();
    await user.click(within(dlg).getByRole("button", { name: "초기화" }));
    await waitFor(() => expect(source.clear).toHaveBeenCalledTimes(1));
  });

  it("운영 마감은 확인 없이 바로 전환을 부른다", async () => {
    const user = userEvent.setup();
    const source = fakeSource();
    wrap(<BoothConsole source={source} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "운영 마감" }));
    await waitFor(() => expect(source.toggle).toHaveBeenCalledTimes(1));
  });

  it("전환이 실패하면 오류를 보여준다", async () => {
    const user = userEvent.setup();
    wrap(<BoothConsole source={fakeSource({ toggle: async () => { throw new ApiError(0, "network"); } })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "운영 마감" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("연결이 불안정해요");
  });

  it("extraOwnActions 는 own 에서만 보인다", async () => {
    const extra = <p>행사 이동</p>;
    const { unmount } = wrap(<BoothConsole source={fakeSource()} access="manage" extraOwnActions={extra} />);
    await screen.findByRole("heading", { name: "비누 만들기" });
    expect(screen.queryByText("행사 이동")).not.toBeInTheDocument();
    unmount();
    wrap(<BoothConsole source={fakeSource()} access="own" extraOwnActions={extra} />);
    expect(await screen.findByText("행사 이동")).toBeInTheDocument();
  });

  it("설정 저장의 422 필드 오류를 해당 칸에 보여준다", async () => {
    const user = userEvent.setup();
    const patch = vi.fn(async () => {
      throw new ApiError(422, "invalid", { end_hour: "종료 시각은 시작보다 늦어야 해요." });
    });
    wrap(<BoothConsole source={fakeSource({ patch })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "설정" }));
    await user.click(screen.getByRole("button", { name: "저장" }));
    const field = await screen.findByLabelText("종료 시각");
    await waitFor(() => expect(field).toHaveAccessibleDescription(/종료 시각은 시작보다 늦어야 해요/));
    expect(field).toBeInvalid();
  });

  it("설정을 저장하면 patch 에 값이 숫자로 간다", async () => {
    const user = userEvent.setup();
    const patch = vi.fn(async () => booth);
    wrap(<BoothConsole source={fakeSource({ patch })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "설정" }));
    await user.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenCalledWith(expect.objectContaining({ name: "비누 만들기", end_hour: 14, slots_per_hour: 2 }));
    expect(await screen.findByText("저장했어요.")).toBeInTheDocument();
  });

  it("404 는 notFound 화면을 보여준다", async () => {
    wrap(
      <BoothConsole
        source={fakeSource({ get: async () => { throw new ApiError(404, "not_found"); } })}
        access="manage"
        notFound={<p>없어요</p>}
      />,
    );
    expect(await screen.findByText("없어요")).toBeInTheDocument();
  });
});

describe("BoothLinkPage", () => {
  function renderAt(path: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
      </QueryClientProvider>,
    );
  }

  it("404 는 링크 만료 문구를 보여준다", async () => {
    vi.mocked(link.getBoothLink).mockRejectedValue(new ApiError(404, "not_found"));
    renderAt("/b/gone");
    expect(await screen.findByText("이 링크는 더 이상 쓸 수 없어요.", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText("담당자에게 새 링크를 받아 주세요.")).toBeInTheDocument();
    expect(link.getBoothLink).toHaveBeenCalledWith("gone");
  });

  it("정상 응답이면 부스 관리 화면이 나온다", async () => {
    vi.mocked(link.getBoothLink).mockResolvedValue(detail());
    renderAt("/b/tok");
    expect(await screen.findByRole("heading", { name: "비누 만들기" }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/b/tok`)).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/nareum/reserve/7`)).toBeInTheDocument();
  });
});
