import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ApiError } from "../src/api/client";
import type { Booth, ExportData, PartnerPayload, Stats } from "../src/api/types";
import { routes } from "../src/routes";

vi.mock("../src/api/link", async (orig) => {
  const real = await orig<typeof import("../src/api/link")>();
  return {
    ...real,
    getPartner: vi.fn(),
    getPartnerBooth: vi.fn(),
    listReservationsPartnerBooth: vi.fn(),
    partnerStats: vi.fn(),
    partnerExport: vi.fn(),
  };
});
vi.mock("../src/lib/excel", async (orig) => {
  const real = await orig<typeof import("../src/lib/excel")>();
  return { ...real, buildRosterWorkbook: vi.fn(async () => new ArrayBuffer(8)) };
});
vi.mock("../src/lib/download", () => ({ downloadBlob: vi.fn() }));
import * as link from "../src/api/link";
import * as excel from "../src/lib/excel";
import * as download from "../src/lib/download";

const mk = (id: number, name: string, over: Partial<Booth> = {}): Booth => ({
  id,
  event_id: 1,
  event_name: "어린이날 행사",
  org_id: 1,
  partner_id: 3,
  partner_name: "청년부",
  name,
  mode: "fcfs",
  use_waitlist: false,
  total_limit: 10,
  start_hour: 10,
  end_hour: 14,
  slots_per_hour: 2,
  limit_per_slot: 5,
  is_active: true,
  manage_token: "x",
  count: 4,
  availability: { slots: [], is_closed: false },
  ...over,
});
const payload = (booths: Booth[]): PartnerPayload => ({
  partner: { id: 3, name: "청년부" },
  event: { id: 1, name: "어린이날 행사" },
  org: { name: "나름교회", slug: "nareum" },
  booths,
});
const stats: Stats = { rows: [{ age_group: "초등 저학년", male: 1, female: 2, total: 3 }], male: 1, female: 2, total: 3 };
const exported: ExportData = {
  booths: [{ booth_id: 12, event_name: "어린이날 행사", booth_name: "비누", rows: [] }],
};

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </QueryClientProvider>,
  );
}
const T = { timeout: 3000 };

beforeEach(() => {
  vi.mocked(link.partnerStats).mockResolvedValue(stats);
  vi.mocked(link.partnerExport).mockResolvedValue(exported);
});

