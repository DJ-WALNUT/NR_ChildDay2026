import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const AdminHeader = () => {
  const location = useLocation();
  const activeClass = "text-blue-600 border-b-2 border-blue-600";
  const inactiveClass = "text-slate-500 hover:text-slate-800";

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <h1 className="text-xl font-black text-slate-900 tracking-tighter">ADMIN CENTER</h1>
        <nav className="flex gap-8 h-full">
          <Link to="/admin" className={`flex items-center px-1 font-bold ${location.pathname === '/admin' ? activeClass : inactiveClass}`}>대시보드</Link>
          <Link to="/admin/booths" className={`flex items-center px-1 font-bold ${location.pathname.startsWith('/admin/booths') ? activeClass : inactiveClass}`}>부스관리</Link>
        </nav>
      </div>
    </header>
  );
};

export default AdminHeader;