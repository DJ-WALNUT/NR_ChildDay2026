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
        setStats({ total: resData.length, booths: boothData.length });
      } catch (e) { console.error(e); }
    };
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto p-8">
        <h2 className="text-3xl font-black mb-8">오늘의 현황</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-10 rounded-[2rem] shadow-sm border border-slate-200">
            <p className="text-slate-500 font-bold mb-2">총 신청 인원</p>
            <p className="text-6xl font-black text-blue-600">{stats.total}<span className="text-2xl text-slate-400 ml-2">명</span></p>
          </div>
          <div className="bg-white p-10 rounded-[2rem] shadow-sm border border-slate-200">
            <p className="text-slate-500 font-bold mb-2">운영 중인 부스</p>
            <p className="text-6xl font-black text-slate-900">{stats.booths}<span className="text-2xl text-slate-400 ml-2">개</span></p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminMain;