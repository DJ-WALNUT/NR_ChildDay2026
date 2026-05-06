import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom'; 
import { API_BASE_URL } from '../../config';

const CheckReservation = () => {
  // 1. URL 파라미터에서 boothId를 가져옵니다. 
  // 만약 URL이 /check/1 형태가 아니라면 여기서 오류가 발생하여 흰 화면이 뜰 수 있습니다.
  const { boothId } = useParams(); 
  const location = useLocation();
  const navigate = useNavigate(); // [추가] 네비게이션 훅 초기화
  
  const [search, setSearch] = useState({ name: '', phone: '' });
  const [result, setResult] = useState(null);
  const [boothInfo, setBoothInfo] = useState(null);

  useEffect(() => {
    const fetchBoothData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/booths`);
        const data = await res.json();
        
        // URL의 boothId 혹은 이전 페이지에서 넘겨준 boothId로 부스 정보 찾기
        const targetId = boothId || location.state?.boothId || location.state?.autoCheck?.booth_id;
        if (targetId) {
          const current = data.find(b => b.id === parseInt(targetId));
          setBoothInfo(current);
        }
      } catch (e) {
        console.error("부스 정보 로드 실패", e);
      }
    };

    fetchBoothData();

    // Legacy 기능 유지: 신청 완료 후 state로 넘어온 데이터가 있으면 즉시 표시
    if (location.state && location.state.autoCheck) {
      setResult(location.state.autoCheck);
    }
  }, [boothId, location.state]);

  const handleCheck = async (e) => {
    e.preventDefault();
    const cleanPhone = search.phone.replace(/[^0-9]/g, '');

    try {
      // 해당 부스의 예약 내역만 가져오는 API 호출
      const response = await fetch(`${API_BASE_URL}/api/booths/${boothId}/reservations`);
      const data = await response.json();
      
      // Legacy 로직: 해당 부스 예약 명단 내에서 사용자 검색
      const found = data.reservations.find(r => 
        r.name === search.name && r.phone.replace(/[^0-9]/g, '') === cleanPhone
      );

      if (found) {
        // 결과 카드에 표시할 부스 이름을 데이터에 추가
        setResult({ ...found, booth_name: data.boothName });
      } else {
        alert(`${boothInfo?.name || '해당'} 부스에 신청 정보가 없습니다.`);
        setResult(null);
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }
  };

  // [추가] 사용자 본인 취소 함수
  const handleCancel = async () => {
    if (!window.confirm("정말 신청을 취소하시겠습니까?\n취소 후에는 복구가 불가능합니다.")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/reservations/${result.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert("신청이 정상적으로 취소되었습니다.");
        setResult(null); // 취소 후 화면에서 결과 지우기
      } else {
        alert("취소 처리에 실패했습니다.");
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }
  };

  const inputStyle = "w-full px-6 py-5 bg-slate-800 border-2 border-slate-700 rounded-3xl focus:border-yellow-400 outline-none transition-all text-lg font-black text-white placeholder:text-slate-500";

  return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        {/* [추가] 신청페이지로 돌아가기 버튼 */}
        <div className="mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-400 font-bold hover:text-white transition-colors"
          >
            <span>←</span> 신청페이지로 돌아가기
          </button>
        </div>

        <h1 className="text-4xl font-black text-white text-center mb-8 tracking-tighter">
          예약정보 <span className="text-yellow-400 underline underline-offset-8">확인</span>
        </h1>

        
        <div className="text-center mb-7">
          <span className="bg-yellow-400 text-slate-900 px-4 py-1 rounded-full text-3xl font-black uppercase tracking-widest">
            {boothInfo ? boothInfo.name : "부스이름 확인 중"}
          </span>
        </div>
        
        <form onSubmit={handleCheck} className="space-y-4 mb-10">
          <input 
            type="text" 
            placeholder="신청자 이름" 
            required 
            className={inputStyle}
            onChange={e => setSearch({...search, name: e.target.value})} 
          />
          <input 
            type="tel" 
            placeholder="등록한 전화번호" 
            required 
            className={inputStyle}
            onChange={e => setSearch({...search, phone: e.target.value})} 
          />
          <button className="w-full bg-white text-slate-950 py-5 rounded-3xl font-black text-xl hover:bg-yellow-400 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)]">
            확인하기
          </button>
        </form>

        {result && (
          <div className="bg-yellow-400 rounded-[2.5rem] p-1 shadow-[0_20px_50px_rgba(234,179,8,0.3)]">
            <div className="bg-slate-900 rounded-[2.2rem] p-8 text-white relative border-4 border-slate-900 shadow-inner overflow-hidden">
              <h2 className="text-sm font-black text-yellow-400 uppercase tracking-widest mb-8 border-b border-slate-800 pb-4 flex justify-between">
                <span>예약정보 확인</span>
                <span className="text-white opacity-60">{result.booth_name}</span>
              </h2>

              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-slate-500 font-black uppercase">이름</span>
                  <span className="text-3xl font-black">{result.name} 님</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-xs text-slate-500 font-black uppercase">
                    {result.time === '선착순 접수' ? '접수구분' : '예약시간'}
                  </span>
                  <span className="text-3xl font-black text-blue-400 tabular-nums">{result.time}</span>
                </div>
                <div className="pt-6 border-t border-slate-800 flex flex-col items-center gap-4">
                  <span className={`px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest ${
                    result.status === 'noshow' ? 'bg-red-600 text-white' : 
                    result.status === 'waiting' ? 'bg-orange-500 text-white' :
                    'bg-white text-slate-900'
                  }`}>
                    {result.status === 'noshow' ? '취소(노쇼)' : 
                     result.status === 'completed' ? '체험 완료' : 
                     result.status === 'waiting' ? '대기자' : 
                     '입장 가능'}
                  </span>

                  {/* 노쇼나 체험 완료 상태가 아닐 때만 취소 버튼 표시 */}
                  {result.status !== 'noshow' && result.status !== 'completed' && (
                    <button 
                      onClick={handleCancel}
                      type="button"
                      className="mt-1 text-l font-bold text-slate-400 hover:text-red-400 underline underline-offset-4 transition-colors"
                    >
                      신청 취소하기
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckReservation;