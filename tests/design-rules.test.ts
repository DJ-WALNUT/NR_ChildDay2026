import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(__dirname, "..", "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const RULES: [string, RegExp][] = [
  ["raw color (hex/rgb/hsl)", /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/],
  ["large radius", /rounded(-[trblxyse]{1,2})?-(xl|2xl|3xl|4xl|\[)/],
  ["emoji", /(?![©®™])\p{Extended_Pictographic}/u],
  ["blue family", /\b(blue|indigo|sky)-/],
  ["shadow/gradient", /(^|[\s"'`])shadow(-|\b)|bg-gradient|bg-linear-|\bfrom-|\bvia-/],
];

describe("design rules", () => {
  it("스캔 대상 파일을 찾는다", () => {
    const files = walk(SRC).map((f) => relative(SRC, f).split(sep).join("/"));
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain("routes.tsx");
  });

  it("src 에 규칙 위반이 없다", () => {
    const violations: string[] = [];
    for (const file of walk(SRC)) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          for (const [label, re] of RULES) {
            if (re.test(line)) violations.push(`${relative(SRC, file)}:${i + 1} ${label}: ${line.trim()}`);
          }
        });
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("규칙 정규식이 위반 예시를 잡는다", () => {
    expect(RULES[0][1].test('color: "#fff"')).toBe(true);
    expect(RULES[1][1].test("rounded-2xl")).toBe(true);
    expect(RULES[1][1].test("rounded-t-xl")).toBe(true);
    expect(RULES[1][1].test("rounded-tl-3xl")).toBe(true);
    expect(RULES[1][1].test("rounded-4xl")).toBe(true);
    expect(RULES[1][1].test("rounded-[10px]")).toBe(true);
    expect(RULES[1][1].test("rounded-md")).toBe(false);
    expect(RULES[2][1].test("확인 ✅")).toBe(true);
    expect(RULES[2][1].test("© 2026 기관")).toBe(false);
    expect(RULES[2][1].test("🎉")).toBe(true);
    expect(RULES[3][1].test("bg-blue-500")).toBe(true);
    expect(RULES[4][1].test("shadow-md")).toBe(true);
    expect(RULES[4][1].test('className="p-2 shadow"')).toBe(true);
    expect(RULES[4][1].test("bg-linear-to-r")).toBe(true);
    expect(RULES[4][1].test("bg-gradient-to-r")).toBe(true);
    expect(RULES[0][1].test("bg-ink text-paper")).toBe(false);
  });
});

describe("포커스 색 범위", () => {
  it("잉크 화면 안의 종이 면(.on-paper)은 포커스 외곽선을 ink 로 되돌린다", () => {
    const css = readFileSync(join(SRC, "index.css"), "utf8");
    expect(css).toMatch(/\.on-paper\s+:focus-visible\s*\{[^}]*outline-color:\s*var\(--color-ink\)/);
  });
});
