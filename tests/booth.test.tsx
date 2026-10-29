import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { ReactNode } from "react";
import { ApiError } from "../src/api/client";
import type { Booth, Reservation } from "../src/api/types";
import type { BoothDetail, BoothSource } from "../src/booth/BoothSource";
import BoothConsole from "../src/booth/BoothConsole";
import { linksOf } from "../src/booth/BoothSource";
import { partnerBoothSource } from "../src/booth/linkSources";
import { routes } from "../src/routes";

vi.mock("../src/api/link", async (orig) => {
  const real = await orig<typeof import("../src/api/link")>();
  return {
    ...real,
    getBoothLink: vi.fn(),
    getPartner: vi.fn(),
    getPartnerBooth: vi.fn(),
    listReservationsPartnerBooth: vi.fn(),
    partnerStats: vi.fn(),
    setStatusPartnerBooth: vi.fn(),
  };
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
    setStatus: vi.fn(async (rid, status) => ({
      reservation: { ...detail().reservations.find((r) => r.id === rid)!, status },
    })),
    deleteReservation: vi.fn(async () => undefined),
    clear: vi.fn(async () => ({ deleted: 4 })),
    exportData: vi.fn(async () => ({ booths: [] })),
    ...over,
  };
}

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// 행의 이름표는 "<이름> <상태>" 라서 이름으로 시작하는 것을 찾는다.
const row = (name: string) => screen.getByRole("listitem", { name: new RegExp(`^${name}`) });

/** 삭제·초기화가 다음 조회에 반영되는 가짜 서버 */
function statefulSource(over: Partial<BoothSource> = {}) {
  let list = detail().reservations;
  return fakeSource({
    get: vi.fn(async () => ({ ...detail(), reservations: list })),
    setStatus: vi.fn(async (rid: number, status: Reservation["status"]) => {
      list = list.map((r) => (r.id === rid ? { ...r, status } : r));
      return { reservation: list.find((r) => r.id === rid)! };
    }),
    deleteReservation: vi.fn(async (rid: number) => {
      list = list.filter((r) => r.id !== rid);
    }),
    clear: vi.fn(async () => {
      const deleted = list.length;
      list = [];
      return { deleted };
    }),
    ...over,
  });
}

