import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // useNavigate 추가

const UserForm = () => {
  const navigate = useNavigate(); // 페이지 이동을 위한 훅
  const [formData, setFormData] = useState({
    name: '', gender: '', ageGroup: '0~8세', phone: '', time: '11시 A타임'
  });
  const [terms, setTerms] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    fetch('/terms.md').then(res => res.text()).then(setTerms);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) return alert("필수 약관에 동의해 주세요.");

    // 2. 전화번호 11자리 유효성 검사
    const cleanPhone = formData.phone.replace(/[^0-9]/g, ""); // 숫자만 추출
    if (cleanPhone.length !== 11) {
      return alert("전화번호 11자리를 정확히 입력해 주세요. (예: 01012345678)");
    }

    try {
      const response = await fetch('http://child-api/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const savedData = await response.json();
        alert("신청이 정상적으로 접수되었습니다.");
        navigate('/check', { state: { autoCheck: { ...formData, id: savedData.id } } });
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }

    
  };

  const inputStyle = "w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all text-base font-bold text-gray-900 placeholder:font-medium placeholder:text-gray-400";

  return (
    <div className="min-h-screen bg-slate-900 pb-20 font-sans">
      {/* ... (상단 '내 신청 정보 확인하기' 버튼 및 헤더 레이아웃 동일) */}
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
            <div className="rounded-xl flex items-center justify-center">
              <img className="inline-block w-60" src="logo.png" />
            </div>
          <span className="inline-block bg-slate-900 text-white text-[12px] font-black px-4 py-1.5 rounded-full mt-2 mb-3 tracking-[0.2em] uppercase">
            어린이날 체험부스
          </span>
          <h1 className="text-4xl font-black text-slate-900 leading-tight tracking-tighter">
            체험부스 <span className="text-blue-600 font-extrabold">신청</span>
          </h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ... (시간대, 이름, 성별, 연령대 입력란 동일) */}
          <div className="space-y-2">
            <label className="text-sm font-black text-slate-700 ml-1">희망 체험 시간</label>
            <select className={`${inputStyle} font-bold`} onChange={e => setFormData({...formData, time: e.target.value})}>
              <option value="11시 A타임">11시 A타임</option>
              <option value="11시 B타임">11시 B타임</option>
              <option value="11시 C타임">11시 C타임</option>
              <option value="12시 A타임">12시 A타임</option>
              <option value="12시 B타임">12시 B타임</option>
              <option value="12시 C타임">12시 C타임</option>
              <option value="13시 A타임">13시 A타임</option>
              <option value="13시 B타임">13시 B타임</option>
              <option value="13시 C타임">13시 C타임</option>
              <option value="14시 A타임">14시 A타임</option>
              <option value="14시 B타임">14시 B타임</option>
              <option value="14시 C타임">14시 C타임</option>
              <option value="15시 A타임">15시 A타임</option>
              <option value="15시 B타임">15시 B타임</option>
              <option value="15시 C타임">15시 C타임</option>
              <option value="16시 A타임">16시 A타임</option>
              <option value="16시 B타임">16시 B타임</option>
              <option value="16시 C타임">16시 C타임</option>
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

          {/* 전화번호 입력란 (11자리 유효성 검사 적용 대상) */}
          <input type="tel" placeholder="연락처 (숫자만 11자리 입력)" required className={inputStyle} 
            onChange={e => setFormData({...formData, phone: e.target.value})} />

          {/* 약관 및 제출 버튼 (기존과 동일) */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-slate-700 ml-1">이용 약관 및 개인정보 수집</h4>
            <div className="p-6 h-48 overflow-y-auto bg-slate-50 rounded-3xl text-sm leading-relaxed text-slate-800 border-2 border-gray-100 whitespace-pre-wrap font-medium shadow-inner text-left">
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

      <footer className="max-w-xl mx-auto px-6 py-12 text-center border-t border-slate-800">
        <div className="flex flex-col items-center gap-6">
          
          {/* 기관 로고 영역 (이미지가 없다면 텍스트 로고로 대체 가능) */}
          <div className="flex items-center gap-3">
            <div className="w-70 rounded-xl flex items-center justify-center shadow-lg">
              <img src="logo.png" />
              {/*<span className="text-blue-600 font-black text-xl">N</span>*/}
            </div>
            {/*<span className="text-lg font-black text-white tracking-tight">나름청소년활동센터</span>*/}
          </div>

          {/* 크레딧 및 정보 */}
          <div className="space-y-2">
            <p className="text-slate-400 text-sm font-medium">
              © 2026 Nareum Youth Center. All rights reserved.
            </p>
            <div className="flex justify-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span>Created by CLUSTER</span>
            </div>
          </div>

          {/* 추가 링크 (필요 시) */}
          <div className="pt-4">
            <a 
              href="https://gmyouth.or.kr/nareum/index.do" 
              target="_blank" 
              rel="noreferrer"
              className="text-[15px] font-black text-slate-500 hover:text-blue-400 transition-colors border border-slate-700 px-3 py-1 rounded-full"
            >
              공식 홈페이지 바로가기
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default UserForm;