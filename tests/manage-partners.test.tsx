import { useState } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "../src/api/client";
import { adminKeys } from "../src/api/admin";
import type { AdminEvent, Booth, Partner, SessionOrg } from "../src/api/types";

vi.mock("../src/api/admin", async (orig) => ({
  ...(await orig<typeof import("../src/api/admin")>()),
  getEvent: vi.fn(),
  listPartners: vi.fn(),
  createPartner: vi.fn(),
  updatePartner: vi.fn(),
  deletePartner: vi.fn(),
  rotatePartnerToken: vi.fn(),
  listLinkTargets: vi.fn(),
  listBooths: vi.fn(),
  updateBooth: vi.fn(),
  adminStats: vi.fn(),
  adminExport: vi.fn(),
}));
vi.mock("../src/lib/qr", () => ({ renderQrPng: vi.fn(async () => new Blob(["png"])) }));
vi.mock("../src/lib/qrZip", async (orig) => ({
  ...(await orig<typeof import("../src/lib/qrZip")>()),
  buildQrZip: vi.fn(),
}));
vi.mock("../src/lib/excel", async (orig) => ({
  ...(await orig<typeof import("../src/lib/excel")>()),
  buildLinksWorkbook: vi.fn(async () => new ArrayBuffer(1)),
}));
vi.mock("../src/lib/download", () => ({ downloadBlob: vi.fn() }));
vi.mock("../src/booth/StatsPanel", () => ({
  // 실제 패널처럼 처음 받은 부스로 선택을 정한다.
  StatsPanel: function StatsPanel(p: { booths: Booth[]; fileName: () => string }) {
    const [picked] = useState(() => p.booths.map((b) => b.id).join(","));
    return (
      <div data-testid="stats" data-picked={picked}>
        {p.booths.length}:{p.fileName()}
      </div>
    );
  },
}));
import * as admin from "../src/api/admin";
import { downloadBlob } from "../src/lib/download";
import { renderQrPng } from "../src/lib/qr";
import { buildQrZip } from "../src/lib/qrZip";
import PartnersTab from "../src/manage/event/PartnersTab";
import StatsTab from "../src/manage/event/StatsTab";
import LinksTab from "../src/manage/event/LinksTab";

const ORG: SessionOrg = { id: 1, name: "나름교회", slug: "nareum", logo_url: null };
const EVENT: AdminEvent = {
  id: 10,
  name: "가을 축제",
  created_at: 1_700_000_000,
  booth_count: 2,
  partner_count: 1,
  logo_url: null,
  notice: null, age_label: "연령대", age_options: ["0~8세", "9~13세"],
};
const PARTNER: Partner = { id: 5, name: "청년부", linked_org: { id: 2, name: "사랑교회" }, access_token: "ptok", booth_count: 2 };
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
    manage_token: `mt${id}`,
    count: 0,
    availability: { slots: [], is_closed: false },
    ...over,
  };
}

function renderTab(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(queryClient, "invalidateQueries");
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { spy, queryClient };
}
const keysOf = (spy: ReturnType<typeof renderTab>["spy"]) => spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(renderQrPng).mockResolvedValue(new Blob(["png"]));
  vi.mocked(admin.listPartners).mockResolvedValue([PARTNER]);
  vi.mocked(admin.listLinkTargets).mockResolvedValue([
    { id: 2, name: "사랑교회" },
    { id: 3, name: "믿음교회" },
  ]);
  vi.mocked(admin.listBooths).mockResolvedValue([booth(1, { partner_id: 5, partner_name: "청년부" }), booth(2)]);
  vi.mocked(admin.getEvent).mockResolvedValue({ event: EVENT, org: ORG });
});

