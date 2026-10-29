import { useState } from "react";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import {
  Button,
  Choice,
  ConfirmDialog,
  DataTable,
  PageFrame,
  Stamp,
  Stub,
  Tabs,
  TextField,
} from "../src/ui";

describe("Stamp", () => {
  it("wait 는 대기 글자를 렌더한다", () => {
    render(<Stamp kind="wait" />);
    expect(screen.getByText("대기")).toBeInTheDocument();
  });
  it("기본 글자가 종류별로 있다", () => {
    render(
      <>
        <Stamp kind="ok" />
        <Stamp kind="closed" />
        <Stamp kind="noshow" />
        <Stamp kind="done" />
        <Stamp kind="live" />
      </>,
    );
    for (const t of ["입장 가능", "마감", "노쇼", "체험완료", "운영 중"]) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });
});

describe("ConfirmDialog", () => {
  it("requireText 를 입력해야 확인할 수 있고 Esc 로 닫힌다", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="삭제할까요?"
        body="되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        requireText="어울마당"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole("dialog", { name: "삭제할까요?" })).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "삭제" });
    expect(confirm).toBeDisabled();
    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();
    await user.type(input, "어울마당");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("열면 첫 버튼에 포커스, 닫으면 이전 포커스로 돌아간다", async () => {
    const user = userEvent.setup();
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>열기</button>
          <ConfirmDialog
            open={open}
            title="진행할까요?"
            body="본문"
            confirmLabel="진행"
            onConfirm={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole("button", { name: "열기" });
    await user.click(opener);
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("Tab 이 대화상자 밖으로 나가지 않는다", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>바깥</button>
        <ConfirmDialog open title="t" body="b" confirmLabel="확인" onConfirm={() => {}} onCancel={() => {}} />
      </>,
    );
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "확인" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "확인" })).toHaveFocus();
  });
});

describe("ConfirmDialog 포커스 이탈", () => {
  it("배경을 눌러 포커스가 body 로 가도 Esc 가 닫는다", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="t" body="b" confirmLabel="확인" onConfirm={() => {}} onCancel={onCancel} />);
    await user.click(screen.getByRole("dialog").parentElement!);
    expect(document.body).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it("배경을 누른 뒤 Tab 은 대화상자 안으로 포커스를 돌린다", async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog open title="t" body="b" confirmLabel="확인" onConfirm={() => {}} onCancel={() => {}} />);
    await user.click(screen.getByRole("dialog").parentElement!);
    await user.tab();
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  });
  it("열려 있는 동안 body 스크롤을 잠그고 닫으면 풀어요", () => {
    const { rerender } = render(
      <ConfirmDialog open title="t" body="b" confirmLabel="확인" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<ConfirmDialog open={false} title="t" body="b" confirmLabel="확인" onConfirm={() => {}} onCancel={() => {}} />);
    expect(document.body.style.overflow).toBe("");
  });
  it("requireText 가 맞으면 Enter 로 확인한다", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open title="t" body="b" confirmLabel="삭제" requireText="가나" onConfirm={onConfirm} onCancel={() => {}} />,
    );
    await user.keyboard("가");
    await user.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
    await user.keyboard("나{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmDialog 한글 조합", () => {
  it("조합 중 Enter 는 확인하지 않고 Esc 는 닫지 않는다", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="t" body="b" confirmLabel="삭제" requireText="가" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "가" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent(input, createEvent.keyDown(input, { key: "Enter" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("Choice", () => {
  const options = [
    { value: "a", label: "하나" },
    { value: "b", label: "둘", disabled: true },
    { value: "c", label: "셋" },
  ];
  function Host({ initial = "a" }: { initial?: string | null }) {
    const [v, setV] = useState<string | null>(initial);
    return <Choice label="번호" value={v} options={options} onChange={setV} />;
  }

  it("방향키로 다음 옵션을 고르고 disabled 는 건너뛴다", async () => {
    const user = userEvent.setup();
    render(<Host />);
    expect(screen.getByRole("radiogroup", { name: "번호" })).toBeInTheDocument();
    const one = screen.getByRole("radio", { name: "하나" });
    expect(one).toHaveAttribute("aria-checked", "true");
    expect(one).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "셋" })).toHaveAttribute("tabindex", "-1");
    one.focus();
    await user.keyboard("{ArrowRight}");
    const three = screen.getByRole("radio", { name: "셋" });
    expect(three).toHaveAttribute("aria-checked", "true");
    expect(three).toHaveFocus();
    expect(one).toHaveAttribute("aria-checked", "false");
    await user.keyboard("{ArrowRight}");
    expect(one).toHaveAttribute("aria-checked", "true");
  });

  it("선택이 없으면 첫 활성 옵션이 탭 진입점이다", () => {
    render(<Host initial={null} />);
    expect(screen.getByRole("radio", { name: "하나" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "하나" })).toHaveAttribute("aria-checked", "false");
  });

  it("disabled 옵션은 클릭해도 선택되지 않는다", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole("radio", { name: "둘" }));
    expect(screen.getByRole("radio", { name: "둘" })).toHaveAttribute("aria-checked", "false");
  });
});

describe("TextField", () => {
  it("오류가 있으면 aria-invalid 와 aria-describedby 로 연결한다", () => {
    render(<TextField label="이름" error="필수" />);
    const input = screen.getByLabelText("이름");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const id = input.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).toHaveTextContent("필수");
  });
  it("오류가 없으면 aria-invalid 가 없고 hint 만 연결된다", () => {
    render(<TextField label="이름" hint="실명" />);
    const input = screen.getByLabelText("이름");
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent("실명");
  });
});

