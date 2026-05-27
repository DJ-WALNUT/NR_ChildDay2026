import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../../config';
import AdminHeader from '../../components/AdminHeader';
import Footer from '../../components/Footer';

const AdminMain = () => {
  const [reservations, setReservations] = useState([]);
  const [booths, setBooths] = useState([]);
  const [events, setEvents] = useState([]);
  
  // 행사 필터 상태 관리 ('all' 또는 특정 event_id)
  const [selectedEventId, setSelectedEventId] = useState('all');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [resRes, boothRes, eventRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/reservations`),
          fetch(`${API_BASE_URL}/api/booths`),
          fetch(`${API_BASE_URL}/api/events`)
        ]);
        
        const resData = await resRes.json();
        const boothData = await boothRes.json();
        const eventData = await eventRes.json();

        setReservations(resData);
        setBooths(boothData);
        setEvents(eventData.sort((a, b) => b.id - a.id)); // 최신 행사순 정렬
      } catch (e) { 
        console.error("대시보드 데이터 로드 실패:", e); 
      }
    };
    fetchDashboardData();
  }, []);

  // 선택된 행사에 따라 부스와 예약 데이터를 동적으로 필터링하는 로직
  const dashboardStats = useMemo(() => {
    // 1. 부스 필터링
    const filteredBooths = selectedEventId === 'all' 
      ? booths 
      : booths.filter(b => b.event_id === parseInt(selectedEventId, 10));

    // 2. 예약 데이터 필터링을 위한 부스 이름 세트 생성
    const filteredBoothNames = new Set(filteredBooths.map(b => b.name));

    // 3. 해당 부스들에 속한 예약만 필터링 (노쇼 제외 여부는 기존처럼 필터에서 유지하되 여기선 신청 인원 총량이므로 status 전체 타겟)
    const filteredReservations = reservations.filter(r => filteredBoothNames.has(r.booth_name));

    // 4. 운영 중인 부스 계산
    const activeBoothsCount = filteredBooths.filter(b => b.is_active).length;
    
    // 5. 오늘 신청한 인원 계산 (로컬 타임존 기준 연/월/일 비교)
    const today = new Date();
    const todayResCount = filteredReservations.filter(r => {
      if (!r.created_at) return false;
      const resDate = new Date(r.created_at);
      return (
        resDate.getFullYear() === today.getFullYear() &&
        resDate.getMonth() === today.getMonth() &&
        resDate.getDate() === today.getDate()
      );
    }).length;

    return {
      today: todayResCount,
      total: filteredReservations.length,
      activeBooths: activeBoothsCount,
      totalBooths: filteredBooths.length
    };
  }, [reservations, booths, selectedEventId]);

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* 상단 컨트롤러 및 타이틀 구역 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">부스 운영 대시보드</h2>
            <p className="text-slate-500 font-bold text-sm mt-1">행사별 실시간 예약 및 부스 가동 현황을 모니터링합니다.</p>
          </div>

          {/* 행사 필터 드롭다운 조절 바 */}
          <div className="w-full md:w-72 flex items-center gap-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">행사 선택</span>
            <select
              className="w-full px-4 py-2.5 bg-slate-900 text-white font-bold rounded-xl outline-none shadow-md cursor-pointer border-b-4 border-blue-500 transition-all text-sm"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="all">🌐 모든 행사 종합 지표</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  📅 {event.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 대시보드 4종 지표 카드 컴포넌트 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* 오늘 신청 인원 */}
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-blue-400 transition-all group">
            <p className="text-slate-500 font-black text-xs uppercase tracking-widest mb-2">오늘 신청 인원</p>
            <p className="text-5xl font-black text-blue-500 tabular-nums tracking-tighter">
              {dashboardStats.today}
              <span className="text-xl text-slate-400 font-bold ml-1.5">명</span>
            </p>
            <div className="mt-4 text-xs font-bold text-slate-400 group-hover:text-blue-500 transition-colors">
              당일 접수된 실시간 예약 수
            </div>
          </div>

          {/* 총 신청 인원 */}
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-slate-900 transition-all group">
            <p className="text-slate-500 font-black text-xs uppercase tracking-widest mb-2">총 신청 인원</p>
            <p className="text-5xl font-black text-slate-900 tabular-nums tracking-tighter">
              {dashboardStats.total}
              <span className="text-xl text-slate-400 font-bold ml-1.5">명</span>
            </p>
            <div className="mt-4 text-xs font-bold text-slate-400 group-hover:text-slate-700 transition-colors">
              누적된 전체 예약 수 (노쇼 포함)
            </div>
          </div>

          {/* 현재 운영 중인 부스 */}
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-green-500 transition-all group">
            <p className="text-slate-500 font-black text-xs uppercase tracking-widest mb-2">현재 운영 중인 부스</p>
            <p className="text-5xl font-black text-green-600 tabular-nums tracking-tighter">
              {dashboardStats.activeBooths}
              <span className="text-xl text-slate-400 font-bold ml-1.5">개</span>
            </p>
            <div className="mt-4 text-xs font-bold text-slate-400 group-hover:text-green-600 transition-colors">
              운영 중 상태로 열려있는 부스
            </div>
          </div>

          {/* 총 개설된 부스 */}
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-purple-500 transition-all group">
            <p className="text-slate-500 font-black text-xs uppercase tracking-widest mb-2">총 개설된 부스</p>
            <p className="text-5xl font-black text-purple-600 tabular-nums tracking-tighter">
              {dashboardStats.totalBooths}
              <span className="text-xl text-slate-400 font-bold ml-1.5">개</span>
            </p>
            <div className="mt-4 text-xs font-bold text-slate-400 group-hover:text-purple-600 transition-colors">
              시스템에 등록된 전체 부스 개수
            </div>
          </div>

        </div>

        {/* 하단 퀵 링크 요약 안내판 */}
        <div className="bg-slate-900 text-slate-400 p-6 rounded-[2rem] shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="text-sm font-bold">
            💡 <span className="text-white">안내:</span> 현재 등록된 상위 행사 그룹 카테고리는 총 <span className="text-yellow-400 font-black">{events.length}개</span>입니다. 상세 설정을 수정하거나 새 카테고리를 만들려면 <span className="text-white underline">행사관리</span> 탭을 이용해 주세요.
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
};

export default AdminMain;