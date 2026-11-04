import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { messageFor } from "../api/messages";
import { Button, Notice } from "../ui";
import { useAuth } from "./auth/AuthProvider";

const ORG_MENU = [
  { to: "/manage", label: "대시보드", end: true },
  { to: "/manage/activity", label: "활동 기록", end: false },
  { to: "/manage/members", label: "기관 계정", end: false },
  { to: "/manage/org", label: "기관 설정", end: false },
  { to: "/manage/account", label: "내 계정", end: false },
];
const SUPER_MENU = [
  { to: "/manage/super", label: "슈퍼관리자", end: false },
  { to: "/manage/account", label: "내 계정", end: false },
];

/** 관리자 화면의 틀. lg 이상은 왼쪽 사이드바, 그보다 좁으면 상단 막대 + 접히는 메뉴. */
export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menu = user?.is_superadmin ? SUPER_MENU : ORG_MENU;

  async function signOut() {
    setError(null);
    try {
      await logout();
    } catch (err) {
      setError(messageFor(err)); // 로그아웃이 실패하면 세션은 그대로이므로 알린다.
    }
  }

  return (
    <div className="min-h-dvh bg-paper-2 text-ink lg:flex">
      <aside className="on-ink bg-ink text-paper lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-2 lg:py-6">
          <span className="text-18 font-extrabold tracking-[-0.03em]">체험부스 관리</span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="admin-menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 items-center gap-2 rounded-md border-2 border-paper px-3 text-15 font-bold lg:hidden"
          >
            {open ? <X aria-hidden className="size-4" /> : <Menu aria-hidden className="size-4" />}
            메뉴
          </button>
        </div>
        <div id="admin-menu" className={`px-2 pb-4 ${open ? "block" : "hidden lg:block"}`}>
          <nav aria-label="관리 메뉴">
            <ul className="space-y-1">
              {menu.map((m) => (
                <li key={m.to}>
                  <NavLink
                    to={m.to}
                    end={m.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center rounded-md px-3 text-15 font-bold hover:bg-ink-2 ${isActive ? "bg-ink-2" : ""}`
                    }
                  >
                    {m.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-4 border-t border-ink-2 px-2 pt-4">
            {user && <p className="mb-2 truncate text-13">{user.display_name}</p>}
            <Button variant="secondary" onDark onClick={() => void signOut()}>
              로그아웃
            </Button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-300 px-4 py-6">
          {error && (
            <div className="mb-4">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
