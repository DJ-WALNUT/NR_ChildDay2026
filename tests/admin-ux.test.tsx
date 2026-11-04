import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Booth, Reservation, Stats } from "../src/api/types";
import { RosterList } from "../src/booth/RosterList";
import { StatsPanel } from "../src/booth/StatsPanel";
import { StatsTable } from "../src/booth/StatsTable";

const stats: Stats = {
  rows: [
    { age_group: "0~8세", male: 3, female: 1, total: 4 },
    { age_group: "9~13세", male: 2, female: 2, total: 4 },
    { age_group: "14~16세", male: 0, female: 0, total: 0 },
  ],
  male: 5,
  female: 3,
  total: 8,
};

const numbers = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .slice(0, 4)
    .map((c) => c.textContent);

describe("StatsTable", () => {
  it("펼치지 않아도 연령대별 남·여·합계·비율이 표로 보이고 전체 합계가 마지막 줄이다", () => {
    render(<StatsTable stats={stats} />);
    const table = screen.getByRole("table", { name: "연령대·성별 통계" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(5);
    expect(within(rows[1]).getByRole("rowheader", { name: "0~8세" })).toBeInTheDocument();
    expect(numbers(rows[1])).toEqual(["3", "1", "4", "50%"]);
    expect(numbers(rows[3])).toEqual(["0", "0", "0", "0%"]);
    expect(within(rows[4]).getByRole("rowheader", { name: "합계" })).toBeInTheDocument();
    expect(numbers(rows[4])).toEqual(["5", "3", "8", "100%"]);
  });

  it("숫자 칸은 좁은 화면에서도 글자 단위로 줄바꿈되지 않는다", () => {
    render(<StatsTable stats={stats} />);
    expect(screen.getByRole("cell", { name: "100%" })).toHaveClass("whitespace-nowrap");
  });

  it("막대의 범례가 있고 신청이 없어도 0 으로 나누지 않는다", () => {
    render(<StatsTable stats={{ rows: [{ age_group: "0~8세", male: 0, female: 0, total: 0 }], male: 0, female: 0, total: 0 }} />);
    expect(screen.getByText("남", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByText("여", { selector: "li" })).toBeInTheDocument();
    expect(screen.getAllByText("0%")).toHaveLength(2);
  });
});

const res = (id: number): Reservation => ({
  id,
  booth_id: 1,
  name: `참가자${id}`,
  gender: "남",
  age_group: "0~8세",
  code: `${1000 + id}`,
  slot: "11시",
  status: "normal",
  created_at: 1,
});
const roster = (n: number) =>
  render(
    <RosterList
      reservations={Array.from({ length: n }, (_, i) => res(i + 1))}
      pending={new Set()}
      removed={null}
      fallbackFocus={{ current: null }}
      onStatus={() => {}}
      onDelete={() => {}}
    />,
  );

describe("RosterList 스크롤", () => {
  it("14명은 그대로 펼친다", () => {
    roster(14);
    expect(screen.queryByRole("region", { name: "명단 목록" })).not.toBeInTheDocument();
  });

  it("15명부터 키보드로도 닿는 스크롤 영역에 담는다", () => {
    roster(15);
    const area = screen.getByRole("region", { name: "명단 목록" });
    expect(area).toHaveClass("overflow-y-auto");
    expect(area).toHaveAttribute("tabindex", "0");
    expect(within(area).getByText(/참가자15/)).toBeInTheDocument();
  });

  it("검색으로 15명 아래가 되면 스크롤 영역을 풀고 검색칸은 영역 밖에 있다", async () => {
    roster(15);
    const search = screen.getByLabelText("이름·식별번호 검색");
    expect(screen.getByRole("region", { name: "명단 목록" })).not.toContainElement(search);
    await userEvent.setup().type(search, "참가자15");
    expect(screen.queryByRole("region", { name: "명단 목록" })).not.toBeInTheDocument();
  });
});

const booth = (id: number, name: string) => ({ id, name }) as Booth;
const booths = [booth(1, "페이스페인팅"), booth(2, "솜사탕"), booth(3, "비누 만들기")];
function panel() {
  const load = vi.fn(async () => stats);
  render(<StatsPanel booths={booths} loadStats={load} loadExport={vi.fn()} fileName={() => "x.xlsx"} />);
  return load;
}
const expectBefore = (a: Element, b: Element) =>
  expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

describe("StatsPanel 순서와 부스 선택", () => {
  it("합계 방식 토글, 실적 합계, 부스 선택 순서로 놓인다", async () => {
    panel();
    const mode = screen.getByRole("radiogroup", { name: "합계 방식" });
    const totals = await screen.findByLabelText("합계");
    const pick = screen.getByRole("button", { name: /합계에 포함할 부스/ });
    expectBefore(mode, totals);
    expectBefore(totals, pick);
  });

  it("합계 방식은 라디오로 바꾼다", async () => {
    const load = panel();
    await userEvent.setup().click(screen.getByRole("radio", { name: "엄격 합계" }));
    await waitFor(() => expect(load).toHaveBeenLastCalledWith([1, 2, 3], "strict"));
  });

  it("부스 선택은 접혀 있고 선택 수를 보여 주며, 펼치면 넓은 화면 2열의 스크롤 목록이다", async () => {
    panel();
    const u = userEvent.setup();
    const pick = screen.getByRole("button", { name: /합계에 포함할 부스/ });
    expect(pick).toHaveTextContent("3 / 3개 선택");
    expect(pick).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "합계에 포함할 부스" })).not.toBeInTheDocument();
    await u.click(pick);
    const group = screen.getByRole("group", { name: "합계에 포함할 부스" });
    expect(within(group).getByRole("list")).toHaveClass("sm:grid-cols-2", "overflow-y-auto");
    await u.click(within(group).getByRole("checkbox", { name: "솜사탕" }));
    expect(pick).toHaveTextContent("2 / 3개 선택");
  });

  it("부스 이름 검색은 목록만 줄이고 선택은 유지한다", async () => {
    const load = panel();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: /합계에 포함할 부스/ }));
    await u.type(screen.getByLabelText("부스 검색"), "솜");
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: "솜사탕" })).toBeInTheDocument();
    expect(load).toHaveBeenLastCalledWith([1, 2, 3], "simple");
  });
});
