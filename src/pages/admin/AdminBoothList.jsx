import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import * as XLSX from 'xlsx';
import AdminHeader from '../../components/AdminHeader';
import Footer from '../../components/Footer';

const AdminBoothList = () => {
  const [booths, setBooths] = useState([]);
  const [events, setEvents] = useState([]);

  // 신규 부스용 State
  const [newEventId, setNewEventId] = useState("");
  const [newBoothName, setNewBoothName] = useState("");
  const [newBoothMode, setNewBoothMode] = useState("time");
  
  // 상세 설정용 State
  const [totalLimit, setTotalLimit] = useState(100);
  const [limitPerSlot, setLimitPerSlot] = useState(5);
  const [startHour, setStartHour] = useState(11);
  const [endHour, setEndHour] = useState(16);
  const [slotsPerHour, setSlotsPerHour] = useState(3);

  const [filterEventId, setFilterEventId] = useState("all");
  // [추가] 검색어 상태 관리
  const [searchTerm, setSearchTerm] = useState("");

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

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

      if (eventData.length > 0 && !newEventId) {
        setNewEventId(eventData[eventData.length - 1].id);
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

    const payload = {
      event_id: parseInt(newEventId, 10),
      name: newBoothName,
      mode: newBoothMode,
      use_waitlist: false,
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
        fetchData();
        alert("부스가 성공적으로 추가되었습니다.");
      } else {
        const errData = await response.json();
        alert(`추가 실패: ${errData.error}`);
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }
  };

  const downloadTemplate = () => {
    const wsData = [
      ["행사코드", "부스이름", "운영모드", "선착순 인원제한", "시작시각", "종료시각", "시간당 타임수", "타임당 인원"],
      [1, "페이스페인팅", "선착순", 100, "", "", "", ""],
      [1, "로봇 코딩 체험", "타임별", "", 10, 15, 2, 10]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "부스일괄추가양식");
    XLSX.writeFile(wb, "부스_대량추가_양식.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const validEventIds = events.map(ev => ev.id);
        const failedBooths = [];
        const promises = [];

        for (const row of data) {
          const eventId = parseInt(row['행사코드'], 10);
          const name = row['부스이름'];
          const rawMode = row['운영모드'] ? String(row['운영모드']).trim() : "";

          if (!eventId || !validEventIds.includes(eventId)) {
            failedBooths.push(`[${name || '이름 누락'}] 사유: 존재하지 않거나 잘못된 행사코드(${row['행사코드']})`);
            continue;
          }
          if (!name || name.trim() === '') {
            failedBooths.push(`[이름 누락 부스] 사유: 부스 이름이 없습니다. (행사코드 ${eventId})`);
            continue;
          }

          let parsedMode = 'fcfs';
          let totalLimit = 100;
          let startHour = 11;
          let endHour = 16;
          let slotsPerHour = 3;
          let limitPerSlot = 0;

          if (rawMode === '타임별' || rawMode === '타임별 예약') {
            parsedMode = 'time';
            totalLimit = 0;
            startHour = parseInt(row['시작시각'], 10) || 11;
            endHour = parseInt(row['종료시각'], 10) || 16;
            slotsPerHour = parseInt(row['시간당 타임수'], 10) || 3;
            limitPerSlot = parseInt(row['타임당 인원'], 10) || 0;
          } else {
            if (row['선착순 인원제한'] !== undefined && row['선착순 인원제한'] !== "") {
              totalLimit = parseInt(row['선착순 인원제한'], 10) || 100;
            }
          }

          const payload = {
            event_id: eventId,
            name: name.trim(),
            mode: parsedMode,
            use_waitlist: false,
            total_limit: totalLimit,
            start_hour: startHour,
            end_hour: endHour,
            slots_per_hour: slotsPerHour,
            limit_per_slot: limitPerSlot
          };

          promises.push(
            fetch(`${API_BASE_URL}/api/booths`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            }).then(async res => {
               if(!res.ok) {
                 failedBooths.push(`[${name}] 사유: 서버 거부 (동일 이름 중복 등)`);
               }
            }).catch(() => {
               failedBooths.push(`[${name}] 사유: 네트워크 오류`);
            })
          );
        }

        if (promises.length === 0 && failedBooths.length === 0) {
          alert("업로드된 엑셀 파일에 유효한 부스 데이터가 없습니다.");
          return;
        }

        await Promise.all(promises);
        fetchData();

        if (failedBooths.length > 0) {
          alert(`작업 완료. 단, 일부 부스 추가에 실패했습니다.\n\n[실패 목록]\n${failedBooths.join('\n')}`);
        } else {
          alert("모든 부스 입력이 성공적으로 완료되었습니다.");
        }

      } catch (error) {
        alert("엑셀 파일을 읽는 도중 오류가 발생했습니다. 양식을 확인해주세요.");
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
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

  // 현재 목록에 보이는 부스들의 링크를 엑셀로 다운로드
  const downloadBoothLinks = () => {
    if (filteredBooths.length === 0) {
      alert("내려받을 부스가 없습니다.");
      return;
    }

    const SITE_URL = "https://nrbooth.team-cluster.kr";
    const wsData = [
      ["행사이름", "부스이름", "관리자링크", "신청서링크"],
      ...filteredBooths.map(b => [
        b.event_name,
        b.name,
        `${SITE_URL}/manage/booths/${b.id}`,
        `${SITE_URL}/reserve/${b.id}`
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 48 }, { wch: 48 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "부스링크목록");

    const eventLabel = filterEventId === "all"
      ? "전체"
      : (events.find(ev => ev.id === parseInt(filterEventId))?.name || "행사");
    XLSX.writeFile(wb, `부스링크목록_${eventLabel}.xlsx`);
  };

  // [수정] 행사 필터와 검색어 필터를 동시에 적용
  const filteredBooths = booths.filter(b => {
    const matchEvent = filterEventId === "all" || b.event_id === parseInt(filterEventId);
    const matchSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchEvent && matchSearch;
  });

  const inputStyle = "w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold text-slate-700 transition-all";
  const numberInputStyle = "w-full pl-4 pr-12 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold text-slate-700 transition-all";
  const labelStyle = "block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1";

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader />
      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* --- 신규 부스 추가 폼 카드 --- */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] border-2 border-slate-900 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b-2 border-slate-100 pb-4 gap-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">새 부스 만들기</h2>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={downloadTemplate}
                className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all border border-slate-200"
              >
                엑셀 양식 다운로드
              </button>
              
              <button 
                onClick={() => fileInputRef.current.click()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-all shadow-md flex items-center gap-2"
              >
                <span>📗</span> 엑셀파일로 일괄등록
              </button>
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className={labelStyle}>소속 행사 그룹</label>
                <select className={inputStyle} value={newEventId} onChange={(e) => setNewEventId(e.target.value)}>
                  <option value="" disabled>행사를 선택하세요</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-[2]">
                <label className={labelStyle}>부스 이름</label>
                <input className={inputStyle} placeholder="예: 페이스 페인팅, 코딩 체험 등" value={newBoothName} onChange={(e) => setNewBoothName(e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelStyle}>운영 모드 선택</label>
              <div className="flex gap-2">
                <button onClick={() => setNewBoothMode("time")} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${newBoothMode === 'time' ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>⏱️ 타임별 예약</button>
                <button onClick={() => setNewBoothMode("fcfs")} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${newBoothMode === 'fcfs' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>🏃‍♂️ 현장 선착순</button>
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
              {newBoothMode === 'time' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className={labelStyle}>시작 시각</label>
                    <div className="relative flex items-center">
                      <input type="number" min="0" max="23" className={numberInputStyle} value={startHour} onChange={e => setStartHour(e.target.value)} />
                      <span className="absolute right-4 font-bold text-slate-400 pointer-events-none">시</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelStyle}>종료 시각</label>
                    <div className="relative flex items-center">
                      <input type="number" min="0" max="24" className={numberInputStyle} value={endHour} onChange={e => setEndHour(e.target.value)} />
                      <span className="absolute right-4 font-bold text-slate-400 pointer-events-none">시</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelStyle}>시간당 타임수</label>
                    <div className="relative flex items-center">
                      <input type="number" min="1" className={numberInputStyle} value={slotsPerHour} onChange={e => setSlotsPerHour(e.target.value)} />
                      <span className="absolute right-4 font-bold text-slate-400 pointer-events-none">개</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelStyle}>타임당 인원</label>
                    <div className="relative flex items-center">
                      <input type="number" min="1" className={numberInputStyle} value={limitPerSlot} onChange={e => setLimitPerSlot(e.target.value)} />
                      <span className="absolute right-4 font-bold text-slate-400 pointer-events-none">명</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full md:w-1/2">
                  <label className={labelStyle}>총 선착순 인원 제한</label>
                  <div className="relative flex items-center">
                    <input type="number" min="1" className={numberInputStyle} value={totalLimit} onChange={e => setTotalLimit(e.target.value)} />
                    <span className="absolute right-4 font-bold text-slate-400 pointer-events-none">명</span>
                  </div>
                  <p className="text-xs font-bold text-blue-500 mt-2 ml-1">해당 인원 도달 시 자동으로 신청이 마감됩니다.</p>
                </div>
              )}
            </div>
            
            <button onClick={addBooth} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-lg hover:bg-slate-800 transition-colors shadow-xl active:scale-[0.98]">
              단일 부스 추가하기
            </button>
          </div>
        </div>

        {/* --- 개설된 부스 목록 --- */}
        <div className="grid gap-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-2 ml-2 gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-800">부스 목록 ({filteredBooths.length}개)</h3>
              <p className="text-slate-500 font-bold text-sm">개설된 최신순으로 정렬됩니다.</p>
              <button
                onClick={downloadBoothLinks}
                className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-all shadow-md flex items-center gap-2"
              >
                <span>📗</span> 현재 목록의 링크 목록 엑셀 다운로드
              </button>
            </div>
            
            {/* [추가] 검색창 및 행사 필터 그룹 */}
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="w-full sm:w-64 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input 
                  type="text"
                  placeholder="부스 이름 검색..."
                  className="w-full pl-9 pr-4 py-2 bg-white border-2 border-slate-200 rounded-xl outline-none font-bold text-slate-700 focus:border-blue-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="w-full sm:w-64">
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
          </div>

          {filteredBooths.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border border-slate-200 text-slate-400 font-bold">
              {searchTerm ? "검색 결과가 없습니다." : "이 행사에 등록된 부스가 없습니다."}
            </div>
          ) : (
            filteredBooths.map(booth => (
              <div key={booth.id} className="bg-white p-6 rounded-[1.5rem] border flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div onClick={() => navigate(`/manage/booths/${booth.id}`)} className="cursor-pointer flex-1">
                  
                  <div className="mb-2">
                     <span className="text-[10px] font-black px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        {booth.event_name}
                     </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
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