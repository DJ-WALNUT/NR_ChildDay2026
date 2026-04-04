import React, { useState } from 'react';

const CheckReservation = () => {
  const [search, setSearch] = useState({ name: '', phone: '' });
  const [result, setResult] = useState(null);

  const handleCheck = (e) => {
    e.preventDefault();
    const data = JSON.parse(localStorage.getItem('reservations') || '[]');
    const cleanPhone = search.phone.replace(/-/g, '');
    const found = data.find(r => r.name === search.name && r.phone.replace(/-/g, '') === cleanPhone);
    if (found) {
      setResult(found);
    } else {
      alert("신청 정보를 찾을 수 없습니다.");
      setResult(null);
    }
  };

  const inputStyle = "w-full px-6 py-5 bg-slate-800 border-2 border-slate-700 rounded-3xl focus:border-yellow-400 outline-none transition-all text-lg font-black text-white placeholder:text-slate-500";

  return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-5xl font-black text-white text-center mb-12 tracking-tighter italic">
          SEARCH <span className="text-yellow-400 underline underline-offset-8">INFO</span>
        </h1>
        
        <form onSubmit={handleCheck} className="space-y-4 mb-10">
          <input type="text" placeholder="신청자 이름" required className={inputStyle}
            onChange={e => setSearch({...search, name: e.target.value})} />
          <input type="tel" placeholder="등록한 전화번호" required className={inputStyle}
            onChange={e => setSearch({...search, phone: e.target.value})} />
          <button className="w-full bg-white text-slate-950 py-5 rounded-3xl font-black text-xl hover:bg-yellow-400 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)]">
            신청 정보 찾기
          </button>
        </form>

        {result && (
          <div className="bg-yellow-400 rounded-[2.5rem] p-1 shadow-[0_20px_50px_rgba(234,179,8,0.3)] animate-bounce-short">
            <div className="bg-slate-900 rounded-[2.2rem] p-8 text-white relative border-4 border-slate-900 shadow-inner overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
              <h2 className="text-sm font-black text-yellow-400 uppercase tracking-widest mb-8 border-b border-slate-800 pb-4">Confirmed Ticket</h2>
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-slate-500 font-black uppercase">Name</span>
                  <span className="text-3xl font-black italic">{result.name}님</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-xs text-slate-500 font-black uppercase">Time</span>
                  <span className="text-3xl font-black text-blue-400 tabular-nums">{result.time}</span>
                </div>
                <div className="pt-6 border-t border-slate-800 flex justify-center">
                  <span className={`px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest ${result.status === 'noshow' ? 'bg-red-600 text-white' : 'bg-white text-slate-900'}`}>
                    {result.status === 'noshow' ? 'No-Show' : 'Valid Entry'}
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