import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import AdminHeader from '../../components/AdminHeader';
import Footer from '../../components/Footer';

const AdminBoothBatch = () => {
  const [booths, setBooths] = useState([]);
  const [events, setEvents] = useState([]); // [추가] 행사 목록 상태
  const [filterEventId, setFilterEventId] = useState("all"); // [추가] 필터 상태
  
  // 배치 관리를 위한 State
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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
      
      setBooths(boothData.sort((a, b) => b.id - a.id));
      setEvents(eventData.sort((a, b) => b.id - a.id));
    } catch (e) {
      console.error("데이터 로드 실패", e);
    }
  };

  useEffect(() => { fetchData(); }, []);

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

  // [추가] 현재 필터링된 부스 목록 계산
  const filteredBooths = filterEventId === "all" 
    ? booths 
    : booths.filter(b => b.event_id === parseInt(filterEventId));

  // --- 배치 처리 함수 ---
  const handleBatchStatus = async (targetStatus) => {
    if (selectedIds.length === 0) {
      alert("선택된 부스가 없습니다.");
      return;
    }

    const actionText = targetStatus ? "운영 중" : "마감";
    if (!window.confirm(`선택한 ${selectedIds.length}개의 부스를 [${actionText}] 상태로 변경하시겠습니까?`)) return;

    try {
      const promises = booths
        .filter(b => selectedIds.includes(b.id) && b.is_active !== targetStatus)
        .map(b => fetch(`${API_BASE_URL}/api/booths/${b.id}/toggle`, { method: 'PATCH' }));

      await Promise.all(promises);
      alert("상태 변경이 완료되었습니다.");
      setSelectedIds([]); // 선택 초기화
      fetchData(); // 목록 갱신
    } catch (error) {
      alert("일부 부스 상태 변경에 실패했습니다.");
    }
  };

  // [수정] 전체 선택 시 '현재 필터링된 목록'의 부스들만 선택되도록 변경
  const handleSelectAll = () => setSelectedIds(filteredBooths.map(b => b.id));
  
  const handleDeselectAll = () => setSelectedIds([]);
  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
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

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader />
      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">

        {/* --- 행사 필터 및 배치 관리 섹션 --- */}
        <div className="bg-white p-6 rounded-[2rem] border-2 border-blue-500 shadow-lg sticky top-20 z-40 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="bg-blue-500 text-white p-1.5 rounded-lg text-xs">BATCH</span>
              여러 부스 일괄 관리
            </h3>
            
            {/* [추가] 행사 필터링 드롭다운 */}
            <div className="w-full md:w-64">
              <select 
                className="w-full px-4 py-2 bg-slate-50 border-2 border-slate-200 text-slate-700 font-black rounded-xl outline-none focus:border-blue-500 shadow-sm cursor-pointer transition-all"
                value={filterEventId}
                onChange={(e) => {
                  setFilterEventId(e.target.value);
                  setSelectedIds([]); // 필터를 바꾸면 선택된 항목 초기화
                }}
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
          
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="text-sm font-bold text-slate-500 w-full md:w-auto">
              현재 <span className="text-blue-600">{filteredBooths.length}</span>개의 부스 중 <span className="text-blue-600">{selectedIds.length}</span>개 선택됨
            </div>
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
              <span>{selectedIds.length === 0 ? "부스를 다중 선택하려면 클릭하세요 (필터링된 목록 기준)" : `${selectedIds.length}개의 부스 선택됨`}</span>
              <span>{isBatchDropdownOpen ? "▲" : "▼"}</span>
            </button>
            
            {isBatchDropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-2 bg-white border-2 border-slate-200 rounded-2xl shadow-2xl z-50 p-4 max-h-80 overflow-y-auto">
                <div className="flex gap-2 mb-3 pb-3 border-b sticky top-0 bg-white">
                  <button onClick={handleSelectAll} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black hover:bg-blue-100">현재 목록 전체 선택</button>
                  <button onClick={handleDeselectAll} className="px-3 py-2 bg-slate-100 text-slate-500 rounded-lg text-xs font-black hover:bg-slate-200">선택 해제</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {/* [수정] filteredBooths 기준으로 매핑 */}
                  {filteredBooths.length === 0 ? (
                    <div className="col-span-1 md:col-span-2 text-center text-slate-400 font-bold text-sm py-4">해당 행사에 부스가 없습니다.</div>
                  ) : (
                    filteredBooths.map(b => (
                      <label key={b.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer border border-transparent hover:border-slate-200">
                        <input 
                          type="checkbox" className="w-4 h-4 shrink-0 accent-blue-600"
                          checked={selectedIds.includes(b.id)}
                          onChange={() => toggleSelection(b.id)}
                        />
                        <div className="truncate">
                          {filterEventId === "all" && <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 mr-1 rounded">{b.event_name}</span>}
                          <span className="text-sm font-bold">{b.name}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- 부스 목록 --- */}
        <div className="grid gap-4">
          <h3 className="text-lg font-black text-slate-800 mb-2 ml-2">부스 목록 ({filteredBooths.length}개)</h3>
          {filteredBooths.map(booth => (
            <div key={booth.id} className={`bg-white p-6 rounded-[1.5rem] border-2 flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm hover:shadow-md transition-all ${selectedIds.includes(booth.id) ? 'border-blue-500 bg-blue-50/30' : 'border-transparent'}`}>
              <div className="flex items-center gap-4 flex-1 overflow-hidden">
                <input 
                  type="checkbox" className="w-5 h-5 shrink-0 accent-blue-600 cursor-pointer"
                  checked={selectedIds.includes(booth.id)}
                  onChange={() => toggleSelection(booth.id)}
                />
                <div onClick={() => navigate(`/manage/booths/${booth.id}`)} className="cursor-pointer flex-1">
                  
                  {/* [추가] 소속 행사 라벨 */}
                  <div className="mb-2">
                     <span className="text-[10px] font-black px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        {booth.event_name}
                     </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] shrink-0 font-black px-2 py-0.5 rounded-sm uppercase ${booth.mode === 'fcfs' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>
                      {booth.mode === 'fcfs' ? '선착순' : '타임별'}
                    </span>
                    <h3 className="text-xl font-black text-slate-900">{booth.name}</h3>
                  </div>
                  <p className="text-slate-500 font-bold text-sm">
                    현재 신청 인원: <span className="text-blue-600 font-black">{booth.count}</span>명
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto shrink-0">
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

export default AdminBoothBatch;