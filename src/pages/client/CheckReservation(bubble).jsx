import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom'; 
import { API_BASE_URL } from '../../config';

const CheckReservation = () => {
  const { boothId } = useParams(); 
  const location = useLocation();
  const navigate = useNavigate(); 
  
  const [search, setSearch] = useState({ name: '', phone: '' });
  const [result, setResult] = useState(null);
  const [boothInfo, setBoothInfo] = useState(null);

  useEffect(() => {
    const fetchBoothData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/booths`);
        const data = await res.json();
        
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

    if (location.state && location.state.autoCheck) {
      setResult(location.state.autoCheck);
    }
  }, [boothId, location.state]);

  const handleCheck = async (e) => {
    e.preventDefault();
    const cleanPhone = search.phone.replace(/[^0-9]/g, '');

    try {
      const response = await fetch(`${API_BASE_URL}/api/booths/${boothId}/reservations`);
      const data = await response.json();
      
      const found = data.reservations.find(r => 
        r.name === search.name && r.phone.replace(/[^0-9]/g, '') === cleanPhone
      );

      if (found) {
        setResult({ ...found, booth_name: data.boothName });
      } else {
        alert(`${boothInfo?.name || '해당'} 부스에 신청 정보가 없습니다.`);
        setResult(null);
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("정말 신청을 취소하시겠습니까?\n취소 후에는 복구가 불가능합니다. 🥲")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/reservations/${result.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert("신청이 정상적으로 취소되었습니다.");
        setResult(null); 
      } else {
        alert("취소 처리에 실패했습니다.");
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }
  };

  // 밝고 둥근 검색 필드 스타일
  const inputStyle = "w-full px-6 py-5 bg-white border-2 border-sky-100 rounded-full focus:border-sky-400 focus:ring-4 focus:ring-sky-50 outline-none transition-all text-lg font-black text-gray-700 placeholder:text-gray-300 shadow-sm";

  return (
    <div className="min-h-screen bg-sky-50 p-6 flex flex-col items-center justify-center font-sans relative overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute top-10 left-10 w-40 h-40 bg-yellow-200 rounded-full blur-[60px] opacity-50 pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sky-600 font-bold hover:text-sky-800 transition-colors bg-white px-5 py-2 rounded-full shadow-sm border border-sky-100"
          >
            <span>←</span> 신청페이지로
          </button>
        </div>

        <h1 className="text-4xl font-black text-sky-900 text-center mb-8 tracking-tighter">
          신청정보 <span className="text-yellow-400 underline decoration-pink-300 underline-offset-8">확인</span>
        </h1>
        
        <div className="text-center mb-10">
          <span className="bg-white text-sky-600 border-2 border-sky-200 shadow-sm px-6 py-2 rounded-3xl text-2xl font-black tracking-widest inline-block break-keep">
            {boothInfo ? boothInfo.name : "부스이름 확인 중 ☁️"}
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
            placeholder="등록한 식별번호 4자리"
            required 
            className={inputStyle}
            onChange={e => setSearch({...search, phone: e.target.value})} 
          />
          <button className="w-full bg-sky-400 text-white py-5 rounded-full font-black text-xl hover:bg-sky-500 transition-all shadow-lg shadow-sky-200 active:scale-95">
            확인하기 🔍
          </button>
        </form>

        {result && (
          <div className="bg-yellow-400 rounded-[3.5rem] p-2 shadow-xl shadow-yellow-200/50 animate-bounce-short">
            <div className="bg-white rounded-[3.2rem] p-8 text-gray-800 relative border-4 border-white shadow-inner overflow-hidden">
              <h2 className="text-sm font-black text-sky-400 uppercase tracking-widest mb-8 border-b-2 border-sky-50 pb-4 flex justify-between items-center">
                <span>예약정보 확인</span>
                <span className="text-gray-400 text-xs bg-gray-50 px-3 py-1 rounded-full">{result.booth_name}</span>
              </h2>

              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <span className="text-sm text-gray-400 font-black uppercase">이름</span>
                  <span className="text-3xl font-black text-sky-900">{result.name} 님</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-sm text-gray-400 font-black uppercase">
                    {result.time === '선착순 접수' ? '접수구분' : '예약시간'}
                  </span>
                  <span className="text-3xl font-black text-pink-400 tabular-nums">{result.time}</span>
                </div>
                <div className="pt-8 border-t-2 border-sky-50 flex flex-col items-center gap-4">
                  <span className={`px-8 py-3 rounded-full text-sm font-black uppercase tracking-widest shadow-sm ${
                    result.status === 'noshow' ? 'bg-pink-100 text-pink-600 border-2 border-pink-200' : 
                    result.status === 'waiting' ? 'bg-yellow-100 text-yellow-600 border-2 border-yellow-200' :
                    'bg-sky-100 text-sky-600 border-2 border-sky-200'
                  }`}>
                    {result.status === 'noshow' ? '취소(노쇼)' : 
                     result.status === 'completed' ? '체험 완료 🫧' : 
                     result.status === 'waiting' ? '대기자 ☁️' : 
                     '입장 가능 ✨'}
                  </span>

                  {result.status !== 'noshow' && result.status !== 'completed' && (
                    <button 
                      onClick={handleCancel}
                      type="button"
                      className="mt-2 text-sm font-bold text-gray-400 hover:text-pink-400 underline decoration-gray-300 underline-offset-4 transition-colors"
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