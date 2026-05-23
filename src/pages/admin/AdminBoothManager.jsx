import React, { useState, useEffect, useRef } from 'react'; // useRef 추가
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import AdminHeader from '../../components/AdminHeader';
import Footer from '../../components/Footer';

const AdminBoothManager = () => {
  const [booths, setBooths] = useState([]);
  const [newBoothName, setNewBoothName] = useState("");
  const [newBoothMode, setNewBoothMode] = useState("time");
  
  // 배치 관리를 위한 State
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 상세 설정용 State
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
      const sortedData = data.sort((a, b) => b.id - a.id);
      setBooths(sortedData);
    } catch (e) {
      console.error("부스 목록 로드 실패", e);
    }
  };

  useEffect(() => { fetchBooths(); }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsBatchDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- 배치 처리 함수 ---
  const handleBatchStatus = async (targetStatus) => {
    if (selectedIds.length === 0) {
      alert("선택된 부스가 없습니다.");
      return;
    }

    const actionText = targetStatus ? "운영 중" : "마감";
    if (!window.confirm(`선택한 ${selectedIds.length}개의 부스를 [${actionText}] 상태로 변경하시겠습니까?`)) return;

    try {
      // 모든 부스에 대해 순차적으로 혹은 병렬로 상태 변경 요청
      // 백엔드에 벌크 업데이트 API가 없다면 개별 toggle 요청을 보냅니다.
      // targetStatus에 맞춰 변경하기 위해 현재 상태를 확인 후 다를 때만 toggle 합니다.
      const promises = booths
        .filter(b => selectedIds.includes(b.id) && b.is_active !== targetStatus)
        .map(b => fetch(`${API_BASE_URL}/api/booths/${b.id}/toggle`, { method: 'PATCH' }));

      await Promise.all(promises);
      alert("상태 변경이 완료되었습니다.");
      setSelectedIds([]); // 선택 초기화
      fetchBooths(); // 목록 갱신
    } catch (error) {
      alert("일부 부스 상태 변경에 실패했습니다.");
    }
  };

  const handleSelectAll = () => setSelectedIds(booths.map(b => b.id));
  const handleDeselectAll = () => setSelectedIds([]);
  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  // --- 기존 함수들 ---
  const addBooth = async () => {
    if (!newBoothName.trim()) { alert("부스 이름을 입력해주세요."); return; }
    const payload = {
      name: newBoothName, mode: newBoothMode,
      total_limit: parseInt(totalLimit, 10) || 0,
      limit_per_slot: parseInt(limitPerSlot, 10) || 0,
      start_hour: parseInt(startHour, 10) || 11,
      end_hour: parseInt(endHour, 10) || 16,
      slots_per_hour: parseInt(slotsPerHour, 10) || 1
    };
    try {
      const response = await fetch(`${API_BASE_URL}/api/booths`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) { setNewBoothName(""); fetchBooths(); alert("부스가 추가되었습니다."); }
    } catch (error) { alert("서버 연결 실패"); }
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
        
        {/* --- 신규 부스 추가 폼 (기존과 동일) --- */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border-2 border-slate-900 shadow-xl space-y-6">
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter border-b-2 border-slate-100 pb-4">새 부스 만들기</h2>
          <div className="space-y-4">
            <div>
              <label className={labelStyle}>부스 이름</label>
              <input className={inputStyle} placeholder="부스 이름 입력" value={newBoothName} onChange={(e) => setNewBoothName(e.target.value)} />
            </div>
            <div>
              <label className={labelStyle}>운영 모드</label>
              <div className="flex gap-2">
                <button onClick={() => setNewBoothMode("time")} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${newBoothMode === 'time' ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>⏱️ 타임별 예약</button>
                <button onClick={() => setNewBoothMode("fcfs")} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${newBoothMode === 'fcfs' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>🏃‍♂️ 현장 선착순</button>
              </div>
            </div>
            {/* ... 중략 (조건부 렌더링 설정 부분은 기존 유지) ... */}
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
                </div>
              )}
            </div>
            <button onClick={addBooth} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-lg hover:bg-slate-800 transition-colors shadow-xl">부스 추가하기</button>
          </div>
        </div>

        {/* --- 배치 관리 섹션 (신규 추가) --- */}
        <div className="bg-white p-6 rounded-[2rem] border-2 border-blue-500 shadow-lg sticky top-20 z-40 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="bg-blue-500 text-white p-1.5 rounded-lg text-xs">BATCH</span>
              여러 부스 일괄 관리
            </h3>
            <div className="flex gap-2 w-full md:w-auto">
              <button onClick={() => handleBatchStatus(true)} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 shadow-md">일괄 운영시작</button>
              <button onClick={() => handleBatchStatus(false)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 shadow-md">일괄 마감처리</button>
            </div>
          </div>
          
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsBatchDropdownOpen(!isBatchDropdownOpen)}
              className="w-full flex justify-between items-center px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-700"
            >
              <span>{selectedIds.length === 0 ? "부스를 다중 선택하려면 클릭하세요" : `${selectedIds.length}개의 부스 선택됨`}</span>
              <span>{isBatchDropdownOpen ? "▲" : "▼"}</span>
            </button>
            {isBatchDropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white border-2 border-slate-200 rounded-2xl shadow-2xl z-50 p-4 max-h-60 overflow-y-auto">
                <div className="flex gap-2 mb-3 pb-3 border-b">
                  <button onClick={handleSelectAll} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black">전체 선택</button>
                  <button onClick={handleDeselectAll} className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-black">선택 해제</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {booths.map(b => (
                    <label key={b.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                      <input 
                        type="checkbox" className="w-4 h-4 shrink-0 accent-blue-600"
                        checked={selectedIds.includes(b.id)}
                        onChange={() => toggleSelection(b.id)}
                      />
                      <span className="text-sm font-bold truncate">{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- 부스 목록 --- */}
        <div className="grid gap-4">
          <h3 className="text-lg font-black text-slate-800 mb-2 ml-2">부스 목록 ({booths.length}개)</h3>
          {booths.map(booth => (
            <div key={booth.id} className={`bg-white p-6 rounded-[1.5rem] border-2 flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm hover:shadow-md transition-all ${selectedIds.includes(booth.id) ? 'border-blue-500 bg-blue-50/30' : 'border-transparent'}`}>
              <div className="flex items-center gap-4 flex-1">
                {/* 리스트 내 개별 체크박스 */}
                <input 
                  type="checkbox" className="w-5 h-5 shrink-0 accent-blue-600 cursor-pointer"
                  checked={selectedIds.includes(booth.id)}
                  onChange={() => toggleSelection(booth.id)}
                />
                <div onClick={() => navigate(`/manage/booths/${booth.id}`)} className="cursor-pointer">
                  <div className="flex items-center gap-2 mb-1 ">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-sm break-keep uppercase ${booth.mode === 'fcfs' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>
                      {booth.mode === 'fcfs' ? '선착순' : '타임별'}
                    </span>
                    <h3 className="text-xl font-black text-slate-900">{booth.name}</h3>
                  </div>
                  <p className="text-slate-500 font-bold text-sm">
                    현재 신청 인원: <span className="text-blue-600 font-black">{booth.count}</span>명
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => toggleBooth(booth.id)} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all ${booth.is_active ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-50 text-red-500 border border-red-100'}`}>
                  {booth.is_active ? "운영 중" : "마감됨"}
                </button>
                <button onClick={() => deleteBooth(booth.id)} className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white transition-all">삭제</button>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminBoothManager;