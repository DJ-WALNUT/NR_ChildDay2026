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

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/booths`);
        const data = await res.json();
        const current = data.find(b => b.id === parseInt(boothId));
        
        setBoothInfo(current);
        
        // [추가] 진입 시 대기자 안내 경고창 로직
        if (current && current.use_waitlist) {
          setTimeout(() => {
            if (current.mode === 'time') {
              let totalSlots = 0;
              let fullSlots = 0;
              const slotLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

              for (let hour = current.start_hour; hour <= current.end_hour; hour++) {
                for (let i = 0; i < current.slots_per_hour; i++) {
                  totalSlots++;
                  const suffix = current.slots_per_hour === 1 ? '' : ` ${slotLabels[i]}타임`;
                  const timeString = `${hour}시${suffix}`;
                  const count = current.slot_counts?.[timeString] || 0;
                  if (current.limit_per_slot > 0 && count >= current.limit_per_slot) fullSlots++;
                }
              }

              if (fullSlots > 0) {
                if (fullSlots === totalSlots) {
                  alert("현재 모든 타임별 정원이 초과하여 대기자로 접수해야합니다. 대기자는 희망 시간에 공석 발생 시 참여하실 수 있습니다.");
                } else {
                  alert("현재 일부 타임 정원이 초과하여 대기자로 접수해야합니다. 대기자는 희망 시간에 공석 발생 시 참여하실 수 있습니다.");
                }
              }
            } else if (current.mode === 'fcfs') {
              if (current.total_limit > 0 && current.count >= current.total_limit) {
                alert("현재 선착순 정원이 초과하여 대기자로 접수해야합니다. 대기자는 공석 발생 시 참여하실 수 있습니다.");
              }
            }
          }, 100); // UI 렌더링 후 띄우기 위해 약간의 지연 시간 부여
        }
        
        const termRes = await fetch('/terms.md');
        const termText = await termRes.text();
        setTerms(termText);
      } catch (error) {
        console.error("데이터 로드 실패:", error);
      }
    };
    loadData();
  }, [boothId]);

  // [수정] 드롭다운 옵션 객체 배열({ value, label })로 생성
  const generateTimeOptions = () => {
    if (!boothInfo || boothInfo.mode !== 'time') return [];
    
    const options = [];
    const slotLabels = ['A', 'B', 'C', 'D', 'E', 'F']; 

    for (let hour = boothInfo.start_hour; hour <= boothInfo.end_hour; hour++) {
      for (let i = 0; i < boothInfo.slots_per_hour; i++) {
        const suffix = boothInfo.slots_per_hour === 1 ? '' : ` ${slotLabels[i]}타임`;
        const timeString = `${hour}시${suffix}`;
        
        const currentSlotCount = boothInfo.slot_counts?.[timeString] || 0;
        const isFull = boothInfo.limit_per_slot > 0 && currentSlotCount >= boothInfo.limit_per_slot;
        
        if (isFull) {
          if (!boothInfo.use_waitlist) {
            continue; // 대기자 운영 안하면 마감된 타임은 숨김
          } else {
            // [추가] 꽉 찼지만 대기자를 받을 경우 라벨에 직관적 표시
            options.push({ value: timeString, label: `${timeString} [대기자로 접수]` });
          }
        } else {
          // 정상 접수 가능
          options.push({ value: timeString, label: timeString });
        }
      }
    }
    return options;
  };

  const availableTimes = generateTimeOptions();

  const isBoothFullyClosed = () => {
    if (!boothInfo) return false;
    if (!boothInfo.is_active) return true;

    if (!boothInfo.use_waitlist) { 
      if (boothInfo.mode === 'fcfs') {
        return boothInfo.total_limit > 0 && boothInfo.count >= boothInfo.total_limit;
      } else if (boothInfo.mode === 'time') {
        return availableTimes.length === 0;
      }
    }
    return false;
  };

  const isClosed = isBoothFullyClosed();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      time: boothInfo.mode === 'fcfs' ? '선착순' : formData.time
    };

    if (boothInfo.mode === 'time' && !submitData.time) return alert("희망 체험 시간을 선택해 주세요.");
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
        if (result.is_waiting) {
          alert("제한인원이 초과하여 대기자로 신청되었습니다. 대기자는 희망 시간에 공석 발생 시 참여하실 수 있습니다.");
        }
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
          <span className="inline-block bg-slate-900 text-white text-xl font-black px-4 py-2 rounded-3xl mt-4 tracking-widest break-keep">
            {boothInfo.name}
          </span>
        </header>

        {!isClosed ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* [수정] availableTimes의 객체 구조(value, label)에 맞춰서 렌더링 */}
          {boothInfo.mode === 'time' && (
            <select 
              className={`${inputStyle} font-bold`} 
              value={formData.time}
              onChange={e => setFormData({...formData, time: e.target.value})}
              required
            >
              <option value="" disabled>희망하는 체험시간을 선택하세요</option>
              {availableTimes.map(slot => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          )}
          
          {boothInfo.mode === 'fcfs' && (
            <div className="p-6 bg-blue-50 rounded-2xl border-2 border-blue-100">
              <p className="text-blue-700 font-bold text-center">
                이 부스는 선착순으로 운영됩니다.<br/>
                신청 후 바로 체험하시면 됩니다.
              </p>
            </div>
          )}

          <p className="text-sm text-slate-700 ml-2 mb-1">* 신청자 이름이 아닌 참가자 이름으로 작성해주세요!</p>
          <input type="text" placeholder="참가자 성함 (실명 입력)" required className={inputStyle} 
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
        ) : (
          <div className="py-16 text-center space-y-4 animate-fade-in">
            <div className="text-6xl mb-6 shadow-inner rounded-full inline-block p-6 bg-slate-50">🔒</div>
            <h2 className="text-2xl font-black text-slate-800">현재 접수가 마감되었습니다.</h2>
            <p className="text-slate-500 font-medium">부스 운영이 종료되었거나 신청 인원이 가득 찼습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserForm;