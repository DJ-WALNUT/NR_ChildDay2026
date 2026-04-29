import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom'; 
import { API_BASE_URL } from '../../config';

const UserForm = () => {
  const { boothId } = useParams(); 
  const navigate = useNavigate();
  const [boothInfo, setBoothInfo] = useState(null);
  const [formData, setFormData] = useState({
    name: '', gender: '', ageGroup: '0~8세', phone: '', time: ''
  });
  const [terms, setTerms] = useState("");
  const [agreed, setAgreed] = useState(false);
  
  // [추가] 동적으로 생성할 시간 슬롯을 State로 관리합니다.
  const [timeSlots, setTimeSlots] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const res = await fetch(`${API_BASE_URL}/api/booths`);
      const data = await res.json();
      const current = data.find(b => b.id === parseInt(boothId));
      
      if (current && !current.is_active) {
        alert("현재 이 부스는 신청이 마감되었습니다.");
        navigate('/');
        return;
      }
      setBoothInfo(current);
      
      // [수정] 서버에서 받아온 부스 설정에 맞춰 시간 슬롯을 동적으로 생성합니다.
      if (current && current.mode === 'time') {
        const slots = [];
        const slotLabels = ['A', 'B', 'C', 'D', 'E', 'F']; // 최대 6타임까지 대응
        
        // start_hour 부터 end_hour 까지 반복
        for (let hour = current.start_hour; hour <= current.end_hour; hour++) {
          // slots_per_hour 갯수만큼 A, B, C 분할 생성
          for (let i = 0; i < current.slots_per_hour; i++) {
            // 시간당 타임이 1개면 '11시', 여러 개면 '11시 A타임' 형태로 생성
            const suffix = current.slots_per_hour === 1 ? '' : ` ${slotLabels[i]}타임`;
            slots.push(`${hour}시${suffix}`);
          }
        }
        setTimeSlots(slots);
      }
      
      const termRes = await fetch('/terms.md');
      const termText = await termRes.text();
      setTerms(termText);
    };
    loadData();
  }, [boothId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      time: boothInfo.mode === 'fcfs' ? '선착순 접수' : formData.time
    };

    if (!submitData.time) {
      alert("희망 체험 시간을 선택해 주세요.");
      return;
    }
    if (!formData.gender) return alert("성별을 선택해 주세요.");
    if (!agreed) return alert("필수 약관에 동의해 주세요.");

    const cleanPhone = formData.phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length !== 4) return alert("식별번호 4자리를 정확히 입력해 주세요.");

    try {
      const response = await fetch(`${API_BASE_URL}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...submitData, booth_id: parseInt(boothId) }) 
      });

      if (response.ok) {
        const result = await response.json();
        // 백엔드에서 넘겨준 is_waiting 플래그 확인
        if (result.is_waiting) alert("제한인원이 초과하여 대기자로 신청되었습니다.");
        // status 속성을 autoCheck 객체에 포함하여 넘겨줍니다.
        navigate(`/check/${boothId}`, { state: { autoCheck: { ...submitData, id: result.id, status: result.status } } });
      } else {
        const err = await response.json();
        alert(err.error || "신청에 실패했습니다.");
      }
    } catch (error) {
      alert("서버 연결에 실패했습니다.");
    }
  };

  if (!boothInfo) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-black">LOADING...</div>;

  const inputStyle = "w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all text-base font-bold text-gray-900 placeholder:font-medium placeholder:text-gray-400";

  return (
    <div className="min-h-screen bg-slate-900 pb-20 font-sans">
      {/* ... 상단 배너 및 로고 생략 (기존 코드와 완벽히 동일) ... */}
      <div className="w-full px-4 pt-6 max-w-xl mx-auto">
        <Link 
          to={`/check/${boothId}`}
          className="w-full flex items-center justify-center gap-2 py-4 bg-sky-600 text-white rounded-2xl font-black shadow-xl border-b-4 border-sky-800 active:border-b-0 active:translate-y-1 transition-all"
        >
          <span className="tracking-tight">🔍 내 신청 정보 확인하기</span>
        </Link>
      </div>

      <div className="max-w-xl mx-auto my-8 p-8 bg-white rounded-[2.5rem] shadow-2xl border-t-8 border-yellow-400 relative">
        <header className="text-center mb-10">
            <div className="rounded-xl flex items-center justify-center">
              <img className="inline-block w-60" src="/logo.png" alt="Logo" />
            </div>
          <h1 className="text-3xl font-black text-slate-900 leading-tight tracking-tighter">
            체험부스 <span className="text-blue-600 font-extrabold">신청</span>
          </h1>
          <span className="inline-block bg-slate-900 text-white text-xl font-black px-4 py-2 rounded-full mt-4 tracking-[0.2em] uppercase">
            {boothInfo ? boothInfo.name : "로딩 중..."}
          </span>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* 드롭다운 (생성된 timeSlots 배열을 활용) */}
          {boothInfo?.mode === 'time' && (
            <select 
              className={`${inputStyle} font-bold`} 
              value={formData.time}
              onChange={e => setFormData({...formData, time: e.target.value})}
              required
            >
              <option value="" disabled>희망하는 체험시간을 선택하세요</option>
              {timeSlots.map(slot => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          )}

          {/* ... (이하 모든 UI 기존 코드와 완벽히 동일) ... */}
          
          {boothInfo?.mode === 'fcfs' && (
            <div className="p-6 bg-blue-50 rounded-2xl border-2 border-blue-100">
              <p className="text-blue-700 font-bold text-center">
                이 부스는 선착순으로 운영됩니다.<br/>
                신청 후 바로 체험하시면 됩니다.
              </p>
            </div>
          )}

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

          <select className={`${inputStyle} font-bold`} value={formData.ageGroup} onChange={e => setFormData({...formData, ageGroup: e.target.value})}>
            {["0~8세", "9~13세", "14~16세", "17~19세", "20~24세", "24세 이상"].map(age => <option key={age} value={age}>{age}</option>)}
          </select>

          <input type="tel" placeholder="임의의 식별번호 (숫자만 4자리 입력)" required className={inputStyle} 
            onChange={e => setFormData({...formData, phone: e.target.value})} />

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
          <div className="flex items-center gap-3">
            <div className="w-70 rounded-xl flex items-center justify-center shadow-lg">
              <img src="/logo.png" alt="Logo" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-slate-400 text-sm font-medium">
              © 2026 Nareum Youth Center.<br/>
              All rights reserved.
            </p>
            <div className="flex justify-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span>Created by CLUSTER</span>
            </div>
          </div>
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