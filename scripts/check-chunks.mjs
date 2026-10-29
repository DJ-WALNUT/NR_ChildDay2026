// 빌드 뒤 검사: 방문객이 처음 받는 묶음(entry)이 커지거나 직원용 라이브러리가 새어 들어오면 빌드를 실패시킨다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const LIMIT = 400_000; // 바이트
const dist = join(import.meta.dirname, "..", "dist");
const html = readFileSync(join(dist, "index.html"), "utf8");
const m = /<script[^>]+src="\/?(assets\/[^"]+\.js)"/.exec(html);
if (!m) {
  console.error("check-chunks: dist/index.html 에서 entry 스크립트를 찾지 못했어요.");
  process.exit(1);
}
const entry = join(dist, m[1]);
const size = statSync(entry).size;
const code = readFileSync(entry, "utf8");
const problems = [];
if (size >= LIMIT) problems.push(`entry ${m[1]} 가 ${size} 바이트로 한도 ${LIMIT} 바이트 이상이에요.`);
for (const marker of ["QRCodeCanvas", "QRCodeSVG", "ExcelJS", "exceljs"]) {
  if (code.includes(marker)) problems.push(`entry 에 ${marker} 가 들어 있어요(직원용 화면은 따로 불러와야 해요).`);
}
if (problems.length) {
  console.error("check-chunks 실패:\n- " + problems.join("\n- "));
  process.exit(1);
}
const others = readdirSync(join(dist, "assets")).filter((f) => f.endsWith(".js")).length - 1;
console.log(`check-chunks: entry ${m[1]} ${size} 바이트 (< ${LIMIT}), 그 밖의 묶음 ${others}개 - 통과`);