describe("BoothConsole", () => {
  it("명단이 슬롯 순서로 묶여 보이고 숫자 표가 맞다", async () => {
    const get = async () => {
      const d = detail();
      return { ...d, reservations: [...d.reservations, res(5, "정아침", "2222", "9시 A타임", "normal")] };
    };
    wrap(<BoothConsole source={fakeSource({ get })} access="manage" />);
    await screen.findByRole("heading", { name: "비누 만들기" });
    const heads = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    // 문자열 순서면 "10시"가 "9시"보다 앞서므로, 시각 숫자 순서인지 확인한다.
    expect(heads.slice(0, 4)).toEqual(["9시 A타임1명", "10시 A타임2명", "11시 A타임1명", "11시 B타임1명"]);
    const dl = screen.getByLabelText("신청 현황");
    expect(dl).toHaveTextContent("신청5");
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

  it("노쇼는 즉시 반영되고, 실패하면 다시 조회가 끝나기 전에 되돌아오며 오류를 알린다", async () => {
    const user = userEvent.setup();
    let fail!: (e: unknown) => void;
    const setStatus = vi.fn(() => new Promise<never>((_, rej) => (fail = rej)));
    // 첫 조회 뒤의 조회는 끝나지 않는다: 되돌림이 조회 결과 덕분이 아니라는 것을 확인한다.
    const get = vi.fn().mockResolvedValueOnce(detail()).mockImplementation(() => new Promise(() => {}));
    wrap(<BoothConsole source={fakeSource({ get, setStatus })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "김나름 노쇼" }));
    expect(within(row("김나름")).getByText("노쇼", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByLabelText("신청 현황")).toHaveTextContent("노쇼1");
    fail(new ApiError(500, "http_500"));
    expect(await screen.findByRole("alert")).toHaveTextContent("문제가 생겼어요");
    await waitFor(() => expect(screen.getByLabelText("신청 현황")).toHaveTextContent("노쇼0"));
    expect(get).toHaveBeenCalledTimes(2); // 맞춤 조회는 시작됐지만 아직 끝나지 않았다
    expect(within(row("김나름")).queryByText("노쇼", { selector: "span" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "김나름 노쇼" })).toBeEnabled();
  });

  it("진행 중인 상태 변경 동안 창 포커스 갱신이 낙관적 값을 덮어쓰지 않는다", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const get = vi.fn(async () => detail()); // 서버는 아직 normal 로 답한다
    const setStatus = vi.fn(
      (rid: number, status: Reservation["status"]) =>
        new Promise<{ reservation: Reservation }>((resolve) => {
          release = () => resolve({ reservation: { ...detail().reservations[1], id: rid, status } });
        }),
    );
    wrap(<BoothConsole source={fakeSource({ get, setStatus })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "김나름 노쇼" }));
    await waitFor(() => expect(setStatus).toHaveBeenCalled());
    expect(get).toHaveBeenCalledTimes(1);
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(get).toHaveBeenCalledTimes(1); // 갱신 요청 자체를 하지 않는다
    expect(screen.getByLabelText("신청 현황")).toHaveTextContent("노쇼1");
    expect(screen.getByRole("button", { name: "새로고침" })).toBeDisabled();
    release();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2)); // 끝난 뒤에 서버 값으로 맞춘다
  });

  it("처리 중인 행의 버튼은 잠겨서 두 번 눌러도 밀려온 되돌리기·삭제가 눌리지 않는다", async () => {
    const user = userEvent.setup();
    const setStatus = vi.fn(() => new Promise<never>(() => {}));
    wrap(<BoothConsole source={fakeSource({ setStatus })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "김나름 노쇼" }));
    expect(await screen.findByRole("button", { name: "김나름 되돌리기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "김나름 삭제" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "김나름 되돌리기" }));
    expect(setStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "박두리 노쇼" })).toBeEnabled(); // 다른 행은 그대로
  });

  it("조회가 한 번 성공한 뒤 자동 갱신이 실패해도 명단은 그대로 두고 안내만 보인다", async () => {
    const user = userEvent.setup();
    const get = vi.fn().mockResolvedValueOnce(detail()).mockRejectedValue(new ApiError(500, "http_500"));
    wrap(<BoothConsole source={fakeSource({ get })} access="manage" />);
    await screen.findByText("김나름");
    await user.click(screen.getByRole("button", { name: "새로고침" }));
    expect(await screen.findByText(/최신 정보를 받지 못했어요/)).toBeInTheDocument();
    expect(screen.getByText("김나름")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "비누 만들기" })).toBeInTheDocument();
  });

  it("조회가 성공한 뒤 404 가 오면 notFound 화면으로 바뀐다", async () => {
    const user = userEvent.setup();
    const get = vi.fn().mockResolvedValueOnce(detail()).mockRejectedValue(new ApiError(404, "not_found"));
    wrap(<BoothConsole source={fakeSource({ get })} access="manage" notFound={<p>링크 만료</p>} />);
    await screen.findByText("김나름");
    await user.click(screen.getByRole("button", { name: "새로고침" }));
    expect(await screen.findByText("링크 만료")).toBeInTheDocument();
  });

  it("상태를 바꾸면 그 행으로 포커스가 가고 이름표에 새 상태가 들어간다", async () => {
    const user = userEvent.setup();
    wrap(<BoothConsole source={statefulSource()} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "김나름 체험완료" }));
    const li = await screen.findByRole("listitem", { name: "김나름 체험완료" });
    await waitFor(() => expect(li).toHaveFocus());
  });

  it("삭제하면 다음 행으로, 마지막 행이면 이전 행으로 포커스가 간다", async () => {
    const user = userEvent.setup();
    wrap(<BoothConsole source={statefulSource()} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "김나름 삭제" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(screen.queryByText("김나름")).not.toBeInTheDocument());
    await waitFor(() => expect(row("이세나")).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "박두리 삭제" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(screen.queryByText("박두리")).not.toBeInTheDocument());
    await waitFor(() => expect(row("최하나")).toHaveFocus());
  });

  it("초기화하면 명단 제목으로 포커스가 간다", async () => {
    const user = userEvent.setup();
    wrap(<BoothConsole source={statefulSource()} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "초기화" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "초기화" }));
    expect(await screen.findByText("아직 신청이 없어요.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "명단" })).toHaveFocus());
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
    const end = screen.getByLabelText("종료 시각");
    await user.clear(end);
    await user.type(end, "9");
    await user.click(screen.getByRole("button", { name: "저장" }));
    const field = await screen.findByLabelText("종료 시각");
    await waitFor(() => expect(field).toHaveAccessibleDescription(/종료 시각은 시작보다 늦어야 해요/));
    expect(field).toBeInvalid();
  });

  it("설정은 바꾼 칸만 보낸다", async () => {
    const user = userEvent.setup();
    const patch = vi.fn(async () => ({ ...booth, end_hour: 13 }));
    wrap(<BoothConsole source={fakeSource({ patch })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "설정" }));
    const end = screen.getByLabelText("종료 시각");
    await user.clear(end);
    await user.type(end, "13");
    await user.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenCalledWith({ end_hour: 13 });
    expect(await screen.findByText("저장했어요.")).toBeInTheDocument();
  });

  it("바꾼 것이 없으면 저장해도 서버를 부르지 않는다", async () => {
    const user = userEvent.setup();
    const patch = vi.fn(async () => booth);
    wrap(<BoothConsole source={fakeSource({ patch })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "설정" }));
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(patch).not.toHaveBeenCalled();
    expect(await screen.findByText("바꾼 내용이 없어요.")).toBeInTheDocument();
  });

  it("건드리지 않은 설정 칸은 서버의 새 값으로 갱신되고 고친 칸은 유지된다", async () => {
    const user = userEvent.setup();
    const get = vi
      .fn()
      .mockResolvedValueOnce(detail())
      .mockResolvedValue({ ...detail(), booth: { ...booth, name: "새 이름", end_hour: 20 } });
    wrap(<BoothConsole source={fakeSource({ get })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "설정" }));
    const start = screen.getByLabelText("시작 시각");
    await user.clear(start);
    await user.type(start, "9");
    await user.click(screen.getByRole("button", { name: "새로고침" }));
    await waitFor(() => expect(screen.getByLabelText("부스 이름")).toHaveValue("새 이름"));
    expect(screen.getByLabelText("종료 시각")).toHaveValue(20);
    expect(screen.getByLabelText("시작 시각")).toHaveValue(9);
  });

  it("보이지 않는 칸의 422 오류도 일반 안내로 보여준다", async () => {
    const user = userEvent.setup();
    const patch = vi.fn(async () => {
      throw new ApiError(422, "invalid", { total_limit: "인원은 0 이상이어야 해요." });
    });
    wrap(<BoothConsole source={fakeSource({ patch })} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "설정" }));
    await user.type(screen.getByLabelText("부스 이름"), "!");
    await user.click(screen.getByRole("button", { name: "저장" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("입력한 내용을 다시 확인해 주세요");
    expect(alert).toHaveTextContent("인원은 0 이상이어야 해요.");
  });

  it("시각 안내가 서버 규칙(0 ≤ 시작 ≤ 종료 ≤ 23)과 같다", async () => {
    const user = userEvent.setup();
    wrap(<BoothConsole source={fakeSource()} access="manage" />);
    await user.click(await screen.findByRole("button", { name: "설정" }));
    expect(screen.getByText("종료는 시작과 같거나 늦어야 해요")).toBeInTheDocument();
    expect(screen.getByText("0~23 사이 정수")).toBeInTheDocument();
    expect(screen.getByLabelText("종료 시각")).toHaveAttribute("max", "23");
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

describe("어댑터", () => {
  it("linksOf 는 부스 데이터에서 주소를 만든다", () => {
    expect(linksOf(detail())).toEqual({
      manage: `${window.location.origin}/b/tok`,
      reserve: `${window.location.origin}/nareum/reserve/7`,
    });
  });

  it("partnerBoothSource 는 부스·명단·통계·기관을 하나로 합치고 기관은 한 번만 받는다", async () => {
    const d = detail();
    vi.mocked(link.getPartnerBooth).mockResolvedValue({ booth: d.booth });
    vi.mocked(link.listReservationsPartnerBooth).mockResolvedValue({ reservations: d.reservations });
    vi.mocked(link.partnerStats).mockResolvedValue(d.stats);
    vi.mocked(link.getPartner).mockResolvedValue({
      partner: { id: 1, name: "청소년부" },
      event: { id: 1, name: "어린이날 행사" },
      org: d.org,
      booths: [],
    });
    vi.mocked(link.setStatusPartnerBooth).mockResolvedValue({ reservation: d.reservations[0] });
    const src = partnerBoothSource("ptok", "7");
    expect(await src.get()).toEqual(d);
    expect(link.getPartnerBooth).toHaveBeenCalledWith("ptok", "7");
    expect(link.listReservationsPartnerBooth).toHaveBeenCalledWith("ptok", "7");
    expect(link.partnerStats).toHaveBeenCalledWith("ptok", { booth_ids: [7], mode: "simple" });
    await src.get();
    expect(link.getPartner).toHaveBeenCalledTimes(1);
    await src.setStatus(1, "noshow");
    expect(link.setStatusPartnerBooth).toHaveBeenCalledWith("ptok", "7", 1, "noshow");
    expect(src.key).toEqual([...link.linkKeys.partnerBooth("ptok", "7")]);
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
