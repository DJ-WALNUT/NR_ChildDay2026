import { ApiError } from "./client";

export const FALLBACK_MESSAGE = "문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";

const MESSAGES: Record<string, string> = {
  full: "이 시간은 마감됐어요.",
  closed: "지금은 접수하지 않아요.",
  duplicate: "이미 신청했어요.",
  not_cancellable: "체험이 끝났거나 노쇼 처리된 신청은 취소할 수 없어요.",
  rate_limited: "잠시 뒤에 다시 시도해 주세요.",
  not_found: "찾을 수 없어요.",
  invalid: "입력한 내용을 다시 확인해 주세요.",
  network: "연결이 불안정해요. 잠시 뒤 다시 시도해 주세요.",
  unauthorized: "로그인이 필요해요.",
  forbidden: "이 작업을 할 권한이 없어요.",
  csrf: "화면이 오래되었어요. 새로고침한 뒤 다시 시도해 주세요.",
  file_too_large: "파일이 너무 커요.",
  password_change_required: "먼저 비밀번호를 바꿔 주세요.",
  invalid_credentials: "아이디 또는 비밀번호가 맞지 않아요.",
  username_taken: "이미 사용 중인 아이디예요.",
  slug_taken: "이미 사용 중인 주소예요.",
  last_active_user: "마지막 활성 계정은 비활성화할 수 없어요.",
  cannot_deactivate_self: "내 계정은 직접 비활성화할 수 없어요.",
  use_password_change: "비밀번호는 비밀번호 변경 화면에서 바꿔 주세요.",
};

/** 오류를 화면에 보여줄 한국어 문구로 바꾼다. 알 수 없는 코드는 fallback. */
export function messageFor(err: unknown, fallback: string = FALLBACK_MESSAGE): string {
  if (err instanceof ApiError) {
    const text = MESSAGES[err.code];
    if (text) return text;
  }
  return fallback;
}

/** 422 오류의 필드별 문구. 그 밖의 오류는 빈 객체. */
export function fieldErrors(err: unknown): Record<string, string> {
  return err instanceof ApiError && err.status === 422 ? err.fields : {};
}
