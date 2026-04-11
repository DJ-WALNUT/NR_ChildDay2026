import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; // 데이터 수신을 위해 추가

const CheckReservation = () => {
  const location = useLocation(); // 이전 페이지에서 보낸 state 수신
  const [search, setSearch] = useState({ name: '', phone: '' });
  const [result, setResult] = useState(null);

  // 페이지 진입 시, 자동 이동으로 넘어온 데이터가 있으면 즉시 표시
  useEffect(() => {
    if (location.state && location.state.autoCheck) {
      setResult(location.state.autoCheck);
    }
  }, [location]);

  const handleCheck = async (e) => { // async 추가
    e.preventDefault();
    const cleanPhone = search.phone.replace(/[^0-9]/g, ''); // 숫자만 추출

    try {
      // 모든 예약을 가져온 후 필터링하거나, 특정 예약만 찾는 API가 있다면 호출
      const response = await fetch('http://child-api/api/reservations');
      const allReservations = await response.json();
    
      const found = allReservations.find(r => 
        r.name === search.name && r.phone.replace(/[^0-9]/g, '') === cleanPhone
      );

      if (found) {
        setResult(found);
      } else {
        alert("신청 정보를 찾을 수 없습니다.");
        setResult(null);
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }
  };

  const inputStyle = "w-full px-6 py-5 bg-slate-800 border-2 border-slate-700 rounded-3xl focus:border-yellow-400 outline-none transition-all text-lg font-black text-white placeholder:text-slate-500";

  return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-5xl font-black text-white text-center mb-12 tracking-tighter">
          예약정보 <span className="text-yellow-400 underline underline-offset-8">확인</span>
        </h1>
        
        {/* 조회 폼 (데이터가 자동으로 떴더라도 다시 조회 가능) */}
        <form onSubmit={handleCheck} className="space-y-4 mb-10">
          <input type="text" placeholder="신청자 이름" required className={inputStyle}
            onChange={e => setSearch({...search, name: e.target.value})} />
          <input type="tel" placeholder="등록한 전화번호" required className={inputStyle}
            onChange={e => setSearch({...search, phone: e.target.value})} />
          <button className="w-full bg-white text-slate-950 py-5 rounded-3xl font-black text-xl hover:bg-yellow-400 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)]">
            확인하기
          </button>
        </form>

        {/* 결과 표시 카드 (자동 이동 시 이 부분이 바로 보임) */}
        {result && (
          <div className="bg-yellow-400 rounded-[2.5rem] p-1 shadow-[0_20px_50px_rgba(234,179,8,0.3)] animate-bounce-short">
            <div className="bg-slate-900 rounded-[2.2rem] p-8 text-white relative border-4 border-slate-900 shadow-inner overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
              <h2 className="text-sm font-black text-yellow-400 uppercase tracking-widest mb-8 border-b border-slate-800 pb-4">예약정보 확인</h2>
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-slate-500 font-black uppercase">이름</span>
                  <span className="text-3xl font-black">{result.name} 님</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-xs text-slate-500 font-black uppercase">예약시간</span>
                  <span className="text-3xl font-black text-blue-400 tabular-nums">{result.time}</span>
                </div>
                <div className="pt-6 border-t border-slate-800 flex justify-center">
                  <span className={`px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest ${result.status === 'noshow' ? 'bg-red-600 text-white' : 'bg-white text-slate-900'}`}>
                    {result.status === 'noshow' ? '취소' : '입장 가능'}
                  </span>
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