describe("운영 단체 목록 검색·스크롤", () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ ...PARTNER, id: 100 + i, name: `단체${i + 1}`, linked_org: null }));

  it("9개까지는 검색칸도 스크롤도 없다", async () => {
    vi.mocked(admin.listPartners).mockResolvedValue(many.slice(0, 9));
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    const region = await screen.findByRole("region", { name: "운영 단체 목록" });
    expect(region).not.toHaveClass("overflow-y-auto");
    expect(screen.queryByLabelText("단체 검색")).not.toBeInTheDocument();
  });

  it("10개부터 목록을 스크롤로 담고 이름·연결 기관으로 검색한다", async () => {
    vi.mocked(admin.listPartners).mockResolvedValue([...many, { ...PARTNER, id: 200, name: "청년부" }]);
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    const region = await screen.findByRole("region", { name: "운영 단체 목록" });
    expect(region).toHaveClass("overflow-y-auto");
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("단체 검색"), "사랑");
    expect(within(region).getByText("청년부")).toBeInTheDocument();
    expect(within(region).queryByText("단체1")).not.toBeInTheDocument();
    await u.clear(screen.getByLabelText("단체 검색"));
    await u.type(screen.getByLabelText("단체 검색"), "없는 이름");
    expect(await screen.findByText("찾는 단체가 없어요")).toBeInTheDocument();
    expect(screen.getByLabelText("단체 검색")).toBeInTheDocument();
  });
});

describe("재조회 실패", () => {
  const fail = () => vi.mocked(admin.listBooths).mockRejectedValue(new ApiError(500, "server"));

  it("운영 단체 탭은 표를 내리지 않고 경고를 보인다", async () => {
    const { queryClient } = renderTab(<PartnersTab event={EVENT} org={ORG} />);
    const table = await screen.findByRole("region", { name: "운영 단체 목록" });
    fail();
    await act(() => queryClient.invalidateQueries({ queryKey: adminKeys.booths(10) }));
    expect(await screen.findByText(/최신 정보를 받지 못했어요/)).toBeInTheDocument();
    expect(table).toBeInTheDocument();
  });

  it("실적 탭은 패널을 내리지 않고 경고를 보인다", async () => {
    const { queryClient } = renderTab(<StatsTab event={EVENT} org={ORG} />);
    const panel = await screen.findByTestId("stats");
    fail();
    await act(() => queryClient.invalidateQueries({ queryKey: adminKeys.booths(10) }));
    expect(await screen.findByText(/최신 정보를 받지 못했어요/)).toBeInTheDocument();
    expect(panel).toBeInTheDocument();
  });

  it("링크 탭은 버튼을 내리지 않고 경고를 보인다", async () => {
    const { queryClient } = renderTab(<LinksTab event={EVENT} org={ORG} />);
    const zip = await screen.findByRole("button", { name: /QR 묶음/ });
    fail();
    await act(() => queryClient.invalidateQueries({ queryKey: adminKeys.booths(10) }));
    expect(await screen.findByText(/최신 정보를 받지 못했어요/)).toBeInTheDocument();
    expect(zip).toBeInTheDocument();
  });
});

