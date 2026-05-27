import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import AdminHeader from '../../components/AdminHeader';
import Footer from '../../components/Footer';

const AdminBoothList = () => {
  const [booths, setBooths] = useState([]);
  const [events, setEvents] = useState([]); // [추가] 행사 목록 상태

  // 신규 부스용 State
  const [newEventId, setNewEventId] = useState(""); // [추가] 새 부스의 행사 ID
  const [newBoothName, setNewBoothName] = useState("");
  const [newBoothMode, setNewBoothMode] = useState("time");
  
  // 상세 설정용 State
  const [totalLimit, setTotalLimit] = useState(100);
  const [limitPerSlot, setLimitPerSlot] = useState(5);
  const [startHour, setStartHour] = useState(11);
  const [endHour, setEndHour] = useState(16);
  const [slotsPerHour, setSlotsPerHour] = useState(3);

  // [추가] 목록 필터링용 State
  const [filterEventId, setFilterEventId] = useState("all");

  const navigate = useNavigate();

  // 부스와 행사 데이터를 동시에 불러옵니다.
  const fetchData = async () => {
    try {
      const [boothRes, eventRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/booths`),
        fetch(`${API_BASE_URL}/api/events`)
      ]);
      const boothData = await boothRes.json();
      const eventData = await eventRes.json();

      // id 기준 내림차순 정렬
      setBooths(boothData.sort((a, b) => b.id - a.id));
      setEvents(eventData.sort((a, b) => b.id - a.id));

      // 기본 행사 세팅 (새 부스 추가 폼의 드롭다운 기본값)
      if (eventData.length > 0 && !newEventId) {
        setNewEventId(eventData[eventData.length - 1].id); // 보통 1번(기본행사)이나 최신행사를 기본으로
      }
    } catch (e) {
      console.error("데이터 로드 실패", e);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const addBooth = async () => {
    if (!newBoothName.trim()) {
      alert("부스 이름을 입력해주세요.");
      return;
    }
    if (!newEventId) {
      alert("부스가 소속될 행사를 선택해주세요.");
      return;
    }

    // [수정] event_id 포함하여 페이로드 전송
    const payload = {
      event_id: parseInt(newEventId, 10),
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
        fetchData(); // 갱신
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
    fetchData();
  };

  const deleteBooth = async (id) => {
    if (!window.confirm("부스와 모든 예약 데이터가 삭제됩니다.")) return;
    await fetch(`${API_BASE_URL}/api/booths/${id}`, { method: 'DELETE' });
    fetchData();
  };

  // [추가] 필터링된 부스 목록 계산
  const filteredBooths = filterEventId === "all" 
    ? booths 
    : booths.filter(b => b.event_id === parseInt(filterEventId));

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
            
            {/* [추가] 행사 선택 드롭다운 */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className={labelStyle}>소속 행사 그룹</label>
                <select 
                  className={inputStyle}
                  value={newEventId}
                  onChange={(e) => setNewEventId(e.target.value)}
                >
                  <option value="" disabled>행사를 선택하세요</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-[2]">
                <label className={labelStyle}>부스 이름</label>
                <input 
                  className={inputStyle}
                  placeholder="예: 페이스 페인팅, 코딩 체험 등"
                  value={newBoothName}
                  onChange={(e) => setNewBoothName(e.target.value)}
                />
              </div>
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

        {/* --- 개설된 부스 목록 --- */}
        <div className="grid gap-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-2 ml-2 gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-800">부스 목록 ({filteredBooths.length}개)</h3>
              <p className="text-slate-500 font-bold text-sm">개설된 최신순으로 정렬됩니다.</p>
            </div>
            
            {/* [추가] 목록 행사 필터 드롭다운 */}
            <div className="w-full md:w-64">
              <select 
                className="w-full px-4 py-2 bg-white border-2 border-blue-400 text-blue-700 font-black rounded-xl outline-none shadow-sm cursor-pointer"
                value={filterEventId}
                onChange={(e) => setFilterEventId(e.target.value)}
              >
                <option value="all">모든 행사 부스 보기</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredBooths.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border border-slate-200 text-slate-400 font-bold">
              이 행사에 등록된 부스가 없습니다.
            </div>
          ) : (
            filteredBooths.map(booth => (
              <div key={booth.id} className="bg-white p-6 rounded-[1.5rem] border flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div onClick={() => navigate(`/manage/booths/${booth.id}`)} className="cursor-pointer flex-1">
                  
                  {/* [추가] 소속 행사 라벨 표시 */}
                  <div className="mb-2">
                     <span className="text-[10px] font-black px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        {booth.event_name}
                     </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1 ">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-sm break-keep uppercase ${booth.mode === 'fcfs' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>
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
            ))
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminBoothList;