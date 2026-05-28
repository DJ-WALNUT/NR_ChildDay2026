import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import AdminHeader from '../../components/AdminHeader';
import Footer from '../../components/Footer';

const AdminEventManager = () => {
  const [events, setEvents] = useState([]);
  const [newEventName, setNewEventName] = useState("");
  
  // 수정 모드 관리를 위한 State
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  
  // [추가] 검색어 상태 관리
  const [searchTerm, setSearchTerm] = useState("");

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events`);
      const data = await res.json();
      const sortedData = data.sort((a, b) => b.id - a.id);
      setEvents(sortedData);
    } catch (e) {
      console.error("행사 목록 로드 실패", e);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const addEvent = async () => {
    if (!newEventName.trim()) {
      alert("행사 이름을 입력해주세요.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newEventName })
      });

      if (response.ok) {
        setNewEventName("");
        fetchEvents();
        alert("새로운 행사가 추가되었습니다.");
      } else {
        const errData = await response.json();
        alert(`행사 추가 실패: ${errData.error}`);
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }
  };

  const saveEditedEvent = async (id) => {
    if (id === 1) {
      alert("기본 행사(미분류)의 이름은 수정할 수 없습니다.");
      return;
    }

    if (!editingName.trim()) {
      alert("변경할 행사 이름을 입력해주세요.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName })
      });

      if (response.ok) {
        setEditingId(null);
        setEditingName("");
        fetchEvents();
        alert("행사 이름이 수정되었습니다.");
      } else {
        const errData = await response.json();
        alert(`수정 실패: ${errData.error}`);
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }
  };

  const deleteEvent = async (id) => {
    if (id === 1) {
      alert("기본 행사(미분류)는 시스템 보호를 위해 삭제할 수 없습니다.");
      return;
    }

    if (!window.confirm("이 행사를 삭제하시겠습니까?\n소속된 부스들은 '기본 행사(미분류)'로 자동 이동됩니다.")) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/${id}`, { method: 'DELETE' });
      if (response.ok) {
        alert("행사가 성공적으로 삭제되었습니다.");
        fetchEvents();
      } else {
        const errData = await response.json();
        alert(`삭제 실패: ${errData.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }
  };

  // [추가] 검색어에 따라 행사 목록 필터링
  const filteredEvents = events.filter(event => 
    event.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputStyle = "w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold text-slate-700 transition-all";

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader />
      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        
        <header className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">행사 카테고리 관리</h1>
          <p className="text-slate-500 font-bold mt-2">여러 부스를 묶어서 관리할 상위 행사 그룹을 만듭니다.</p>
        </header>

        <div className="bg-white p-6 md:p-8 rounded-[2rem] border-2 border-slate-900 shadow-xl space-y-4">
          <h2 className="text-xl font-black text-slate-900 border-b-2 border-slate-100 pb-4">새 행사 생성</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              className={inputStyle}
              placeholder="예: 2026년 5월 어린이날 행사, 가을 축제 등"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addEvent()}
            />
            <button 
              onClick={addEvent} 
              className="md:w-48 bg-blue-600 text-white py-3 rounded-xl font-black text-lg hover:bg-blue-700 transition-colors shadow-lg whitespace-nowrap"
            >
              + 행사 추가
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 ml-2 mb-2">
            <h3 className="text-lg font-black text-slate-800">
              등록된 행사 목록 ({filteredEvents.length}개 / 전체 {events.length}개)
            </h3>
            
            {/* [추가] 검색창 UI */}
            <div className="w-full md:w-72 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input 
                type="text"
                placeholder="행사 이름 검색..."
                className="w-full pl-9 pr-4 py-2 bg-white border-2 border-slate-200 rounded-xl outline-none font-bold text-slate-700 focus:border-blue-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl border border-slate-200 text-slate-400 font-bold">
              {searchTerm ? "검색 결과가 없습니다." : "아직 등록된 행사가 없습니다."}
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div key={event.id} className="bg-white p-6 rounded-[1.5rem] border flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                
                {editingId === event.id ? (
                  <div className="flex-1 flex flex-col md:flex-row gap-3">
                    <input 
                      type="text"
                      className="flex-1 px-4 py-2 bg-slate-50 border-2 border-blue-400 rounded-lg outline-none font-bold text-slate-700"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && saveEditedEvent(event.id)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => saveEditedEvent(event.id)} 
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700"
                      >
                        저장
                      </button>
                      <button 
                        onClick={() => setEditingId(null)} 
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-200 text-slate-600 hover:bg-slate-300"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-widest ${event.id === 1 ? 'bg-slate-200 text-slate-600' : 'bg-purple-100 text-purple-700'}`}>
                          EVENT ID: {event.id}
                        </span>
                        <h3 className="text-xl font-black text-slate-900">
                          {event.name} 
                          {event.id === 1 && <span className="ml-2 text-xs text-red-500 bg-red-50 px-2 py-1 rounded">기본</span>}
                        </h3>
                      </div>
                      <p className="text-slate-500 font-bold text-sm mt-2">
                        소속된 부스 개수: <span className="text-blue-600 font-black">{event.booths?.length || 0}</span>개
                      </p>
                    </div>
                    
                    <div className="flex gap-2 items-center">
                      {event.id === 1 ? (
                        <span className="px-4 py-2 text-sm font-bold text-slate-400 bg-slate-50 rounded-lg cursor-not-allowed border border-slate-200">
                          수정/삭제 불가
                        </span>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              setEditingId(event.id);
                              setEditingName(event.name);
                            }} 
                            className="px-5 py-3 rounded-xl text-sm font-bold bg-slate-100 text-blue-600 hover:bg-blue-100 transition-all whitespace-nowrap"
                          >
                            수정
                          </button>
                          <button 
                            onClick={() => deleteEvent(event.id)} 
                            className="px-5 py-3 rounded-xl text-sm font-bold bg-slate-100 text-slate-500 hover:bg-red-500 hover:text-white transition-all whitespace-nowrap"
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminEventManager;