export type Normalized = { ok: true; value: string } | { ok: false; message: string };

/** 서버 normalize_name과 동일: 앞뒤 공백 제거 후 1~50자(코드포인트 기준). */
export function normalizeName(s: string): Normalized {
  const v = typeof s === "string" ? s.trim() : "";
  const len = [...v].length;
  if (len < 1) return { ok: false, message: "참가자 이름을 입력해 주세요." };
  if (len > 50) return { ok: false, message: "이름은 50자까지 입력할 수 있어요." };
  return { ok: true, value: v };
}

// 서버는 Python str.isdigit()로 검사한다: 유니코드 십진수(Nd) + 위·아래 첨자·동그라미 숫자 등.
const NON_ASCII_DIGIT =
  /[\p{Nd}²³¹⁰⁴-⁹₀-₉①-⑨⑴-⑼⒈-⒐⓪❶-❾➀-➈➊-➒]/u;

/** 서버 normalize_code와 동일: 비ASCII 숫자 있으면 오류, 그 밖 문자는 제거 후 정확히 4자리. */
export function normalizeCode(s: string): Normalized {
  const str = typeof s === "string" ? s : "";
  for (const c of str) {
    if (NON_ASCII_DIGIT.test(c) && !/[0-9]/.test(c)) {
      return { ok: false, message: "숫자는 일반 숫자(0~9)로 입력해 주세요." };
    }
  }
  const digits = str.replace(/[^0-9]/g, "");
  if (digits.length !== 4) return { ok: false, message: "식별번호는 숫자 4자리예요." };
  return { ok: true, value: digits };
}
