import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ApiError } from "../src/api/client";
import type { PublicBoothPage, PublicOrgPage } from "../src/api/types";

vi.mock("../src/api/public", async (orig) => {
  const real = await orig<typeof import("../src/api/public")>();
  return {
    ...real,
    getOrgPage: vi.fn(),
    getBoothPage: vi.fn(),
    reserve: vi.fn(),
    lookup: vi.fn(),
    cancel: vi.fn(),
    getBoothHome: vi.fn(),
  };
});

import * as pub from "../src/api/public";
import { routes } from "../src/routes";
import { loadTicket, saveTicket } from "../src/lib/ticketStore";

const m = vi.mocked(pub);

const org = { name: "나름교회", slug: "nareum", logo_url: null };
const orgPage: PublicOrgPage = {
  org,
  events: [
    {
      id: 1,
      name: "어린이날 행사",
      logo_url: null,
      notice: null,
      booths: [
        { id: 12, name: "비누 만들기", mode: "time", is_closed: false },
        { id: 13, name: "페이스 페인팅", mode: "fcfs", is_closed: true },
      ],
    },
  ],
};
const boothPage = (over: Partial<PublicBoothPage> = {}): PublicBoothPage => ({
  org,
  event: { id: 1, name: "어린이날 행사", logo_url: null, notice: "비가 오면 실내에서 해요." },
  booth: { id: 12, name: "비누 만들기", mode: "time", use_waitlist: false, is_active: true },
  availability: {
    slots: [
      { label: "11시 A타임", remaining: 3, full: false },
      { label: "11시 B타임", remaining: 0, full: true },
    ],
    is_closed: false,
  },
  ...over,
});

