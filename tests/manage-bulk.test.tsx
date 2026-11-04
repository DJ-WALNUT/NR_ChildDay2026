import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ExcelJS from "exceljs";
import { ApiError } from "../src/api/client";
import type { AdminEvent } from "../src/api/types";
import BulkImport from "../src/manage/event/BulkImport";

vi.mock("../src/api/admin", async (orig) => ({
  ...(await orig<typeof import("../src/api/admin")>()),
  bulkCreateBooths: vi.fn(),
}));
import * as admin from "../src/api/admin";

const EVENT: AdminEvent = {
  id: 10,
  name: "가을 축제",
  created_at: 1_700_000_000,
  booth_count: 0,
  partner_count: 0,
  logo_url: null,
  notice: null,
};

async function xlsx(rows: (string | null)[][]): Promise<File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("부스");
  ws.addRow(["부스이름", "운영방식"]);
  rows.forEach((r, i) => r.forEach((v, c) => (ws.getRow(i + 2).getCell(c + 1).value = v)));
  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return new File([buf], "booths.xlsx");
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={client}>
      <BulkImport event={EVENT} onClose={onClose} />
    </QueryClientProvider>,
  );
  const upload = (file: File) => user.upload(screen.getByLabelText("엑셀 파일 선택"), file);
  return { user, upload, invalidate, onClose };
}

const THREE = [
  ["가", "타임별"],
  ["나", "선착순"],
  ["다", null],
];

beforeEach(() => {
  vi.mocked(admin.bulkCreateBooths).mockReset();
});

describe("BulkImport", () => {
  it("미리보기를 보여 주고 등록하면 sheetRow 를 빼고 보낸 뒤 목록을 새로 받는다", async () => {
    vi.mocked(admin.bulkCreateBooths).mockResolvedValue({ created: 3 });
    const { user, upload, invalidate } = setup();
    await upload(await xlsx(THREE));

    const table = await screen.findByRole("region", { name: "등록할 부스" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByText("나")).toBeInTheDocument();
    expect(within(table).getByText("선착순")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "3개 등록" }));
    expect(await screen.findByText("부스 3개를 등록했어요.")).toBeInTheDocument();
    expect(admin.bulkCreateBooths).toHaveBeenCalledWith(10, [
      { name: "가", mode: "time" },
      { name: "나", mode: "fcfs" },
      { name: "다" },
    ]);
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toContainEqual(["admin", "booths", 10]);
    expect(keys).toContainEqual(["admin", "event", 10]);
  });

  it("문제가 있으면 등록 버튼이 잠긴다", async () => {
    const { upload } = setup();
    await upload(await xlsx([["가", "상시"]]));
    expect(await screen.findByText(/2행/)).toBeInTheDocument();
    expect(screen.getByText("운영방식은 타임별 또는 선착순이에요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /등록$/ })).toBeDisabled();
    expect(admin.bulkCreateBooths).not.toHaveBeenCalled();
  });

  it("서버가 422 로 거절하면 행 번호와 문구를 보이고 미리보기는 남는다", async () => {
    vi.mocked(admin.bulkCreateBooths).mockRejectedValue(
      new ApiError(422, "invalid", { rows: { "1": "1~100자로 입력하세요." } } as unknown as Record<string, string>),
    );
    const { user, upload } = setup();
    await upload(await xlsx(THREE));
    await user.click(await screen.findByRole("button", { name: "3개 등록" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/3행/)).toBeInTheDocument();
    expect(within(alert).getByText("1~100자로 입력하세요.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "3개 등록" })).toBeEnabled());
    expect(screen.getByRole("region", { name: "등록할 부스" })).toBeInTheDocument();
  });
});
