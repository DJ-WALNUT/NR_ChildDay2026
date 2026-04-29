import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import * as XLSX from 'xlsx';
import AdminHeader from './AdminHeader'; 

const AdminDashboard = () => {
  const { boothId } = useParams();
  const navigate = useNavigate();
  
  const [reservations, setReservations] = useState([]);
  const [boothName, setBoothName] = useState("");
  const [boothInfo, setBoothInfo] = useState(null); // 전체 부스 정보 상태 추가

  // 수정 모드 상태 관리
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: '', mode: 'time', total_limit: 0, limit_per_slot: 0, start_hour: 11, end_hour: 16, slots_per_hour: 3
  });

  const fetchData = async () => {
    try {
      // 1. 예약 데이터 호출
      const resResponse = await fetch(`${API_BASE_URL}/api/booths/${boothId}/reservations`);
      const resData = await resResponse.json();
      setReservations(resData.reservations);
      setBoothName(resData.boothName);

      // 2. 부스 상세 설정 데이터 호출
      const boothResponse = await fetch(`${API_BASE_URL}/api/booths`);
      const boothList = await boothResponse.json();
      const currentBooth = boothList.find(b => b.id === parseInt(boothId));
      
      if (currentBooth) {
        setBoothInfo(currentBooth);
        setEditData({
          name: currentBooth.name,
          mode: currentBooth.mode,
          total_limit: currentBooth.total_limit,
          limit_per_slot: currentBooth.limit_per_slot,
          start_hour: currentBooth.start_hour,
          end_hour: currentBooth.end_hour,
          slots_per_hour: currentBooth.slots_per_hour
        });
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    }
  };

  useEffect(() => { fetchData(); }, [boothId]);

  // 부스 정보 업데이트 함수
  const handleUpdateBooth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/booths/${boothId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name,
          mode: editData.mode,
          total_limit: parseInt(editData.total_limit, 10),
          limit_per_slot: parseInt(editData.limit_per_slot, 10),
          start_hour: parseInt(editData.start_hour, 10),
          end_hour: parseInt(editData.end_hour, 10),
          slots_per_hour: parseInt(editData.slots_per_hour, 10)
        })
      });

      if (response.ok) {
        alert("부스 설정이 성공적으로 수정되었습니다.");
        setIsEditing(false);
        fetchData(); // 정보 새로고침
      } else {
        const err = await response.json();
        alert(`수정 실패: ${err.error}`);
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }
  };

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

  const toggleNoShow = async (id) => {
    await fetch(`${API_BASE_URL}/api/reservations/${id}/toggle`, { method: 'PATCH' });
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status: r.status === 'noshow' ? 'normal' : 'noshow' } : r));
  };

  const markAsCompleted = async (id) => {
    await fetch(`${API_BASE_URL}/api/reservations/${id}/complete`, { method: 'PATCH' });
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status: r.status === 'completed' ? 'normal' : 'completed' } : r));
  };

  const deleteReservation = async (id) => {
    if (!window.confirm("정말 이 신청 건을 삭제하시겠습니까?")) return;
    await fetch(`${API_BASE_URL}/api/reservations/${id}`, { method: 'DELETE' });
    setReservations(prev => prev.filter(r => r.id !== id));
  };

