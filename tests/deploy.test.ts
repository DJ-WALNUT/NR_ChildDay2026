import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("배포 설정", () => {
  it("index.html 은 referrer 를 보내지 않는다", () => {
    expect(read("index.html")).toContain('<meta name="referrer" content="no-referrer"');
  });

  it("favicon 의 type 은 실제 형식(PNG)과 맞다", () => {
    const html = read("index.html");
    expect(html).toMatch(/<link rel="icon" type="image\/png" href="\/favicon_NR\.png"/);
  });

  it("public/.htaccess 가 있고 SPA 재작성과 보안·캐시 헤더를 담는다", () => {
    expect(existsSync(join(root, "public/.htaccess"))).toBe(true);
    expect(existsSync(join(root, ".htaccess"))).toBe(false);
    const ht = read("public/.htaccess");
    expect(ht).toContain("RewriteRule . /index.html [L]");
    expect(ht).toContain('Header always set Referrer-Policy "no-referrer"');
    expect(ht).toContain('Header always set X-Content-Type-Options "nosniff"');
    expect(ht).toMatch(/immutable/);
    expect(ht).toMatch(/no-cache/);
  });

  it(".env.production 이 운영 API 주소를 정한다", () => {
    expect(read(".env.production")).toMatch(/^VITE_API_BASE=https:\/\/child-api\.team-cluster\.kr$/m);
  });
});