describe("PartnerPage", () => {
  const booths = [mk(12, "비누 만들기"), mk(13, "팽이 돌리기", { is_active: false, count: 9 })];

  it("머리와 부스 목록 링크를 보여준다", async () => {
    vi.mocked(link.getPartner).mockResolvedValue(payload(booths));
    renderAt("/p/tok");
    expect(await screen.findByRole("heading", { name: "청년부" }, T)).toBeInTheDocument();
    expect(screen.getByText("어린이날 행사")).toBeInTheDocument();
    expect(screen.getByText("주최: 나름교회")).toBeInTheDocument();
    const a = screen.getByRole("link", { name: /비누 만들기/ });
    expect(a).toHaveAttribute("href", "/p/tok/booths/12");
    expect(screen.getByRole("link", { name: /팽이 돌리기/ })).toHaveAttribute("href", "/p/tok/booths/13");
    expect(within(a).getByText("운영 중")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /팽이 돌리기/ })).getByText("마감")).toBeInTheDocument();
  });

  it("처음엔 전체 부스·단순 합계로 실적을 받고, 엄격 탭이면 다시 받는다", async () => {
    const user = userEvent.setup();
    vi.mocked(link.getPartner).mockResolvedValue(payload(booths));
    renderAt("/p/tok");
    await waitFor(() => expect(link.partnerStats).toHaveBeenCalledWith("tok", { booth_ids: [12, 13], mode: "simple" }));
    await user.click(await screen.findByRole("tab", { name: /엄격/ }));
    await waitFor(() => expect(link.partnerStats).toHaveBeenCalledWith("tok", { booth_ids: [12, 13], mode: "strict" }));
  });

  it("부스 하나를 선택 해제하면 그 id 를 뺀다", async () => {
    const user = userEvent.setup();
    vi.mocked(link.getPartner).mockResolvedValue(payload(booths));
    renderAt("/p/tok");
    const group = await screen.findByRole("group", { name: "합계에 포함할 부스" }, T);
    await user.click(within(group).getByRole("checkbox", { name: "팽이 돌리기" }));
    await waitFor(() => expect(link.partnerStats).toHaveBeenLastCalledWith("tok", { booth_ids: [12], mode: "simple" }));
  });

  it("모두 해제하면 API 를 부르지 않고 안내와 함께 엑셀을 막는다", async () => {
    const user = userEvent.setup();
    vi.mocked(link.getPartner).mockResolvedValue(payload(booths));
    renderAt("/p/tok");
    await user.click(await screen.findByRole("button", { name: "전체 해제" }, T));
    expect(screen.getByText("부스를 하나 이상 골라 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /통합 엑셀/ })).toBeDisabled();
    const calls = vi.mocked(link.partnerStats).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "전체 선택" }));
    await waitFor(() => expect(vi.mocked(link.partnerStats).mock.calls.length).toBeGreaterThan(calls));
    expect(screen.queryByText("부스를 하나 이상 골라 주세요.")).not.toBeInTheDocument();
  });

  it("통합 엑셀은 partnerExport 데이터와 현재 합계로 워크북을 만든다", async () => {
    const user = userEvent.setup();
    vi.mocked(link.getPartner).mockResolvedValue(payload(booths));
    renderAt("/p/tok");
    const btn = await screen.findByRole("button", { name: /통합 엑셀/ }, T);
    await waitFor(() => expect(btn).toBeEnabled());
    await user.click(btn);
    await waitFor(() => expect(excel.buildRosterWorkbook).toHaveBeenCalled());
    expect(link.partnerExport).toHaveBeenCalledWith("tok", { booth_ids: [12, 13] });
    expect(excel.buildRosterWorkbook).toHaveBeenCalledWith(exported, stats, { mode: "simple" });
    expect(download.downloadBlob).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      "[어린이날 행사]_청년부_실적.xlsx",
      expect.stringContaining("spreadsheetml"),
    );
  });

  it("부스가 0개면 안내 문구를 보여준다", async () => {
    vi.mocked(link.getPartner).mockResolvedValue(payload([]));
    renderAt("/p/tok");
    expect(await screen.findByText("아직 배정된 부스가 없어요.", {}, T)).toBeInTheDocument();
    expect(link.partnerStats).not.toHaveBeenCalled();
  });

  it("폐기된 토큰은 만료 문구를 보여준다", async () => {
    vi.mocked(link.getPartner).mockRejectedValue(new ApiError(404, "not_found"));
    renderAt("/p/gone");
    expect(await screen.findByText("이 링크는 더 이상 쓸 수 없어요.", {}, T)).toBeInTheDocument();
  });
});

describe("PartnerBoothPage", () => {
  it("뒤로 링크와 부스 관리 화면을 보여준다", async () => {
    vi.mocked(link.getPartner).mockResolvedValue(payload([mk(12, "비누 만들기")]));
    vi.mocked(link.getPartnerBooth).mockResolvedValue({ booth: mk(12, "비누 만들기") });
    vi.mocked(link.listReservationsPartnerBooth).mockResolvedValue({ reservations: [] });
    renderAt("/p/tok/booths/12");
    expect(await screen.findByRole("heading", { name: "비누 만들기" }, T)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /운영 단체로/ })).toHaveAttribute("href", "/p/tok");
  });

  it("폐기된 토큰은 만료 문구를 보여준다", async () => {
    vi.mocked(link.getPartner).mockRejectedValue(new ApiError(404, "not_found"));
    vi.mocked(link.getPartnerBooth).mockRejectedValue(new ApiError(404, "not_found"));
    vi.mocked(link.listReservationsPartnerBooth).mockRejectedValue(new ApiError(404, "not_found"));
    renderAt("/p/gone/booths/12");
    expect(await screen.findByText("이 링크는 더 이상 쓸 수 없어요.", {}, T)).toBeInTheDocument();
  });
});

