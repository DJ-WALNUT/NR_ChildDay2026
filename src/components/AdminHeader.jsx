import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navItems = [
  { to: '/manage', label: '대시보드', match: (p) => p === '/manage' },
  { to: '/manage/events', label: '행사관리', match: (p) => p === '/manage/events' },
  { to: '/manage/booths', label: '부스관리', match: (p) => p.startsWith('/manage/booths') },
  { to: '/manage/summary', label: '합계실적', match: (p) => p === '/manage/summary' },
  { to: '/manage/batch', label: '운영마감', match: (p) => p === '/manage/batch' },
];

const AdminHeader = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const activeClass = "text-blue-600 border-b-2 border-blue-600";
  const inactiveClass = "text-slate-500 hover:text-slate-800";

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <h1 className="text-xl font-black text-slate-900 tracking-tighter">ADMIN CENTER</h1>

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-8 h-full">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center px-1 font-bold break-keep ${item.match(location.pathname) ? activeClass : inactiveClass}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 -mr-2 text-slate-700"
          aria-label="메뉴 열기"
          aria-expanded={open}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden border-t border-slate-200 bg-white">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={`block px-4 py-3 font-bold break-keep border-l-4 ${
                item.match(location.pathname)
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
};

export default AdminHeader;