const sortedReservations = useMemo(() => {
    return [...reservations].sort((a, b) => {
      // 1. 타임이 완전히 동일한 경우 (예: 둘 다 "11시 A타임"이거나 둘 다 "선착순 접수"인 경우)
      // id 값(생성된 순서)을 비교하여 먼저 신청한 사람이 위로 오게 정렬
      if (a.time === b.time) {
        return a.id - b.id;
      }

      // 2. 타임이 다른 경우 기존처럼 숫자(시간) 우선 추출하여 비교
      const matchA = a.time.match(/\d+/);
      const matchB = b.time.match(/\d+/);

      if (matchA && matchB) {
        const timeA = parseInt(matchA[0]);
        const timeB = parseInt(matchB[0]);
        
        // 시간이 다르면 빠른 시간 순으로 정렬
        if (timeA !== timeB) return timeA - timeB;
        
        // 시간(숫자)은 같지만 텍스트가 다른 경우 (예: 11시 A타임 vs 11시 B타임)
        return a.time.localeCompare(b.time);
      }
      
      return a.time.localeCompare(b.time);
    });
  }, [reservations]);

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
    if (window.confirm("⚠️ 현재 부스의 데이터를 초기화 하시겠습니까?")) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/booths/${boothId}/clear`, { method: 'DELETE' });
        if (response.ok) {
          setReservations([]);
          alert("현재 부스의 데이터가 초기화되었습니다.");
        }
      } catch (error) {
        alert("삭제 실패: 서버 연결을 확인하세요.");
      }
    }
  };

  const inputStyle = "w-full px-4 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none font-bold text-slate-700 transition-all text-sm";
  const labelStyle = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1";

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 상단 대시보드 헤더 */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-7 bg-slate-900 text-white rounded-[2rem] shadow-2xl border-b-8 border-blue-600">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-sm uppercase ${boothInfo?.mode === 'fcfs' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {boothInfo?.mode === 'fcfs' ? '선착순' : '타임별'}
              </span>
              <h1 className="text-4xl font-black tracking-tighter leading-none">{boothName} <span className="text-blue-400 font-extrabold">현황</span></h1>
            </div>
            <p className="text-slate-400 font-bold text-sm">
              {boothInfo?.mode === 'fcfs' 
                ? `총 제한: ${boothInfo.total_limit}명` 
                : `운영: ${boothInfo?.start_hour}시~${boothInfo?.end_hour}시 (타임당 ${boothInfo?.limit_per_slot}명)`}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-700 pt-6 md:pt-0 md:pl-8 flex-wrap">
            <div className="flex-1 text-center md:text-left mr-4">
              <div className="text-s font-black text-slate-500 uppercase mb-1">전체 신청</div>
              <div className="text-4xl font-black text-blue-400 tabular-nums">{totalReservations}</div>
            </div>
            
            {/* 설정 수정 버튼 추가 */}
            <button onClick={() => setIsEditing(!isEditing)} className={`px-4 py-3 rounded-xl text-sm font-black transition-all shadow-lg ${isEditing ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
              {isEditing ? '수정 취소' : '설정 수정'}
            </button>
            <button onClick={exportToExcel} className="px-4 py-3 bg-white text-slate-900 rounded-xl text-sm font-black hover:bg-yellow-400 transition-all shadow-lg">
              엑셀 저장
            </button>
            <button onClick={clearAllData} className="px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-black hover:bg-red-700 transition-all shadow-lg">
              초기화
            </button>
          </div>
        </header>

        {/* 부스 설정 수정 패널 (isEditing이 true일 때만 표시) */}
        {isEditing && (
          <div className="bg-white p-6 rounded-[2rem] border-2 border-blue-200 shadow-xl animate-fade-in-down">
            <h3 className="text-lg font-black text-slate-800 mb-4 border-b pb-2">부스 설정 수정</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelStyle}>부스 이름</label>
                <input className={inputStyle} value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
              </div>
              
              <div>
                <label className={labelStyle}>운영 모드</label>
                <div className="flex gap-2">
                  <button onClick={() => setEditData({...editData, mode: "time"})} className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 ${editData.mode === 'time' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>타임별 예약</button>
                  <button onClick={() => setEditData({...editData, mode: "fcfs"})} className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 ${editData.mode === 'fcfs' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>현장 선착순</button>
                </div>
              </div>

              {editData.mode === 'time' ? (
                <div className="col-span-1 md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className={labelStyle}>시작 시각</label>
                    <input type="number" className={inputStyle} value={editData.start_hour} onChange={e => setEditData({...editData, start_hour: e.target.value})} />
                  </div>
                  <div>
                    <label className={labelStyle}>종료 시각</label>
                    <input type="number" className={inputStyle} value={editData.end_hour} onChange={e => setEditData({...editData, end_hour: e.target.value})} />
                  </div>
                  <div>
                    <label className={labelStyle}>시간당 타임수</label>
                    <input type="number" className={inputStyle} value={editData.slots_per_hour} onChange={e => setEditData({...editData, slots_per_hour: e.target.value})} />
                  </div>
                  <div>
                    <label className={labelStyle}>타임당 인원</label>
                    <input type="number" className={inputStyle} value={editData.limit_per_slot} onChange={e => setEditData({...editData, limit_per_slot: e.target.value})} />
                  </div>
                </div>
              ) : (
                <div className="col-span-1 md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className={labelStyle}>총 선착순 인원 제한</label>
                  <input type="number" className={inputStyle} value={editData.total_limit} onChange={e => setEditData({...editData, total_limit: e.target.value})} />
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsEditing(false)} className="px-6 py-3 rounded-xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200">취소</button>
              <button onClick={handleUpdateBooth} className="px-6 py-3 rounded-xl font-black bg-blue-600 text-white hover:bg-blue-700 shadow-lg">저장하기</button>
            </div>
          </div>
        )}

        {/* 연령별/성별 통계 표 섹션 */}
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
                  <th className="py-5 px-4 md:px-10 whitespace-nowrap">시간대</th>
                  <th className="py-5 px-4 md:px-10 whitespace-nowrap">이름</th>
                  <th className="py-5 px-4 md:px-10 whitespace-nowrap">식별번호</th>
                  <th className="py-5 px-4 md:px-10 whitespace-nowrap">연령대</th>
                  <th className="py-5 px-4 md:px-10 text-center whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-50">
                {sortedReservations.map(r => (
                  <tr key={r.id} className={`font-bold transition-all ${
                    r.status === 'noshow' ? 'bg-red-50/50 opacity-40 grayscale italic' : 
                    r.status === 'waiting' ? 'bg-orange-50/70' : // 관리자 페이지 대기자 행 강조
                    'hover:bg-blue-50/50'
                  }`}>
                    <td className="py-5 px-4 md:py-7 md:px-10 text-blue-600 font-black text-lg tabular-nums tracking-tighter whitespace-nowrap">{r.time}</td>
                    <td className="py-5 px-4 md:py-7 md:px-10 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                      <div className={`inline-block text-[9px] font-black uppercase px-1 py-0.5 rounded border ${r.gender === '남' ? 'text-blue-500 border-blue-200 bg-blue-50' : 'text-pink-500 border-pink-200 bg-pink-50'}`}>
                        {r.gender === '남' ? '남' : '여'}
                      </div>
                      <div className="text-slate-900 text-lg font-black mb-1">{r.name}</div>
                      </div>
                    </td>
                    <td className="py-5 px-4 md:py-7 md:px-10 text-slate-900 font-black whitespace-nowrap">{r.phone}</td>
                    <td className="py-5 px-4 md:py-7 md:px-10 text-slate-900 font-black whitespace-nowrap">{r.ageGroup}</td>
                    <td className="py-5 px-4 md:py-7 md:px-10 text-center whitespace-nowrap space-x-2">
                      {/* 대기자 뱃지 추가 */}
                      {r.status === 'waiting' && <span className="px-2 py-1 mr-2 rounded text-[10px] bg-orange-500 text-white font-black">대기중</span>}
                      <button onClick={() => toggleNoShow(r.id)} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${r.status === 'noshow' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}>노쇼</button>
                      <button onClick={() => markAsCompleted(r.id)} className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${r.status === 'completed' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}`}>체험완료</button>
                      <button onClick={() => deleteReservation(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-black uppercase bg-slate-800 text-white hover:bg-red-500 transition-all">삭제</button>
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