describe("StatsPanel", () => {
  const booths = [mk(12, "비누 만들기"), mk(13, "팽이 돌리기")];
  const data = payload(booths);

  it("합계 방식마다 설명 문구가 바뀐다", async () => {
    const user = userEvent.setup();
    vi.mocked(link.getPartner).mockResolvedValue(data);
    renderAt("/p/tok");
    expect(await screen.findByText("신청 건수를 그대로 더해요.", {}, T)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /엄격/ }));
    expect(screen.getByText("이름·성별·연령이 같으면 1명으로 세요.")).toBeInTheDocument();
  });

  it("부스 번호는 순서대로 두 자리", async () => {
    vi.mocked(link.getPartner).mockResolvedValue(data);
    renderAt("/p/tok");
    const a = await screen.findByRole("link", { name: /비누 만들기/ }, T);
    expect(within(a).getByText("01")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /팽이 돌리기/ })).getByText("02")).toBeInTheDocument();
  });

  it("지난 선택의 늦은 응답은 무시한다", async () => {
    const user = userEvent.setup();
    vi.mocked(link.getPartner).mockResolvedValue(data);
    let resolveOld!: (s: Stats) => void;
    vi.mocked(link.partnerStats)
      .mockImplementationOnce(() => new Promise<Stats>((r) => (resolveOld = r)))
      .mockResolvedValue({ rows: [], male: 0, female: 0, total: 77 });
    renderAt("/p/tok");
    const group = await screen.findByRole("group", { name: "합계에 포함할 부스" }, T);
    await waitFor(() => expect(link.partnerStats).toHaveBeenCalledTimes(1));
    await user.click(within(group).getByRole("checkbox", { name: "팽이 돌리기" }));
    expect(await screen.findByText("77")).toBeInTheDocument();
    resolveOld({ rows: [], male: 0, female: 0, total: 999 });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("999")).not.toBeInTheDocument();
    expect(screen.getByText("77")).toBeInTheDocument();
  });

  it("실적 조회가 실패하면 안내와 다시 시도를 보여준다", async () => {
    const user = userEvent.setup();
    vi.mocked(link.getPartner).mockResolvedValue(data);
    vi.mocked(link.partnerStats).mockRejectedValueOnce(new ApiError(500, "server_error"));
    renderAt("/p/tok");
    await user.click(await screen.findByRole("button", { name: "다시 시도" }, T));
    expect(await screen.findByText("3", { selector: "dd" })).toBeInTheDocument();
    expect(link.partnerStats).toHaveBeenCalledTimes(2);
  });

  it("엑셀 실패 안내를 보여준다", async () => {
    const user = userEvent.setup();
    vi.mocked(link.getPartner).mockResolvedValue(data);
    vi.mocked(link.partnerExport).mockRejectedValueOnce(new Error("boom"));
    renderAt("/p/tok");
    const btn = await screen.findByRole("button", { name: /통합 엑셀/ }, T);
    await waitFor(() => expect(btn).toBeEnabled());
    await user.click(btn);
    expect(await screen.findByText("엑셀 파일을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.")).toBeInTheDocument();
  });

  it("현재 선택의 실적이 올 때까지 엑셀은 막혀 있다", async () => {
    vi.mocked(link.getPartner).mockResolvedValue(data);
    let resolve!: (s: Stats) => void;
    vi.mocked(link.partnerStats).mockImplementationOnce(() => new Promise<Stats>((r) => (resolve = r)));
    renderAt("/p/tok");
    const btn = await screen.findByRole("button", { name: /통합 엑셀/ }, T);
    expect(btn).toBeDisabled();
    resolve(stats);
    await waitFor(() => expect(btn).toBeEnabled());
  });
});