describe("운영 단체 탭", () => {
  it("연결 기관 목록은 소유 기관 기준이고, 만들기는 이름과 연결 기관을 보낸다", async () => {
    vi.mocked(admin.createPartner).mockResolvedValue({ ...PARTNER, id: 6, name: "중고등부" });
    const { spy } = renderTab(<PartnersTab event={EVENT} org={ORG} />);
    await screen.findByText(`${window.location.origin}/p/ptok`);
    expect(admin.listLinkTargets).toHaveBeenCalledWith(1);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("단체 이름"), " 중고등부 ");
    await user.selectOptions(screen.getByLabelText("연결 기관"), "믿음교회");
    await user.click(screen.getByRole("button", { name: "단체 추가" }));
    await waitFor(() => expect(admin.createPartner).toHaveBeenCalledWith(10, { name: "중고등부", linked_org_id: 3 }));
    await waitFor(() =>
      expect(keysOf(spy)).toEqual(
        expect.arrayContaining([
          JSON.stringify(["admin", "partners", 10]),
          JSON.stringify(["admin", "event", 10]),
          JSON.stringify(["admin", "booths", 10]),
        ]),
      ),
    );
  });

  it("연결 안 함이면 linked_org_id 는 null", async () => {
    vi.mocked(admin.createPartner).mockResolvedValue(PARTNER);
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    await screen.findByText(`${window.location.origin}/p/ptok`);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("단체 이름"), "새 단체");
    await user.click(screen.getByRole("button", { name: "단체 추가" }));
    await waitFor(() => expect(admin.createPartner).toHaveBeenCalledWith(10, { name: "새 단체", linked_org_id: null }));
  });

  it("이름·연결을 바꾸고, 연결 해제는 null", async () => {
    vi.mocked(admin.updatePartner).mockResolvedValue(PARTNER);
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    await screen.findByText(`${window.location.origin}/p/ptok`);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "청년부 수정" }));
    const dialog = screen.getByRole("dialog");
    const name = within(dialog).getByLabelText("단체 이름");
    await user.clear(name);
    await user.type(name, "청년 1부");
    await user.selectOptions(within(dialog).getByLabelText("연결 기관"), "연결 안 함");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(admin.updatePartner).toHaveBeenCalledWith(5, { name: "청년 1부", linked_org_id: null }));
  });

  it("이름만 바꾸면 linked_org_id 를 보내지 않는다(비활성 연결 기관)", async () => {
    vi.mocked(admin.updatePartner).mockResolvedValue(PARTNER);
    vi.mocked(admin.listLinkTargets).mockResolvedValue([{ id: 3, name: "믿음교회" }]); // 사랑교회는 비활성이라 목록에 없다
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    await screen.findByText(`${window.location.origin}/p/ptok`);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "청년부 수정" }));
    const dialog = screen.getByRole("dialog");
    const name = within(dialog).getByLabelText("단체 이름");
    await user.clear(name);
    await user.type(name, "청년 1부");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(admin.updatePartner).toHaveBeenCalledWith(5, { name: "청년 1부" }));
  });

  it("연결 기관을 바꾸면 새 id 를 보낸다", async () => {
    vi.mocked(admin.updatePartner).mockResolvedValue(PARTNER);
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    await screen.findByText(`${window.location.origin}/p/ptok`);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "청년부 수정" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("연결 기관"), "믿음교회");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(admin.updatePartner).toHaveBeenCalledWith(5, { name: "청년부", linked_org_id: 3 }));
  });

  it("표에 좁은 화면 안내가 있다", async () => {
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    await screen.findByRole("region", { name: "운영 단체 목록" });
    expect(screen.getByText("옆으로 밀면 더 있어요")).toBeInTheDocument();
  });

  it("실적 링크와 QR 내려받기", async () => {
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    await screen.findByText(`${window.location.origin}/p/ptok`);
    await userEvent.setup().click(screen.getByRole("button", { name: "청년부 QR 내려받기" }));
    await waitFor(() =>
      expect(renderQrPng).toHaveBeenCalledWith(`${window.location.origin}/p/ptok`, "청년부", "운영 단체 실적"),
    );
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
  });

  it("재발급은 확인 뒤에만 호출한다", async () => {
    vi.mocked(admin.rotatePartnerToken).mockResolvedValue({ access_token: "new" });
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    await screen.findByText(`${window.location.origin}/p/ptok`);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "청년부 링크 재발급" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("이전 링크");
    expect(admin.rotatePartnerToken).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "재발급" }));
    await waitFor(() => expect(admin.rotatePartnerToken).toHaveBeenCalledWith(5));
  });

  it("재발급하면 화면의 링크가 새 링크로 바뀐다", async () => {
    vi.mocked(admin.rotatePartnerToken).mockResolvedValue({ access_token: "new" });
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    const old = `${window.location.origin}/p/ptok`;
    await screen.findByText(old);
    vi.mocked(admin.listPartners).mockResolvedValue([{ ...PARTNER, access_token: "new" }]);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "청년부 링크 재발급" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "재발급" }));
    expect(await screen.findByText(`${window.location.origin}/p/new`)).toBeInTheDocument();
    expect(screen.queryByText(old)).toBeNull();
  });

  it("삭제하면 화면에서 그 단체의 링크가 사라진다", async () => {
    vi.mocked(admin.deletePartner).mockResolvedValue(undefined);
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    const old = `${window.location.origin}/p/ptok`;
    await screen.findByText(old);
    vi.mocked(admin.listPartners).mockResolvedValue([]);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "청년부 삭제" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }));
    expect(await screen.findByText("아직 운영 단체가 없어요")).toBeInTheDocument();
    expect(screen.queryByText(old)).toBeNull();
  });

  it("삭제 대화상자는 배정된 부스 수를 알린다", async () => {
    vi.mocked(admin.deletePartner).mockResolvedValue(undefined);
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    await screen.findByText(`${window.location.origin}/p/ptok`);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "청년부 삭제" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("배정된 부스 2개는 미배정이 돼요");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(admin.deletePartner).toHaveBeenCalledWith(5));
  });

  it("부스 배정: 단체명이면 partner_id, 미배정이면 null", async () => {
    vi.mocked(admin.updateBooth).mockResolvedValue(booth(2));
    const { spy } = renderTab(<PartnersTab event={EVENT} org={ORG} />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText("부스2 운영 단체"), "청년부");
    await waitFor(() => expect(admin.updateBooth).toHaveBeenCalledWith(2, { partner_id: 5 }));
    await user.selectOptions(screen.getByLabelText("부스1 운영 단체"), "미배정");
    await waitFor(() => expect(admin.updateBooth).toHaveBeenCalledWith(1, { partner_id: null }));
    await waitFor(() =>
      expect(keysOf(spy)).toEqual(
        expect.arrayContaining([JSON.stringify(["admin", "booths", 10]), JSON.stringify(["admin", "partners", 10])]),
      ),
    );
  });

  it("배정이 실패하면 오류를 알리고 이전 값을 보인다", async () => {
    vi.mocked(admin.updateBooth).mockRejectedValue(new ApiError(500, "server_error"));
    renderTab(<PartnersTab event={EVENT} org={ORG} />);
    const select = (await screen.findByLabelText("부스2 운영 단체")) as HTMLSelectElement;
    await userEvent.setup().selectOptions(select, "청년부");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(select.value).toBe("");
  });
});

