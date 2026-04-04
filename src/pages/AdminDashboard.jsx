import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

const AdminDashboard = () => {
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('reservations') || '[]');
    setReservations(data);
  }, []);

  // 시간대순 정렬 로직
  const sortedReservations = useMemo(() => {
    return [...reservations].sort((a, b) => a.time.localeCompare(b.time));
  }, [reservations]);

  const toggleNoShow = (id) => {
    const updated = reservations.map(r => r.id === id ? { ...r, status: r.status === 'noshow' ? 'normal' : 'noshow' } : r);
    setReservations(updated);
    localStorage.setItem('reservations', JSON.stringify(updated));
  };

  const ageGroups = ["0~8세", "9~13세", "14~16세", "17~19세", "20~24세", "24세 이상"];
  
  // 통계 계산 로직
  const stats = useMemo(() => ageGroups.map(group => ({
    group,
    male: reservations.filter(r => r.ageGroup === group && r.gender === '남').length,
    female: reservations.filter(r => r.ageGroup === group && r.gender === '여').length,
    total: reservations.filter(r => r.ageGroup === group).length
  })), [reservations]);

  const totalReservations = reservations.length;

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(sortedReservations);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "신청자목록");
    XLSX.writeFile(wb, `최종명단_${new Date().toLocaleDateString()}.xlsx`);
  };

  const clearAllData = () => {
    if (window.confirm("⚠️ 정말로 모든 예약 데이터를 삭제하시겠습니까? 복구할 수 없습니다.")) {
      localStorage.removeItem('reservations'); // 저장소에서 삭제
      setReservations([]); // 현재 화면 상태 초기화
      alert("모든 데이터가 삭제되었습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 상단 대시보드 헤더 */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-7 bg-slate-900 text-white rounded-[2rem] shadow-2xl border-b-8 border-blue-600">
          <div>
            <h1 className="text-4xl font-black tracking-tighter leading-none mb-2 text-left">부스 신청 현황</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-s text-left">2026. 5. 5.</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-700 pt-6 md:pt-0 md:pl-8">
            <div className="flex-1 text-center md:text-left">
              <div className="text-s font-black text-slate-500 uppercase mb-1">전체 총계</div>
              <div className="text-5xl font-black text-blue-400 tabular-nums">{totalReservations}</div>
            </div>
            <button onClick={downloadExcel} className="px-4 py-4 bg-white text-slate-900 rounded-2xl text-sm font-black hover:bg-yellow-400 transition-all shadow-xl active:scale-95">
              엑셀 다운로드
            </button>
            <button 
              onClick={clearAllData} 
              className="px-4 py-4 bg-red-600 text-white rounded-2xl text-sm font-black hover:bg-slate-900 transition-all shadow-xl active:scale-95"
            >
              데이터 초기화
            </button>
          </div>
        </header>

        {/* 연령별/성별 통계 표 섹션 (수정된 부분) */}
        <section className="bg-white rounded-[2rem] shadow-xl border-4 border-slate-900 overflow-hidden">
          <div className="bg-slate-900 px-8 py-4">
            <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <span>📊</span> 연령 및 성별별 총계
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-100">
                  <th className="py-5 px-6 text-slate-400 font-black text-xs uppercase">연령대</th>
                  <th className="py-5 px-6 text-blue-600 font-black text-xs uppercase bg-blue-50/30">남성 (M)</th>
                  <th className="py-5 px-6 text-pink-600 font-black text-xs uppercase bg-pink-50/30">여성 (F)</th>
                  <th className="py-5 px-6 text-slate-900 font-black text-xs uppercase border-l-2 border-slate-100">연령별 합계</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-50">
                {stats.map(s => (
                  <tr key={s.group} className="hover:bg-slate-50 transition-colors font-bold text-lg">
                    <td className="py-6 px-6 text-slate-500 font-black text-xs">{s.group}</td>
                    <td className="py-6 px-6 text-slate-900 bg-blue-50/10">{s.male}</td>
                    <td className="py-6 px-6 text-slate-900 bg-pink-50/10">{s.female}</td>
                    <td className="py-6 px-6 text-blue-600 font-black border-l-2 border-slate-100 tabular-nums bg-slate-50/50">
                      {s.total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-black">
                  <td className="py-7 px-7 uppercase tracking-widest text-xs">전체합계</td>
                  <td className="py-6 px-6 text-s">{stats.reduce((acc, curr) => acc + curr.male, 0)}</td>
                  <td className="py-6 px-6 text-s">{stats.reduce((acc, curr) => acc + curr.female, 0)}</td>
                  <td className="py-6 px-6 text-s text-yellow-400 border-l-2 border-slate-700">
                    {totalReservations}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* 상세 리스트 섹션 */}
<section className="bg-white rounded-[2rem] shadow-xl border-2 border-slate-200 overflow-hidden">
  <div className="px-8 py-6 border-b-4 border-slate-100 flex justify-between items-center bg-white">
    <h3 className="text-xl font-black text-slate-900">신청 현황</h3>
    <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-3 py-1 rounded-full uppercase">시간순 정렬</span>
  </div>
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
        <tr>
          {/* 모바일 패딩 축소 및 줄바꿈 방지 적용 */}
          <th className="py-5 px-4 md:px-10 whitespace-nowrap">시간대</th>
          <th className="py-5 px-4 md:px-10 whitespace-nowrap">이름</th>
          <th className="py-5 px-4 md:px-10 whitespace-nowrap">연령대</th>
          <th className="py-5 px-4 md:px-10 text-center whitespace-nowrap">관리</th>
        </tr>
      </thead>
      <tbody className="divide-y-2 divide-slate-50">
        {sortedReservations.map(r => (
          <tr key={r.id} className={`font-bold transition-all ${r.status === 'noshow' ? 'bg-red-50/50 opacity-40 grayscale italic' : 'hover:bg-blue-50/50'}`}>
            {/* 모바일 패딩 축소 및 텍스트 레이아웃 최적화 */}
            <td className="py-5 px-4 md:py-7 md:px-10 text-blue-600 font-black text-lg tabular-nums tracking-tighter whitespace-nowrap">{r.time}</td>
            <td className="py-5 px-4 md:py-7 md:px-10 whitespace-nowrap">
              <div className="text-slate-900 text-lg font-black mb-1">{r.name}</div>
              <div className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded border ${r.gender === '남' ? 'text-blue-500 border-blue-200 bg-blue-50' : 'text-pink-500 border-pink-200 bg-pink-50'}`}>
                {r.gender === '남' ? '남자' : '여자'}
              </div>
            </td>
            <td className="py-5 px-4 md:py-7 md:px-10 text-slate-500 font-black whitespace-nowrap">{r.ageGroup}</td>
            <td className="py-5 px-4 md:py-7 md:px-10 text-center whitespace-nowrap">
              <button onClick={() => toggleNoShow(r.id)} 
                className={`px-5 py-2 md:px-8 md:py-3 rounded-2xl text-xs font-black transition-all shadow-md ${r.status === 'noshow' ? 'bg-slate-200 text-slate-500 shadow-none' : 'bg-red-600 text-white hover:bg-slate-900 active:scale-90'}`}>
                {r.status === 'noshow' ? '복구' : '노쇼'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>
      </div>
    </div>
  );
};

export default AdminDashboard;