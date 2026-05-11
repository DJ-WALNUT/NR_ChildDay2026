import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const AdminHeader = () => {
  const location = useLocation();
  const activeClass = "text-blue-600 border-b-2 border-blue-600";
  const inactiveClass = "text-slate-500 hover:text-slate-800";

  return (
    <footer className="max-w-xl mx-auto px-6 py-12 text-center border-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col md:flex-row items-center gap-2">
            <div className="w-70 rounded-xl flex items-center justify-center">
              <img src="/logo.png" alt="Logo" />
            </div>
            <div className="w-70 rounded-xl flex items-center justify-center">
              <img src="/logo_su.png" alt="Logo" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-slate-400 text-sm font-medium">
              © 2026 Nareum Youth Center.<br/>
              IN 2026 GwangMyeong Youth Center.<br/>
              All rights reserved.
            </p>
            <div className="flex justify-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span>Created by CLUSTER (최원서)</span>
            </div>
          </div>
          <div className="pt-4">
            <a 
              href="https://gmyouth.or.kr/nareum/index.do" 
              target="_blank" 
              rel="noreferrer"
              className="text-[15px] font-black text-slate-500 hover:text-blue-400 transition-colors border border-slate-700 px-3 py-1 rounded-full"
            >
              공식 홈페이지 바로가기
            </a>
          </div>
        </div>
      </footer>
  );
};

export default AdminHeader;