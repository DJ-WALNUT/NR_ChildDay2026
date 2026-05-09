import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import AdminHeader from './AdminHeader';

const AdminMain = () => {
  const [stats, setStats] = useState({ total: 0, booths: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [resRes, boothRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/reservations`),
          fetch(`${API_BASE_URL}/api/booths`)
        ]);
        const resData = await resRes.json();
        const boothData = await boothRes.json();

        // 1. 부스 현황 분리
        const activeBoothsCount = boothData.filter(b => b.is_active).length;
        
        // 2. 오늘 예약자 계산 (백엔드에 생성일자 필드 'created_at'이 있다고 가정)
        const todayString = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD" 형태
        const todayResCount = resData.filter(r => 
          r.created_at && r.created_at.startsWith(todayString)
        ).length;

        setStats({ 
          total: resData.length, 
          today: todayResCount,
          activeBooths: activeBoothsCount,
          totalBooths: boothData.length 
        });
      } catch (e) { console.error(e); }
    };
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto p-8">
        <h2 className="text-3xl font-black mb-8">부스 운영 현황</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
            <p className="text-slate-500 font-bold mb-2">오늘 신청 인원</p>
            <p className="text-5xl font-black text-blue-500">{stats.today}<span className="text-xl text-slate-400 ml-2">명</span></p>
          </div>
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
            <p className="text-slate-500 font-bold mb-2">총 신청 인원</p>
            <p className="text-4xl font-black text-slate-900">{stats.total}<span className="text-xl text-slate-400 ml-2">명</span></p>
          </div>
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
            <p className="text-slate-500 font-bold mb-2">현재 운영 중인 부스</p>
            <p className="text-5xl font-black text-green-600">{stats.activeBooths}<span className="text-xl text-slate-400 ml-2">개</span></p>
          </div>
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
            <p className="text-slate-500 font-bold mb-2">총 개설된 부스</p>
            <p className="text-4xl font-black text-slate-900">{stats.totalBooths}<span className="text-xl text-slate-400 ml-2">개</span></p>
          </div>
        </div>
      </main>

      <footer className="max-w-xl mx-auto px-6 py-12 text-center border-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-70 rounded-xl flex items-center justify-center">
              <img src="/logo.png" alt="Logo" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-slate-400 text-sm font-medium">
              © 2026 Nareum Youth Center.<br/>
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
    </div>
  );
};

export default AdminMain;