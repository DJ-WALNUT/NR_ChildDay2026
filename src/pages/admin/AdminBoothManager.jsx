import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import AdminHeader from './AdminHeader';

const AdminBoothManager = () => {
  const [booths, setBooths] = useState([]);
  const [newBoothName, setNewBoothName] = useState("");
  const [newBoothMode, setNewBoothMode] = useState("time");
  
  // 상세 설정용 State 추가
  const [totalLimit, setTotalLimit] = useState(100);
  const [limitPerSlot, setLimitPerSlot] = useState(5);
  const [startHour, setStartHour] = useState(11);
  const [endHour, setEndHour] = useState(16);
  const [slotsPerHour, setSlotsPerHour] = useState(3);

  const navigate = useNavigate();

  const fetchBooths = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/booths`);
      const data = await res.json();
      setBooths(data);
    } catch (e) {
      console.error("부스 목록 로드 실패", e);
    }
  };

  useEffect(() => { fetchBooths(); }, []);

  const addBooth = async () => {
    if (!newBoothName.trim()) {
      alert("부스 이름을 입력해주세요.");
      return;
    }

    // State에 입력된 값을 숫자 형태로 변환하여 전송 페이로드 구성
    const payload = {
      name: newBoothName,
      mode: newBoothMode,
      total_limit: parseInt(totalLimit, 10) || 0,
      limit_per_slot: parseInt(limitPerSlot, 10) || 0,
      start_hour: parseInt(startHour, 10) || 11,
      end_hour: parseInt(endHour, 10) || 16,
      slots_per_hour: parseInt(slotsPerHour, 10) || 1
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/booths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setNewBoothName("");
        fetchBooths();
        alert("부스가 성공적으로 추가되었습니다.");
      } else {
        const errData = await response.json();
        alert(`추가 실패: ${errData.error}`);
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }
  };

  const toggleBooth = async (id) => {
    await fetch(`${API_BASE_URL}/api/booths/${id}/toggle`, { method: 'PATCH' });
    fetchBooths();
  };

  const deleteBooth = async (id) => {
    if (!window.confirm("부스와 모든 예약 데이터가 삭제됩니다.")) return;
    await fetch(`${API_BASE_URL}/api/booths/${id}`, { method: 'DELETE' });
    fetchBooths();
  };

  const inputStyle = "w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold text-slate-700 transition-all";
  const labelStyle = "block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1";

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader />
      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* --- 신규 부스 추가 폼 카드 --- */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border-2 border-slate-900 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">새 부스 만들기</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelStyle}>부스 이름</label>
              <input 
                className={inputStyle}
                placeholder="예: 페이스 페인팅, 코딩 체험 등"
                value={newBoothName}
                onChange={(e) => setNewBoothName(e.target.value)}
              />
            </div>

            <div>
              <label className={labelStyle}>운영 모드 선택</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setNewBoothMode("time")}
                  className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${newBoothMode === 'time' ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                >
                  ⏱️ 타임별 예약
                </button>
                <button 
                  onClick={() => setNewBoothMode("fcfs")}
                  className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${newBoothMode === 'fcfs' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                >
                  🏃‍♂️ 현장 선착순
                </button>
              </div>
            </div>

            {/* 조건부 렌더링: 타임별 설정 vs 선착순 설정 */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
              {newBoothMode === 'time' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className={labelStyle}>시작 시각</label>
                    <div className="relative">
                      <input type="number" min="0" max="23" className={inputStyle} value={startHour} onChange={e => setStartHour(e.target.value)} />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">시</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelStyle}>종료 시각</label>
                    <div className="relative">
                      <input type="number" min="0" max="24" className={inputStyle} value={endHour} onChange={e => setEndHour(e.target.value)} />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">시</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelStyle}>시간당 타임수</label>
                    <div className="relative">
                      <input type="number" min="1" className={inputStyle} value={slotsPerHour} onChange={e => setSlotsPerHour(e.target.value)} />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">개</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelStyle}>타임당 인원</label>
                    <div className="relative">
                      <input type="number" min="1" className={inputStyle} value={limitPerSlot} onChange={e => setLimitPerSlot(e.target.value)} />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">명</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full md:w-1/2">
                  <label className={labelStyle}>총 선착순 인원 제한</label>
                  <div className="relative">
                    <input type="number" min="1" className={inputStyle} value={totalLimit} onChange={e => setTotalLimit(e.target.value)} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">명</span>
                  </div>
                  <p className="text-xs font-bold text-blue-500 mt-2 ml-1">해당 인원 도달 시 자동으로 신청이 마감됩니다.</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={addBooth} 
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-lg hover:bg-slate-800 transition-colors shadow-xl active:scale-[0.98]"
            >
              부스 추가하기
            </button>
          </div>
        </div>

        {/* --- 생성된 부스 목록 --- */}
        <div className="grid gap-4">
          <h3 className="text-lg font-black text-slate-800 mb-2 ml-2">개설된 부스 목록 ({booths.length})</h3>
          {booths.map(booth => (
            <div key={booth.id} className="bg-white p-6 rounded-[1.5rem] border flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div onClick={() => navigate(`/manage/booths/${booth.id}`)} className="cursor-pointer flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-sm uppercase ${booth.mode === 'fcfs' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>
                    {booth.mode === 'fcfs' ? '선착순' : '타임별'}
                  </span>
                  <h3 className="text-xl font-black text-slate-900">{booth.name}</h3>
                </div>
                <p className="text-slate-500 font-bold text-sm">
                  현재 신청 인원: <span className="text-blue-600 font-black">{booth.count}</span>명
                  {booth.mode === 'fcfs' ? ` / 최대 ${booth.total_limit}명` : ` (타임당 ${booth.limit_per_slot}명 제한)`}
                </p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={() => toggleBooth(booth.id)} 
                  className={`flex-1 md:flex-none px-4 py-3 md:py-2 rounded-xl text-sm font-bold transition-all ${booth.is_active ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-50 text-red-500 border border-red-100'}`}
                >
                  {booth.is_active ? "운영 중" : "마감됨"}
                </button>
                <button 
                  onClick={() => deleteBooth(booth.id)} 
                  className="px-4 py-3 md:py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white transition-all"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminBoothManager;