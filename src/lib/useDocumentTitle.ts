import { useEffect } from "react";

export const DEFAULT_TITLE = "체험부스";

/** 화면마다 탭 제목을 정한다. 제목이 아직 없으면(불러오는 중) 기본 제목, 화면을 떠나면 기본 제목으로 돌려놓는다. */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title || DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
