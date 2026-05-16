import React, { useState, useEffect, useMemo, useRef } from 'react';
import { API_BASE_URL } from '../../config';
import AdminHeader from '../../components/AdminHeader';
import Footer from '../../components/Footer';

const AdminSummary = () => {
  const [booths, setBooths] = useState([]);
  const [allReservations, setAllReservations] = useState([]);
  const [selectedBooths, setSelectedBooths] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 데이터 로드: 부스 목록과 모든 부스의 예약 데이터를 가져옵니다.
  const fetchData = async () => {
    try {
      const boothRes = await fetch(`${API_BASE_URL}/api/booths`);
      const boothData = await boothRes.json();
      setBooths(boothData);

      // 초기값: 모든 부스 선택
      const allBoothIds = boothData.map(b => b.id);
      setSelectedBooths(allBoothIds);

      // 모든 부스의 예약 데이터를 병렬로 호출하여 하나의 배열로 평탄화합니다.
      const allResPromises = boothData.map(async (booth) => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/booths/${booth.id}/reservations`);
          const data = await res.json();
          return data.reservations.map(r => ({ ...r, booth_id: booth.id }));
        } catch (e) {
          console.error(`${booth.name} 데이터 로드 실패:`, e);
          return [];
        }
      });

      const resolvedRes = await Promise.all(allResPromises);
      setAllReservations(resolvedRes.flat());
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 선택된 부스의 예약 데이터만 필터링
  const filteredReservations = useMemo(() => {
    return allReservations.filter(r => selectedBooths.includes(r.booth_id));
  }, [allReservations, selectedBooths]);

  // 통계 계산 로직 (AdminDetail.jsx와 동일)
  const stats = useMemo(() => {
    const ageGroups = ["0~8세", "9~13세", "14~16세", "17~19세", "20~24세", "24세 이상"];
    return ageGroups.map(group => {
      const groupRes = filteredReservations.filter(r => r.ageGroup === group && r.status !== 'noshow');
      return {
        group,
        male: groupRes.filter(r => r.gender === '남').length,
        female: groupRes.filter(r => r.gender === '여').length,
        total: groupRes.length
      };
    });
  }, [filteredReservations]);

  const totalReservations = useMemo(() => 
    filteredReservations.filter(r => r.status !== 'noshow').length, 
  [filteredReservations]);

  // 핸들러 함수들
  const handleSelectAll = () => setSelectedBooths(booths.map(b => b.id));
  const handleDeselectAll = () => setSelectedBooths([]);
  const handleToggleBooth = (id) => {
    setSelectedBooths(prev => 
      prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader />
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* 상단 헤더 */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-7 bg-slate-900 text-white rounded-[2rem] shadow-2xl border-b-8 border-green-500">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-sm bg-green-500 text-white break-keep uppercase">
                통계 모아보기
              </span>
              <h1 className="text-4xl font-black tracking-tighter leading-none">전체 부스 <span className="text-green-400 font-extrabold">합계실적</span></h1>
            </div>
            <p className="text-slate-400 font-bold text-sm mt-2">
              선택된 부스 수: {selectedBooths.length} / {booths.length}개
            </p>
          </div>
          
          <div className="flex flex-col items-center md:items-end w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-700 pt-6 md:pt-0 md:pl-8">
            <div className="text-s font-black text-slate-500 uppercase mb-1">합계 신청 인원</div>
            <div className="text-5xl font-black text-green-400 tabular-nums">{totalReservations}<span className="text-2xl text-slate-500 ml-2">명</span></div>
          </div>
        </header>

        {/* 컨트롤 패널 (드롭다운) */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-slate-800">합계에 포함할 부스 선택</h3>
            <div className="flex gap-2">
              <button onClick={handleSelectAll} className="px-4 py-2 text-sm font-bold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">전체 선택</button>
              <button onClick={handleDeselectAll} className="px-4 py-2 text-sm font-bold bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors">전체 해제</button>
            </div>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex justify-between items-center px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl hover:border-slate-300 font-bold text-slate-700 transition-all"
            >
              <span>부스 선택 목록 열기 ({selectedBooths.length}개 선택됨)</span>
              <span className={`transform transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-xl z-20 max-h-80 overflow-y-auto p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {booths.map(booth => (
                  <label key={booth.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 shrink-0 accent-green-500 rounded cursor-pointer"
                      checked={selectedBooths.includes(booth.id)}
                      onChange={() => handleToggleBooth(booth.id)}
                    />
                    <span className="font-bold text-slate-800 select-none truncate text-sm">{booth.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 연령별/성별 통계 표 섹션 (AdminDetail과 동일한 UI) */}
        <section className="bg-white rounded-[2rem] shadow-xl border-4 border-slate-900 overflow-hidden">
          <div className="bg-slate-900 px-8 py-4">
            <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <span>📊</span> 합산 연령 및 성별 총계
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
                    <td className="py-4 px-5 text-green-600 font-black border-l-2 border-slate-100 tabular-nums bg-slate-50/50">
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
                  <td className="py-6 px-6 text-s text-green-400 border-l-2 border-slate-700">
                    {totalReservations}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

      </div>
      <Footer />
    </div>
  );
};

export default AdminSummary;