import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import AdminHeader from '../../components/AdminHeader';
import Footer from '../../components/Footer';

const AdminMain = () => {
  const [stats, setStats] = useState({ total: 0, today: 0, activeBooths: 0, totalBooths: 0 });

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
        
        // 2. 오늘 예약자 계산 (Date 객체를 활용한 안전한 비교)
        const today = new Date();
        const todayResCount = resData.filter(r => {
          if (!r.created_at) return false; // 백엔드에 created_at이 없는 경우 예외 처리
          
          const resDate = new Date(r.created_at);
          // 로컬 타임존(한국 시간) 기준으로 연/월/일이 일치하는지 확인
          return (
            resDate.getFullYear() === today.getFullYear() &&
            resDate.getMonth() === today.getMonth() &&
            resDate.getDate() === today.getDate()
          );
        }).length;

        setStats({ 
          total: resData.length, 
          today: todayResCount,
          activeBooths: activeBoothsCount,
          totalBooths: boothData.length 
        });
      } catch (e) { 
        console.error("통계 데이터 로드 실패:", e); 
      }
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

      <Footer />
    </div>
  );
};

export default AdminMain;