import { render, screen } from "@testing-library/react";
import { TicketCard } from "../src/visitor/TicketCard";

const base = { eventName: "어울마당", boothName: "페이스페인팅", name: "김하늘", slot: "11시 A타임", status: "normal" } as const;

describe("TicketCard", () => {
  it("입장 시간을 노랑 몸통에 가장 크게, 참가자 이름을 그다음으로 보인다", () => {
    const { container } = render(<TicketCard {...base} />);
    const time = screen.getByText("11시 A타임");
    expect(time).toHaveClass("text-44");
    expect(container.querySelector(".bg-ticket")).toContainElement(time);
    expect(screen.getByText("김하늘")).toHaveClass("text-28");
  });

  it("상태 도장은 크게 찍히고 줄어든 동작 설정을 따른다", () => {
    render(<TicketCard {...base} />);
    expect(screen.getByText("입장 가능")).toHaveClass("text-18", "motion-safe:animate-stamp-press");
  });

  it("선착순은 선착순 입장으로 보인다", () => {
    render(<TicketCard {...base} slot="선착순" />);
    expect(screen.getByText("선착순 입장")).toHaveClass("text-44");
  });

  it.each([
    ["noshow", "노쇼"],
    ["completed", "체험완료"],
  ] as const)("%s 입장권은 쓰인 표처럼 어두운 몸통이다", (status, label) => {
    const { container } = render(<TicketCard {...base} status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector(".bg-ticket")).toBeNull();
    expect(container.querySelector(".bg-ink-2")).toContainElement(screen.getByText("11시 A타임"));
  });

  it("대기 입장권은 노랑 몸통을 유지한다", () => {
    const { container } = render(<TicketCard {...base} status="waiting" />);
    expect(container.querySelector(".bg-ticket")).not.toBeNull();
  });
});