describe("실적 탭", () => {
  it("부스가 없으면 빈 상태", async () => {
    vi.mocked(admin.listBooths).mockResolvedValue([]);
    renderTab(<StatsTab event={EVENT} org={ORG} />);
    expect(await screen.findByText("아직 부스가 없어요")).toBeInTheDocument();
    expect(screen.queryByTestId("stats")).toBeNull();
  });
  it("StatsPanel 에 부스와 파일명을 넘긴다", async () => {
    renderTab(<StatsTab event={EVENT} org={ORG} />);
    expect(await screen.findByTestId("stats")).toHaveTextContent("2:[가을 축제]_실적.xlsx");
  });
  it("부스가 늘면 패널을 새로 시작해 새 부스도 합계에 넣는다", async () => {
    const { queryClient } = renderTab(<StatsTab event={EVENT} org={ORG} />);
    expect(await screen.findByTestId("stats")).toHaveAttribute("data-picked", "1,2");
    vi.mocked(admin.listBooths).mockResolvedValue([booth(1), booth(2), booth(3)]);
    await act(() => queryClient.invalidateQueries({ queryKey: adminKeys.booths(10) }));
    await waitFor(() => expect(screen.getByTestId("stats")).toHaveAttribute("data-picked", "1,2,3"));
  });
});

