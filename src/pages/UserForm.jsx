import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const UserForm = () => {
  const [formData, setFormData] = useState({
    name: '', gender: '남', ageGroup: '0~8세', phone: '', time: '10:00'
  });
  const [terms, setTerms] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    fetch('/terms.md').then(res => res.text()).then(setTerms);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!agreed) return alert("필수 약관에 동의해 주세요.");
    const existing = JSON.parse(localStorage.getItem('reservations') || '[]');
    const newReservation = { ...formData, id: Date.now(), status: 'normal' };
    localStorage.setItem('reservations', JSON.stringify([...existing, newReservation]));
    alert("신청이 정상적으로 접수되었습니다.");
  };

  // 폰트 굵기를 강조한 입력창 스타일
  const inputStyle = "w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all text-base font-bold text-gray-900 placeholder:font-medium placeholder:text-gray-400";

  return (
    <div className="min-h-screen bg-slate-900 pb-20 font-sans">
      <div className="w-full px-4 pt-6 max-w-xl mx-auto">
        <Link 
          to="/check" 
          className="w-full flex items-center justify-center gap-2 py-4 bg-sky-600 text-white rounded-2xl font-black shadow-xl border-b-4 border-sky-800 active:border-b-0 active:translate-y-1 transition-all"
        >
          <span className="tracking-tight">🔍 내 신청 정보 확인하기</span>
        </Link>
      </div>

      <div className="max-w-xl mx-auto my-8 p-8 bg-white rounded-[2.5rem] shadow-2xl border-t-8 border-yellow-400 relative">
        <header className="text-center mb-10">
          <span className="inline-block bg-slate-900 text-white text-[10px] font-black px-4 py-1.5 rounded-full mb-4 tracking-[0.2em] uppercase">Center Program</span>
          <h1 className="text-4xl font-black text-slate-900 leading-tight tracking-tighter">
            부스 이용 <span className="text-blue-600 font-extrabold">신청</span>
          </h1>
          <p className="text-slate-500 text-sm mt-4 font-bold">빠짐없이 정보를 입력해 주세요.</p>
        </header>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-black text-slate-700 ml-1">방문 예정 시간</label>
            <select className={`${inputStyle} appearance-none cursor-pointer border-blue-600 font-black`} onChange={e => setFormData({...formData, time: e.target.value})}>
              <option>11:00 A</option>
              <option>11:00 B</option>
              <option>11:00 C</option>
              <option>12:00 A</option>
              <option>12:00 B</option>
              <option>12:00 C</option>
              <option>13:00 A</option>
              <option>13:00 B</option>
              <option>13:00 C</option>
              <option>14:00 A</option>
              <option>14:00 B</option>
              <option>14:00 C</option>
              <option>15:00 A</option>
              <option>15:00 B</option>
              <option>15:00 C</option>
              <option>16:00 A</option>
              <option>16:00 B</option>
              <option>16:00 C</option>
            </select>
          </div>

          <input type="text" placeholder="성함 (실명 입력)" required className={inputStyle} 
            onChange={e => setFormData({...formData, name: e.target.value})} />
          
          <div className="grid grid-cols-2 gap-3">
            {['남', '여'].map((g) => (
              <button key={g} type="button" 
                onClick={() => setFormData({...formData, gender: g})}
                className={`py-4 text-lg rounded-2xl font-black transition-all border-2 ${formData.gender === g ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-gray-200'}`}>
                {g}
              </button>
            ))}
          </div>

          <select className={`${inputStyle} font-bold`} onChange={e => setFormData({...formData, ageGroup: e.target.value})}>
            {["0~8세", "9~13세", "14~16세", "17~19세", "20~24세", "24세 이상"].map(age => <option key={age}>{age}</option>)}
          </select>

          <input type="tel" placeholder="연락처 (숫자만 입력)" required className={inputStyle} 
            onChange={e => setFormData({...formData, phone: e.target.value})} />

          <div className="space-y-3">
            <h4 className="text-sm font-black text-slate-700 ml-1">이용 약관 및 개인정보 수집</h4>
            <div className="p-6 h-48 overflow-y-auto bg-slate-50 rounded-3xl text-sm leading-relaxed text-slate-800 border-2 border-gray-100 whitespace-pre-wrap font-medium shadow-inner text-left">
              {/* 약관 본문은 font-medium(500)으로 설정하여 가독성 확보 */}
              {terms || "약관을 불러오는 중입니다..."}
            </div>
            <label className="flex items-center gap-4 cursor-pointer p-4 bg-slate-50 rounded-2xl border-2 border-transparent has-[:checked]:border-blue-600 transition-all">
              <input type="checkbox" className="w-6 h-6 rounded-lg border-2 border-gray-300 text-blue-600"
                checked={agreed} onChange={e => setAgreed(e.target.checked)} />
              <span className="text-sm font-black text-slate-700">모든 약관에 동의합니다.</span>
            </label>
          </div>

          <button className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-95">
            신청서 제출하기
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserForm;