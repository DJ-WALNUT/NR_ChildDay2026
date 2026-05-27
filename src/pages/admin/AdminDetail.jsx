import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import AdminHeader from '../../components/AdminHeader';
import Footer from '../../components/Footer';

const AdminDetail = () => {
  const { boothId } = useParams();
  const navigate = useNavigate();
  
  const [reservations, setReservations] = useState([]);
  const [boothName, setBoothName] = useState("");
  const [boothInfo, setBoothInfo] = useState(null); 
  const [events, setEvents] = useState([]); // [추가] 행사 목록 상태

  // 수정 모드 상태 관리
  const [isEditing, setIsEditing] = useState(false);
  
  // [수정] editData State에 event_id 추가
  const [editData, setEditData] = useState({
    event_id: '', name: '', mode: 'time', use_waitlist: false, total_limit: 0, limit_per_slot: 0, start_hour: 11, end_hour: 16, slots_per_hour: 3
  });

  const fetchData = async () => {
    try {
      // [수정] 이벤트 데이터도 함께 호출합니다.
      const [resResponse, boothResponse, eventResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/booths/${boothId}/reservations`),
        fetch(`${API_BASE_URL}/api/booths`),
        fetch(`${API_BASE_URL}/api/events`)
      ]);
      
      const resData = await resResponse.json();
      const boothList = await boothResponse.json();
      const eventList = await eventResponse.json();

      setReservations(resData.reservations);
      setBoothName(resData.boothName);
      setEvents(eventList);

      const currentBooth = boothList.find(b => b.id === parseInt(boothId));
      
      if (currentBooth) {
        setBoothInfo(currentBooth);
        setEditData({
          event_id: currentBooth.event_id || '', // [추가] 소속 행사 ID 매핑
          name: currentBooth.name,
          mode: currentBooth.mode,
          use_waitlist: currentBooth.use_waitlist || false, 
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
          event_id: parseInt(editData.event_id, 10), // [추가] 변경된 행사 ID 전송
          name: editData.name,
          mode: editData.mode,
          use_waitlist: editData.use_waitlist,
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

  const toggleBooth = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/booths/${id}/toggle`, { method: 'PATCH', });
      if (res.ok) { fetchData(); // 데이터 새로고침
      }
    } catch (e) { console.error("상태 변경 실패", e); }
  };

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
      if (a.time === b.time) return a.id - b.id;

      const matchA = a.time.match(/\d+/);
      const matchB = b.time.match(/\d+/);

      if (matchA && matchB) {
        const timeA = parseInt(matchA[0]);
        const timeB = parseInt(matchB[0]);
        if (timeA !== timeB) return timeA - timeB;
        return a.time.localeCompare(b.time);
      }
      return a.time.localeCompare(b.time);
    });
  }, [reservations]);

  const [searchTerm, setSearchTerm] = useState("");

  const filteredReservations = useMemo(() => {
    if (!searchTerm.trim()) return sortedReservations;
    return sortedReservations.filter(r => 
      r.name.includes(searchTerm) || r.phone.includes(searchTerm)
    );
  }, [sortedReservations, searchTerm]);

  const exportToExcel = () => {
    const data = sortedReservations.map(r => ({
      "시간": r.time, "이름": r.name, "성별": r.gender, 
      "연령": r.ageGroup, "연락처": r.phone, "상태": r.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "신청자명단");
    // [수정] 파일명에 행사 이름도 포함되도록 수정
    const eventPrefix = boothInfo?.event_name ? `[${boothInfo.event_name}]_` : '';
    XLSX.writeFile(wb, `${eventPrefix}${boothName}_명단.xlsx`);
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

  // QR 다운로드 함수 (ID를 받아 해당 요소를 다운로드)
  const downloadQR = (elementId, fileName) => {
    const svg = document.getElementById(elementId);
    if (!svg) return;
  
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
  
    // [수정] 해상도를 4배 키워서 선명하게 만듦
    const scale = 4; 
    const img = new Image();
  
    img.onload = () => {
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.scale(scale, scale); // 캔버스 배율 조정
      ctx.drawImage(img, 0, 0);
    
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `${fileName}.png`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const inputStyle = "w-full px-4 py-2 bg-slate-50 border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none font-bold text-slate-700 transition-all text-sm";
  const labelStyle = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1";

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 상단 대시보드 헤더 */}
        <header className="flex flex-col justify-between items-start gap-6 p-7 bg-slate-900 text-white rounded-[2rem] shadow-2xl border-b-8 border-blue-600">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              {/* [추가] 소속 행사 배지 표시 */}
              <span className="text-[10px] font-black px-2 py-0.5 rounded-sm bg-slate-100 text-slate-800 break-keep uppercase border border-slate-300">
                {boothInfo?.event_name || '소속 행사 없음'}
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-sm break-keep uppercase ${boothInfo?.mode === 'fcfs' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {boothInfo?.mode === 'fcfs' ? '선착순' : '타임별'}
              </span>
              <h1 className="text-4xl font-black tracking-tighter leading-none w-full mt-2">
                {boothName} <span className="text-blue-400 font-extrabold">현황</span>
              </h1>
            </div>
            <p className="text-slate-400 font-bold text-sm">
              {boothInfo?.mode === 'fcfs' 
                ? `총 제한: ${boothInfo.total_limit}명` 
                : `운영: ${boothInfo?.start_hour}시~${boothInfo?.end_hour}시 (타임당 ${boothInfo?.limit_per_slot}명)`}
            </p>
          </div>
          <div className="flex flex-col md:flex-row flex-start gap-3 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-700 pt-6 md:pt-0 md:pl-8 flex-wrap">
            <div className="flex-1 text-center md:text-left mr-4">
              <div className="text-s font-black text-slate-500 uppercase mb-1">전체 신청</div>
              <div className="text-4xl font-black text-blue-400 tabular-nums">{totalReservations}</div>
            </div>
            
            {boothInfo && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start grid grid-cols-1 gap-1">
                  <div>
                    <p className="text-slate-500 font-bold">현재 상태: 
                      <span className={boothInfo.is_active ? "text-green-600 ml-2" : "text-red-500 ml-2"}>
                        {boothInfo.is_active ? "운영 중" : "마감됨"}
                      </span>
                    </p>
                  </div>
      
                  {/* 운영 상태 변경 버튼 */}
                  <button 
                    onClick={() => toggleBooth(boothInfo.id)}
                    className={`flex px-6 py-2 rounded-xl font-bold transition-all ${
                      boothInfo.is_active 
                      ? 'bg-red-50 text-red-500 border border-red-100' 
                      : 'bg-green-100 text-green-700 border border-green-200'
                    }`}
                  >
                    {boothInfo.is_active ? "운영 마감하기" : "운영 시작하기"}
                  </button>
                </div>
              </div>
            )}

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

        {/* 부스 설정 수정 패널 */}
        {isEditing && (
          <div className="bg-white p-6 rounded-[2rem] border-2 border-blue-200 shadow-xl animate-fade-in-down">
            <h3 className="text-lg font-black text-slate-800 mb-4 border-b pb-2">부스 설정 수정</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* [추가] 소속 행사 변경 드롭다운 */}
              <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <label className={labelStyle}>소속 행사 그룹</label>
                  <select 
                    className={inputStyle}
                    value={editData.event_id}
                    onChange={e => setEditData({...editData, event_id: e.target.value})}
                  >
                    <option value="" disabled>행사를 선택하세요</option>
                    {[...events].sort((a, b) => b.id - a.id).map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className={labelStyle}>부스 이름</label>
                  <input className={inputStyle} value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                </div>
              </div>
              
              <div>
                <label className={labelStyle}>운영 모드</label>
                <div className="flex gap-2">
                  <button onClick={() => setEditData({...editData, mode: "time"})} className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 ${editData.mode === 'time' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>타임별 예약</button>
                  <button onClick={() => setEditData({...editData, mode: "fcfs"})} className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 ${editData.mode === 'fcfs' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>현장 선착순</button>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2 flex items-center gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <input 
                  type="checkbox" 
                  id="edit_waitlist_toggle"
                  checked={editData.use_waitlist}
                  onChange={(e) => setEditData({...editData, use_waitlist: e.target.checked})}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="edit_waitlist_toggle" className="text-sm font-black text-slate-700 cursor-pointer select-none">
                  대기자 접수 기능 켜기
                </label>
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

        <section className="max-w-7xl mx-auto px-4 mt-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
          
            {/* 관리자 페이지 QR */}
            <div className="flex grid grid-cols-1 items-center justify-between p-4 bg-gray-100 rounded-2xl border border-gray-200">
              <div>
                <h3 className="text-sm font-black text-slate-800">관리자 전용 QR</h3>
                <p className="text-[11px] text-slate-500 font-bold mt-1 mb-1">현장 관리자 체크인용</p>
              </div>
              <div className="flex items-center gap-3">
                <QRCodeSVG
                  id="admin-qr"
                  value={`https://nrbooth.team-cluster.kr/manage/booths/${boothId}`}
                  size={256} // 기존 50에서 256 이상으로 크게 키우세요.
                  //level="H"  // 'H' 레벨은 QR 코드 내의 데이터를 더 높은 밀도로 압축하여 복원력을 높입니다.
                  includeMargin={true} // 여백을 추가하여 인식률을 높입니다.
                />
                <button onClick={() => downloadQR("admin-qr", `${boothName}_관리자QR`)} className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-700 break-keep">다운로드</button>
              </div>
            </div>

            {/* 신청서 페이지 QR */}
            <div className="flex grid grid-cols-1 items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <div>
                <h3 className="text-sm font-black text-blue-900">사용자 신청 QR</h3>
                <p className="text-[11px] text-blue-600 font-bold mt-1 mb-1">방문객 신청 페이지</p>
              </div>
              <div className="flex items-center gap-5">
                <QRCodeSVG
                  id="user-qr"
                  value={`https://nrbooth.team-cluster.kr/reserve/${boothId}`}
                  size={256} // 기존 50에서 256 이상으로 크게 키우세요.
                  //level="H"  // 'H' 레벨은 QR 코드 내의 데이터를 더 높은 밀도로 압축하여 복원력을 높입니다.
                  includeMargin={true} // 여백을 추가하여 인식률을 높입니다.
                />
                <button onClick={() => downloadQR("user-qr", `${boothName}_신청QR`)} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 break-keep">다운로드</button>
              </div>
            </div>
          </div>
        </section>

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
          <div className="px-8 py-6 border-b-4 border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-black text-slate-900">신청 현황</h3>
              <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-3 py-1 rounded-full uppercase">시간순 정렬</span>
            </div>
            
            <div className="w-full md:w-72 relative">
              <input 
                type="text" 
                placeholder="이름 또는 식별번호 검색" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none font-bold text-slate-700 text-sm transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            </div>
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
                {filteredReservations.map(r => (
                  <tr key={r.id} className={`font-bold transition-all ${
                    r.status === 'noshow' ? 'bg-red-50/50 opacity-40 grayscale italic' : 
                    r.status === 'waiting' ? 'bg-orange-50/70' : 
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

      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-50">
        <button 
          onClick={fetchData} 
          className="p-4 bg-slate-900 text-white rounded-full shadow-2xl hover:bg-blue-600 transition-all hover:-translate-y-1 group"
          title="새로고침"
        >
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="p-4 bg-slate-900 text-white rounded-full shadow-2xl hover:bg-yellow-400 hover:text-slate-900 transition-all hover:-translate-y-1"
          title="상단으로 이동"
        >
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
          </svg>
        </button>
      </div>

      <Footer />
    </div>
  );
};

export default AdminDetail;