describe("링크·QR 탭", () => {
  async function ready() {
    const zip = await screen.findByRole("button", { name: /QR 묶음/ });
    await waitFor(() => expect(zip).toBeEnabled());
    return zip;
  }

  it("부스가 없으면 두 버튼이 잠기고 안내가 나온다", async () => {
    vi.mocked(admin.listBooths).mockResolvedValue([]);
    renderTab(<LinksTab event={EVENT} org={ORG} />);
    expect(await screen.findByText(/부스를 먼저 추가/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /QR 묶음/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /링크 엑셀/ })).toBeDisabled();
  });

  it("QR 묶음: 소유 기관 slug 주소와 파일명", async () => {
    vi.mocked(buildQrZip).mockResolvedValue(new Blob(["zip"]));
    vi.mocked(admin.getEvent).mockResolvedValue({ event: EVENT, org: { ...ORG, slug: "owner-slug" } });
    renderTab(<LinksTab event={EVENT} org={{ ...ORG, slug: "owner-slug" }} />);
    await userEvent.setup().click(await ready());
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    const entries = vi.mocked(buildQrZip).mock.calls[0][0];
    const o = window.location.origin;
    const find = (prefix: string, sub: string) => entries.find((e) => e.fileName.startsWith(prefix) && e.subtitle === sub)?.value;
    expect(find("01_", "방문객 신청")).toBe(`${o}/owner-slug/reserve/1`);
    expect(find("01_", "부스 관리")).toBe(`${o}/b/mt1`);
    expect(entries.find((e) => e.subtitle === "운영 단체 실적")?.value).toBe(`${o}/p/ptok`);
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe("[가을 축제]_QR.zip");
  });

  it("진행 표시는 aria-live 로 알린다", async () => {
    let resume: () => void = () => {};
    vi.mocked(buildQrZip).mockImplementation(async (_e, onProgress) => {
      onProgress?.(3, 10);
      await new Promise<void>((r) => (resume = r));
      return new Blob(["zip"]);
    });
    renderTab(<LinksTab event={EVENT} org={ORG} />);
    await userEvent.setup().click(await ready());
    const status = await screen.findByText("QR 만드는 중 3/10");
    expect(status.closest("[aria-live]")).not.toBeNull();
    resume();
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
  });

  it("실패하면 오류를 보이고 버튼이 돌아온다", async () => {
    vi.mocked(buildQrZip).mockRejectedValue(new Error("boom"));
    renderTab(<LinksTab event={EVENT} org={ORG} />);
    await userEvent.setup().click(await ready());
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /QR 묶음/ })).toBeEnabled());
  });

  it("내려받기 직전에 토큰·슬러그·행사 이름이 바뀌면 새 값이 파일에 들어간다", async () => {
    vi.mocked(buildQrZip).mockResolvedValue(new Blob(["zip"]));
    renderTab(<LinksTab event={EVENT} org={ORG} />);
    const zip = await ready();
    vi.mocked(admin.listBooths).mockResolvedValue([booth(1, { manage_token: "fresh-b" })]);
    vi.mocked(admin.listPartners).mockResolvedValue([{ ...PARTNER, access_token: "fresh-p" }]);
    vi.mocked(admin.getEvent).mockResolvedValue({ event: { ...EVENT, name: "겨울 축제" }, org: { ...ORG, slug: "fresh-slug" } });
    await userEvent.setup().click(zip);
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    const values = vi.mocked(buildQrZip).mock.calls[0][0].map((e) => e.value);
    const o = window.location.origin;
    expect(values).toEqual(expect.arrayContaining([`${o}/b/fresh-b`, `${o}/fresh-slug/reserve/1`, `${o}/p/fresh-p`]));
    expect(values).not.toContain(`${o}/b/mt1`);
    expect(values).not.toContain(`${o}/p/ptok`);
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe("[겨울 축제]_QR.zip");
  });

  it.each([
    ["부스", () => vi.mocked(admin.listBooths)],
    ["운영 단체", () => vi.mocked(admin.listPartners)],
    ["행사", () => vi.mocked(admin.getEvent)],
  ])("%s 재조회가 실패하면 내려받지 않고 오류를 보인다", async (_n, mock) => {
    renderTab(<LinksTab event={EVENT} org={ORG} />);
    const zip = await ready();
    mock().mockRejectedValue(new ApiError(500, "server"));
    await userEvent.setup().click(zip);
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByRole("button", { name: /QR 묶음/ })).toBeEnabled());
    expect(buildQrZip).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("링크 엑셀: 파일명", async () => {
    renderTab(<LinksTab event={EVENT} org={ORG} />);
    await ready();
    await userEvent.setup().click(screen.getByRole("button", { name: /링크 엑셀/ }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe("[가을 축제]_링크.xlsx");
  });
});