describe("Button", () => {
  it("loading 이면 비활성이다", () => {
    render(<Button loading>저장</Button>);
    expect(screen.getByRole("button", { name: /저장/ })).toBeDisabled();
  });
  it("기본 type 은 button 이다", () => {
    render(<Button>확인</Button>);
    expect(screen.getByRole("button", { name: "확인" })).toHaveAttribute("type", "button");
  });
});

describe("DataTable", () => {
  it("rows 가 비면 empty 를 보여준다", () => {
    render(
      <DataTable
        columns={[{ key: "n", header: "이름" }]}
        rows={[]}
        rowKey={(r: { n: string }) => r.n}
        empty={<p>비어 있어요</p>}
      />,
    );
    expect(screen.getByText("비어 있어요")).toBeInTheDocument();
  });
  it("행을 렌더한다", () => {
    render(
      <DataTable
        columns={[
          { key: "n", header: "이름" },
          { key: "c", header: "수", numeric: true, render: (r) => `${r.c}명` },
        ]}
        rows={[{ n: "가", c: 3 }]}
        rowKey={(r) => r.n}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "이름" })).toBeInTheDocument();
    expect(screen.getByText("3명")).toBeInTheDocument();
  });
});

describe("Tabs / Stub / PageFrame", () => {
  it("Tabs 는 tab 역할과 aria-selected 를 쓴다", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs
        items={[
          { id: "a", label: "하나", count: 2 },
          { id: "b", label: "둘" },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("tab", { name: /하나/ })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "둘" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
  it("Stub to 는 새로고침 없이 라우트를 바꾼다", async () => {
    const user = userEvent.setup();
    function Where() {
      return <p data-testid="loc">{useLocation().pathname}</p>;
    }
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Stub number="03" to="/booth/3">
          세 번째
        </Stub>
        <Where />
        <Routes>
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /세 번째/ });
    expect(link).toHaveAttribute("href", "/booth/3");
    await user.click(link);
    expect(screen.getByTestId("loc")).toHaveTextContent("/booth/3");
  });
  it("Stamp onDark 는 종이 판 위에 놓인다", () => {
    render(
      <>
        <Stamp kind="closed" onDark />
        <Stamp kind="live" onDark />
      </>,
    );
    expect(screen.getByText("마감")).toHaveClass("bg-paper");
    expect(screen.getByText("운영 중")).toHaveClass("bg-ticket", "text-ink");
  });
  it("필드 오류는 role=alert 이고 기존 aria-describedby 를 합친다", () => {
    render(<TextField label="이름" error="필수" aria-describedby="extra" />);
    const input = screen.getByLabelText("이름");
    expect(screen.getByRole("alert")).toHaveTextContent("필수");
    expect(input.getAttribute("aria-describedby")).toContain("extra");
    expect(input.getAttribute("aria-describedby")).toContain("-error");
  });
  it("Stub 은 onClick 이 있으면 버튼, href 면 링크다", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Stub number="01" onClick={onClick}>
          부스
        </Stub>
        <Stub number="02" href="/x">
          링크
        </Stub>
      </>,
    );
    await user.click(screen.getByRole("button", { name: /부스/ }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /링크/ })).toHaveAttribute("href", "/x");
  });
  it("PageFrame ink 는 on-ink 클래스를 단다", () => {
    render(
      <PageFrame surface="ink">
        <p>안</p>
      </PageFrame>,
    );
    expect(screen.getByText("안").closest(".on-ink")).not.toBeNull();
  });
});