function renderAt(path: string | { pathname: string; state: unknown }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

describe("OrgPage", () => {
  it("마감 부스는 링크가 아니고 마감 도장, 열린 부스는 신청 링크", async () => {
    m.getOrgPage.mockResolvedValue(orgPage);
    renderAt("/nareum");
    const open = await screen.findByRole("link", { name: /비누 만들기/ });
    expect(open).toHaveAttribute("href", "/nareum/reserve/12");
    expect(screen.queryByRole("link", { name: /페이스 페인팅/ })).toBeNull();
    expect(screen.getByText("마감")).toBeInTheDocument();
    expect(screen.getByText(/© \d{4} 나름교회/)).toBeInTheDocument();
  });

  it("404 이면 찾을 수 없어요", async () => {
    m.getOrgPage.mockRejectedValue(new ApiError(404, "not_found"));
    renderAt("/nope");
    expect(await screen.findByText(/찾을 수 없어요/)).toBeInTheDocument();
  });
});

describe("ReservePage", () => {
  async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, code = "12-34") {
    await user.click(await screen.findByRole("radio", { name: /11시 A타임/ }));
    await user.click(screen.getByRole("radio", { name: "남" }));
    await user.selectOptions(screen.getByLabelText("연령대"), "9~13세");
    await user.type(screen.getByLabelText("참가자 이름"), " 홍길동 ");
    await user.type(screen.getByLabelText("식별번호"), code);
    await user.click(screen.getByRole("checkbox", { name: "위 체험부스를 신청합니다" }));
    await user.click(screen.getByRole("button", { name: "신청하기" }));
  }

  it("성공하면 정규화된 값으로 신청하고 보관한 뒤 확인 화면으로 간다", async () => {
    const user = userEvent.setup();
    m.getBoothPage.mockResolvedValue(boothPage());
    m.reserve.mockResolvedValue({ id: 1, slot: "11시 A타임", status: "normal" });
    m.lookup.mockResolvedValue({ name: "홍길동", slot: "11시 A타임", status: "normal", booth_name: "비누 만들기" });
    const router = renderAt("/nareum/reserve/12");
    await fillAndSubmit(user);
    await waitFor(() =>
      expect(m.reserve).toHaveBeenCalledWith("12", {
        name: "홍길동",
        code: "1234",
        gender: "남",
        age_group: "9~13세",
        slot: "11시 A타임",
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/nareum/check/12"));
    expect(loadTicket(12)).toMatchObject({ name: "홍길동", code: "1234", slug: "nareum" });
    expect(await screen.findByText("입장 가능")).toBeInTheDocument();
  });

  it("409 full 이면 문구를 보이고 남은 자리를 다시 받아온다", async () => {
    const user = userEvent.setup();
    m.getBoothPage.mockResolvedValue(boothPage());
    m.reserve.mockRejectedValue(new ApiError(409, "full"));
    renderAt("/nareum/reserve/12");
    await fillAndSubmit(user);
    expect(await screen.findByText(/이 시간은 마감됐어요/)).toBeInTheDocument();
    await waitFor(() => expect(m.getBoothPage).toHaveBeenCalledTimes(2));
  });

  it("전각 숫자는 제출을 막고 코드 필드에 오류를 보인다", async () => {
    const user = userEvent.setup();
    m.getBoothPage.mockResolvedValue(boothPage());
    renderAt("/nareum/reserve/12");
    await fillAndSubmit(user, "１２３４");
    expect(await screen.findByText(/일반 숫자/)).toBeInTheDocument();
    expect(m.reserve).not.toHaveBeenCalled();
  });

  it("네트워크 실패는 문구와 다시 시도를 보인다", async () => {
    const user = userEvent.setup();
    m.getBoothPage.mockResolvedValue(boothPage());
    m.reserve.mockRejectedValue(new ApiError(0, "network"));
    renderAt("/nareum/reserve/12");
    await fillAndSubmit(user);
    expect(await screen.findByText(/연결이 불안정해요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("마감된 부스는 폼 대신 마감 입장권을 보인다", async () => {
    m.getBoothPage.mockResolvedValue(boothPage({ availability: { slots: [], is_closed: true } }));
    renderAt("/nareum/reserve/12");
    expect(await screen.findByText("마감")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "신청하기" })).toBeNull();
  });

  it("409 duplicate 는 내 신청 확인 링크를 보인다", async () => {
    const user = userEvent.setup();
    m.getBoothPage.mockResolvedValue(boothPage());
    m.reserve.mockRejectedValue(new ApiError(409, "duplicate"));
    renderAt("/nareum/reserve/12");
    await fillAndSubmit(user);
    expect(await screen.findByText(/이미 신청했어요/)).toBeInTheDocument();
    const alert = screen.getAllByRole("alert").find((el) => el.textContent?.includes("이미 신청했어요"))!;
    expect(within(alert).getByRole("link", { name: "내 신청 확인" })).toHaveAttribute("href", "/nareum/check/12");
  });

  it("422 fields 를 필드별로 보이고 첫 오류 칸에 포커스한다", async () => {
    const user = userEvent.setup();
    m.getBoothPage.mockResolvedValue(boothPage());
    m.reserve.mockRejectedValue(new ApiError(422, "invalid", { name: "이름이 올바르지 않아요.", code: "번호가 올바르지 않아요." }));
    renderAt("/nareum/reserve/12");
    await fillAndSubmit(user);
    expect(await screen.findByText("이름이 올바르지 않아요.")).toBeInTheDocument();
    expect(screen.getByText("번호가 올바르지 않아요.")).toBeInTheDocument();
    expect(screen.getByLabelText("참가자 이름")).toHaveFocus();
  });

  it("비어 있게 제출하면 첫 오류(시간 선택)에 포커스하고 요약을 한 번 알린다", async () => {
    const user = userEvent.setup();
    m.getBoothPage.mockResolvedValue(boothPage());
    renderAt("/nareum/reserve/12");
    await user.click(await screen.findByRole("button", { name: "신청하기" }));
    expect(screen.getByRole("radio", { name: /11시 A타임/ })).toHaveFocus();
    expect(screen.getByRole("radiogroup", { name: "시간 선택" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/입력 내용을 확인해 주세요 \(\d곳\)/)).toBeInTheDocument();
    expect(m.reserve).not.toHaveBeenCalled();
  });

  it("선착순 부스는 slot 없이 신청한다", async () => {
    const user = userEvent.setup();
    m.getBoothPage.mockResolvedValue(
      boothPage({
        booth: { id: 12, name: "페이스 페인팅", mode: "fcfs", use_waitlist: false, is_active: true },
        availability: { remaining: 5, full: false, is_closed: false },
      }),
    );
    m.reserve.mockResolvedValue({ id: 1, slot: "선착순", status: "normal" });
    m.lookup.mockResolvedValue({ name: "홍길동", slot: "선착순", status: "normal", booth_name: "페이스 페인팅" });
    renderAt("/nareum/reserve/12");
    await user.click(await screen.findByRole("radio", { name: "남" }));
    await user.selectOptions(screen.getByLabelText("연령대"), "9~13세");
    await user.type(screen.getByLabelText("참가자 이름"), "홍길동");
    await user.type(screen.getByLabelText("식별번호"), "1234");
    await user.click(screen.getByRole("checkbox", { name: "위 체험부스를 신청합니다" }));
    await user.click(screen.getByRole("button", { name: "신청하기" }));
    await waitFor(() => expect(m.reserve).toHaveBeenCalled());
    expect(m.reserve.mock.calls[0][1]).toEqual({ name: "홍길동", code: "1234", gender: "남", age_group: "9~13세" });
    expect(await screen.findByText("선착순 입장")).toBeInTheDocument();
  });

  it("정원이 찬 대기 접수 선착순 부스는 대기자로 접수된다고 먼저 알린다", async () => {
    m.getBoothPage.mockResolvedValue(
      boothPage({
        booth: { id: 12, name: "룰렛", mode: "fcfs", use_waitlist: true, is_active: true },
        availability: { remaining: 0, full: true, is_closed: false },
      }),
    );
    renderAt("/nareum/reserve/12");
    expect(await screen.findByText(/정원이 다 찼어요/)).toBeInTheDocument();
    expect(screen.getByText(/대기자로 접수돼요/)).toBeInTheDocument();
  });

  it("정원이 남은 선착순 부스에는 대기 안내가 없다", async () => {
    m.getBoothPage.mockResolvedValue(
      boothPage({
        booth: { id: 12, name: "룰렛", mode: "fcfs", use_waitlist: true, is_active: true },
        availability: { remaining: 2, full: false, is_closed: false },
      }),
    );
    renderAt("/nareum/reserve/12");
    await screen.findByRole("button", { name: "신청하기" });
    expect(screen.queryByText(/대기자로 접수돼요/)).not.toBeInTheDocument();
  });

  it("입장권 본문(종이)은 포커스 색을 ink 로 되돌리는 on-paper 범위다", async () => {
    m.getBoothPage.mockResolvedValue(boothPage());
    renderAt("/nareum/reserve/12");
    const input = await screen.findByLabelText("참가자 이름");
    expect(input.closest(".on-paper")).not.toBeNull();
  });

  it("비활성 부스는 마감 입장권을 보인다", async () => {
    m.getBoothPage.mockResolvedValue(
      boothPage({ booth: { id: 12, name: "비누 만들기", mode: "time", use_waitlist: false, is_active: false } }),
    );
    renderAt("/nareum/reserve/12");
    expect(await screen.findByText("지금은 신청을 받지 않아요.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "신청하기" })).toBeNull();
  });

  it("409 full 뒤 선택한 시간이 마감됐으면 선택을 비운다", async () => {
    const user = userEvent.setup();
    const after = boothPage({
      availability: {
        slots: [
          { label: "11시 A타임", remaining: 0, full: true },
          { label: "11시 B타임", remaining: 0, full: true },
        ],
        is_closed: false,
      },
    });
    m.getBoothPage.mockResolvedValueOnce(boothPage()).mockResolvedValue(after);
    m.reserve.mockRejectedValue(new ApiError(409, "full"));
    renderAt("/nareum/reserve/12");
    await fillAndSubmit(user);
    await waitFor(() => expect(screen.getByRole("radio", { name: /11시 A타임/ })).toHaveAttribute("aria-checked", "false"));
  });

  it("서버 오류(5xx)에도 다시 시도를 보인다", async () => {
    const user = userEvent.setup();
    m.getBoothPage.mockResolvedValue(boothPage());
    m.reserve.mockRejectedValue(new ApiError(500, "http_500"));
    renderAt("/nareum/reserve/12");
    await fillAndSubmit(user);
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});

describe("CheckPage", () => {
  it("보관된 입장권으로 조회하고 취소하면 보관을 지운다", async () => {
    const user = userEvent.setup();
    saveTicket({ booth_id: 12, slug: "nareum", name: "홍길동", code: "1234" });
    m.getBoothPage.mockResolvedValue(boothPage());
    m.lookup.mockResolvedValue({ name: "홍길동", slot: "11시 A타임", status: "normal", booth_name: "비누 만들기" });
    m.cancel.mockResolvedValue(undefined);
    renderAt("/nareum/check/12");
    expect(await screen.findByText("입장 가능")).toBeInTheDocument();
    expect(m.lookup).toHaveBeenCalledWith("12", { name: "홍길동", code: "1234" });
    await user.click(screen.getByRole("button", { name: "신청 취소" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "신청 취소하기" }));
    await waitFor(() => expect(m.cancel).toHaveBeenCalledWith("12", { name: "홍길동", code: "1234" }));
    expect(await screen.findByText("신청을 취소했어요.")).toBeInTheDocument();
    expect(loadTicket(12)).toBeNull();
  });

  it("보관본이 없으면 입력 폼을 보이고 404 는 안내한다", async () => {
    const user = userEvent.setup();
    m.getBoothPage.mockResolvedValue(boothPage());
    m.lookup.mockRejectedValue(new ApiError(404, "not_found"));
    renderAt("/nareum/check/12");
    await user.type(await screen.findByLabelText("참가자 이름"), "홍길동");
    await user.type(screen.getByLabelText("식별번호"), "1234");
    await user.click(screen.getByRole("button", { name: "내 신청 확인" }));
    expect(await screen.findByText("신청 내역을 찾을 수 없어요.")).toBeInTheDocument();
  });

  it("이 기기에서 지우기는 보관과 이동 상태를 비우고 폼을 보인다", async () => {
    const user = userEvent.setup();
    saveTicket({ booth_id: 12, slug: "nareum", name: "홍길동", code: "1234" });
    m.getBoothPage.mockResolvedValue(boothPage());
    m.lookup.mockResolvedValue({ name: "홍길동", slot: "11시 A타임", status: "normal", booth_name: "비누 만들기" });
    const router = renderAt({
      pathname: "/nareum/check/12",
      state: { reserved: { name: "홍길동", code: "1234", status: "normal" } },
    });
    await user.click(await screen.findByRole("button", { name: "이 기기에서 지우기" }));
    expect(await screen.findByRole("button", { name: "내 신청 확인" })).toBeInTheDocument();
    expect(loadTicket(12)).toBeNull();
    expect(router.state.location.state).toBeNull();
  });

  it("조회가 404 면 보관과 이동 상태를 비운다", async () => {
    saveTicket({ booth_id: 12, slug: "nareum", name: "홍길동", code: "1234" });
    m.getBoothPage.mockResolvedValue(boothPage());
    m.lookup.mockRejectedValue(new ApiError(404, "not_found"));
    const router = renderAt({
      pathname: "/nareum/check/12",
      state: { reserved: { name: "홍길동", code: "1234", status: "normal" } },
    });
    expect(await screen.findByText("신청 내역을 찾을 수 없어요.")).toBeInTheDocument();
    await waitFor(() => expect(loadTicket(12)).toBeNull());
    await waitFor(() => expect(router.state.location.state).toBeNull());
  });

  it("대기 접수 직후에는 대기자 안내를 보인다", async () => {
    m.getBoothPage.mockResolvedValue(boothPage());
    m.lookup.mockResolvedValue({ name: "홍길동", slot: "11시 B타임", status: "waiting", booth_name: "비누 만들기" });
    renderAt({
      pathname: "/nareum/check/12",
      state: { reserved: { name: "홍길동", code: "1234", status: "waiting" } },
    });
    expect(await screen.findByText(/대기자로 접수됐어요/)).toBeInTheDocument();
    expect(screen.getByText("대기")).toBeInTheDocument();
  });
});

describe("LegacyRedirect / RootPage", () => {
  it("/reserve/12 는 /gmyouth/reserve/12 로 간다", async () => {
    m.getBoothHome.mockResolvedValue({ slug: "gmyouth" });
    m.getBoothPage.mockResolvedValue(boothPage());
    const router = renderAt("/reserve/12");
    await waitFor(() => expect(router.state.location.pathname).toBe("/gmyouth/reserve/12"));
  });

  it("실패하면 부스를 찾을 수 없어요", async () => {
    m.getBoothHome.mockRejectedValue(new ApiError(404, "not_found"));
    renderAt("/check/99");
    expect(await screen.findByText("부스를 찾을 수 없어요")).toBeInTheDocument();
  });

  it("404 가 아닌 실패는 다시 시도를 보이고 재시도하면 이동한다", async () => {
    const user = userEvent.setup();
    m.getBoothHome.mockRejectedValueOnce(new ApiError(0, "network")).mockResolvedValue({ slug: "gmyouth" });
    m.getBoothPage.mockResolvedValue(boothPage());
    const router = renderAt("/reserve/12");
    expect(await screen.findByText(/연결이 불안정해요/)).toBeInTheDocument();
    expect(screen.queryByText("부스를 찾을 수 없어요")).toBeNull();
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/gmyouth/reserve/12"));
  });

  it("/ 는 안내 문구", () => {
    renderAt("/");
    expect(screen.getByText(/QR 코드나 기관에서 받은 주소/)).toBeInTheDocument();
  });
});
