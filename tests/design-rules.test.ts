import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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
  ["large radius", /rounded-(xl|2xl|3xl|\[)/],
  ["emoji", /\p{Extended_Pictographic}/u],
  ["blue family", /\b(blue|indigo|sky)-/],
  ["shadow/gradient", /shadow-|bg-gradient|\bfrom-|\bvia-/],
];

describe("design rules", () => {
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
    expect(RULES[2][1].test("확인 ✅")).toBe(true);
    expect(RULES[3][1].test("bg-blue-500")).toBe(true);
    expect(RULES[4][1].test("shadow-md")).toBe(true);
    expect(RULES[0][1].test("bg-ink text-paper")).toBe(false);
  });
});
