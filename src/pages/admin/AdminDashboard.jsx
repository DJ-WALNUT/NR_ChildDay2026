import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import * as XLSX from 'xlsx';
import AdminHeader from './AdminHeader'; // 신규 헤더 컴포넌트

const AdminDashboard = () => {
  const { boothId } = useParams();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [boothName, setBoothName] = useState("");

  const fetchData = async () => {
    try {
      // 신규 기능: 특정 부스의 예약 데이터만 호출
      const response = await fetch(`${API_BASE_URL}/api/booths/${boothId}/reservations`);
      const data = await response.json();
      setReservations(data.reservations);
      setBoothName(data.boothName);
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    }
  };

  useEffect(() => { fetchData(); }, [boothId]);

  // --- 통계 계산 로직 (복구) ---
  const stats = useMemo(() => {
    const ageGroups = ["0~8세", "9~13세", "14~16세", "17~19세", "20~24세", "24세 이상"];
    return ageGroups.map(group => {
      const filtered = reservations.filter(r => r.ageGroup === group && r.status !== 'noshow');
      return {
        group,
        male: filtered.filter(r => r.gender === '남').length,
        female: filtered.filter(r => r.gender === '여').length,
        total: filtered.length
      };
    });
  }, [reservations]);

  const totalReservations = useMemo(() => 
    reservations.filter(r => r.status !== 'noshow').length, 
  [reservations]);

  // --- 기존 기능: 노쇼 토글 (계승) ---
  const toggleNoShow = async (id) => {
    await fetch(`${API_BASE_URL}/api/reservations/${id}/toggle`, { method: 'PATCH' });
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status: r.status === 'noshow' ? 'normal' : 'noshow' } : r));
  };

  // --- 기존 기능: 체험 완료 처리 (계승) ---
  const markAsCompleted = async (id) => {
    await fetch(`${API_BASE_URL}/api/reservations/${id}/complete`, { method: 'PATCH' });
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status: r.status === 'completed' ? 'normal' : 'completed' } : r));
  };

  // --- 기존 기능: 개별 삭제 (계승) ---
  const deleteReservation = async (id) => {
    if (!window.confirm("정말 이 신청 건을 삭제하시겠습니까?")) return;
    await fetch(`${API_BASE_URL}/api/reservations/${id}`, { method: 'DELETE' });
    setReservations(prev => prev.filter(r => r.id !== id));
  };

  // --- 기존 기능: 정렬 로직 (계승) ---
  const sortedReservations = useMemo(() => {
    return [...reservations].sort((a, b) => {
      // 1. 시간순 정렬 (숫자 추출)
      const timeA = parseInt(a.time.match(/\d+/)[0]);
      const timeB = parseInt(b.time.match(/\d+/)[0]);
      if (timeA !== timeB) return timeA - timeB;
      // 2. 같은 시간 내에서 A, B, C타임 정렬
      return a.time.localeCompare(b.time);
    });
  }, [reservations]);

  // --- 기존 기능: 엑셀 저장 (계승) ---
  const exportToExcel = () => {
    const data = sortedReservations.map(r => ({
      "시간": r.time, "이름": r.name, "성별": r.gender, 
      "연령": r.ageGroup, "연락처": r.phone, "상태": r.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "신청자명단");
    XLSX.writeFile(wb, `${boothName}_명단.xlsx`);
  };

  const clearAllData = async () => {
    if (window.confirm("⚠️ 서버의 모든 데이터를 영구 삭제하시겠습니까?")) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/booths/${boothId}/clear`, { method: 'DELETE' });
        if (response.ok) {
          setReservations([]);
          alert("서버 데이터가 초기화되었습니다.");
        }
      } catch (error) {
        alert("삭제 실패: 서버 연결을 확인하세요.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 상단 대시보드 헤더 */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-7 bg-slate-900 text-white rounded-[2rem] shadow-2xl border-b-8 border-blue-600">
          <div>
            <h1 className="text-4xl font-black tracking-tighter leading-none mb-2 text-left">{boothName} 신청 현황</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-s text-left">2026. 5. 5.</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-700 pt-6 md:pt-0 md:pl-8">
            <div className="flex-1 text-center md:text-left">
              <div className="text-s font-black text-slate-500 uppercase mb-1">전체 총계</div>
              <div className="text-5xl font-black text-blue-400 tabular-nums">{totalReservations}</div>
            </div>
            <button onClick={exportToExcel} className="px-4 py-4 bg-white text-slate-900 rounded-2xl text-sm font-black hover:bg-yellow-400 transition-all shadow-xl active:scale-95">
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
                    <td className="py-4 px-5 text-slate-500 font-black text-xs">{s.group}</td>
                    <td className="py-4 px-5 text-slate-900 bg-blue-50/10">{s.male}</td>
                    <td className="py-4 px-5 text-slate-900 bg-pink-50/10">{s.female}</td>
                    <td className="py-4 px-5 text-blue-600 font-black border-l-2 border-slate-100 tabular-nums bg-slate-50/50">
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
            <td className="py-5 px-4 md:py-7 md:px-10 text-center whitespace-nowrap space-x-2">
              {/* 기존 노쇼 버튼 */}
              <button onClick={() => toggleNoShow(r.id)} 
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${r.status === 'noshow' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                노쇼
              </button>

              {/* [추가] 체험 완료 버튼 */}
              <button onClick={() => markAsCompleted(r.id)} 
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${r.status === 'completed' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                체험완료
              </button>

              {/* [추가] 건별 삭제 버튼 */}
              <button onClick={() => deleteReservation(r.id)} 
                className="px-3 py-1.5 rounded-lg text-xs font-black uppercase bg-slate-800 text-white hover:bg-red-500 transition-all">
                삭제
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