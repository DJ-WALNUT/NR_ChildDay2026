import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom'; 
import { API_BASE_URL } from '../../config';
import Footer from '../../components/Footer';

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
          }, 100); 
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
            continue; 
          } else {
            options.push({ value: timeString, label: `${timeString} [대기자로 접수]` });
          }
        } else {
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

  if (!boothInfo) return <div className="min-h-screen bg-sky-50 flex items-center justify-center text-sky-600 font-black">로딩중... 🫧</div>;

  // 몽글몽글한 둥근 입력창 스타일
  const inputStyle = "w-full px-6 py-4 bg-white border-2 border-sky-100 rounded-full focus:ring-4 focus:ring-sky-100 focus:border-sky-400 outline-none transition-all text-base font-bold text-gray-700 placeholder:font-medium placeholder:text-gray-300 shadow-sm";

  return (
    <div className="min-h-screen bg-sky-50 pb-20 font-sans relative overflow-hidden">
      {/* 배경 비눗방울 장식 */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-pink-200 rounded-full blur-[80px] opacity-40 -mr-32 -mt-32 pointer-events-none" />
      <div className="absolute bottom-10 left-0 w-80 h-80 bg-blue-200 rounded-full blur-[80px] opacity-40 -ml-32 pointer-events-none" />

      <div className="w-full px-4 pt-6 max-w-xl mx-auto relative z-10">
        <Link 
          to={`/check/${boothId}`}
          className="w-full flex items-center justify-center gap-2 py-4 bg-white text-sky-500 rounded-full font-black shadow-lg border-2 border-sky-100 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <span className="tracking-tight">🔍 내 신청 정보 확인하기</span>
        </Link>
      </div>

      <div className="max-w-xl mx-auto my-8 p-8 bg-white/90 backdrop-blur-md rounded-[3.5rem] shadow-xl shadow-sky-100 border-4 border-white relative z-10">
        <header className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 pb-4">
            <div className="rounded-xl flex items-center justify-center">
              <img className="inline-block w-40 drop-shadow-md" src="/logo.png" alt="Logo" />
            </div>
            <p className="text-xl font-bold text-sky-200 pb-1">×</p>
            <div className="rounded-xl flex items-center justify-center">
              <img className="inline-block w-40 drop-shadow-md" src="/logo_su.png" alt="Logo" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-sky-900 leading-tight tracking-tighter">
            2026년 광명시 청소년의 달<br/>기념행사 <span className="text-pink-400">오월의 난장</span><br/>체험부스 <span className="text-sky-500 font-extrabold">신청</span>
          </h1>
          <span className="inline-block bg-yellow-400 text-white text-xl font-black px-6 py-2 rounded-3xl mt-5 tracking-widest break-keep shadow-md shadow-yellow-100">
            {boothInfo.name}
          </span>
        </header>

        {!isClosed ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {boothInfo.mode === 'time' && (
            <select 
              className={`${inputStyle} font-bold appearance-none`} 
              value={formData.time}
              onChange={e => setFormData({...formData, time: e.target.value})}
              required
            >
              <option value="" disabled>희망하는 체험시간을 선택하세요 ☁️</option>
              {availableTimes.map(slot => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          )}
          
          {boothInfo.mode === 'fcfs' && (
            <div className="p-6 bg-sky-50 rounded-[2rem] border-2 border-sky-100">
              <p className="text-sky-700 font-bold text-center leading-relaxed">
                이 부스는 선착순으로 운영됩니다.<br/>
                신청 후 바로 체험하시면 됩니다! 🫧
              </p>
            </div>
          )}

          <p className="text-sm text-sky-600 ml-4 mb-1 font-bold">* 신청자 이름이 아닌 참가자 이름으로 작성해주세요!</p>
          <input type="text" placeholder="참가자 성함 (실명 입력)" required className={inputStyle} 
            onChange={e => setFormData({...formData, name: e.target.value})} />

          <div className="grid grid-cols-2 gap-3">
            {['남', '여'].map((g) => (
              <button key={g} type="button" 
                onClick={() => setFormData({...formData, gender: g})}
                className={`py-4 text-lg rounded-full font-black transition-all border-2 ${formData.gender === g ? 'bg-sky-400 text-white border-sky-400 shadow-lg shadow-sky-200' : 'bg-white text-gray-400 border-sky-100 hover:border-sky-200'}`}>
                {g}
              </button>
            ))}
          </div>

          <select className={`${inputStyle} font-bold appearance-none`} value={formData.ageGroup} onChange={e => setFormData({...formData, ageGroup: e.target.value})}>
            {["0~8세", "9~13세", "14~16세", "17~19세", "20~24세", "24세 이상"].map(age => <option key={age} value={age}>{age}</option>)}
          </select>

          <input type="tel" placeholder="임의의 식별번호 (숫자만 4자리 입력)" required className={inputStyle} 
            onChange={e => setFormData({...formData, phone: e.target.value})} />

          <div className="space-y-3">
            <label className="flex items-center gap-4 cursor-pointer p-4 bg-white rounded-full border-2 border-sky-50 has-[:checked]:border-sky-300 has-[:checked]:bg-sky-50 transition-all shadow-sm">
              <input type="checkbox" className="w-6 h-6 rounded-full border-2 border-gray-300 text-sky-400 focus:ring-sky-200"
                checked={agreed} onChange={e => setAgreed(e.target.checked)} />
              <span className="text-sm font-black text-sky-800">위 체험부스를 신청합니다</span>
            </label>
          </div>

          <button className="w-full bg-gradient-to-r from-sky-400 to-blue-400 text-white py-5 rounded-full font-black text-xl hover:shadow-lg hover:shadow-sky-200 transition-all active:scale-95">
            신청서 제출하기 🫧
          </button>
        </form>
        ) : (
          <div className="py-16 text-center space-y-4 animate-fade-in">
            <div className="text-6xl mb-6 shadow-sm rounded-full inline-block p-6 bg-sky-50 border-4 border-white">🌙</div>
            <h2 className="text-2xl font-black text-sky-900">현재 접수가 마감되었습니다.</h2>
            <p className="text-sky-600 font-medium">부스 운영이 종료되었거나 신청 인원이 가득 찼습니다.</p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default UserForm;