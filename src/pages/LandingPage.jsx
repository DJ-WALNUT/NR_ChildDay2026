import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const LandingPage = () => {
  const [booths, setBooths] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/booths`)
      .then(res => res.json())
      .then(data => setBooths(data.filter(b => b.is_active)));
  }, []);

  // [수정] 부스 정원이 '모두' 찼는지 검사하는 정밀 함수
  const isBoothFullyClosed = (booth) => {
    if (!booth.use_waitlist) { 
      if (booth.mode === 'fcfs') {
        return booth.total_limit > 0 && booth.count >= booth.total_limit;
      } else if (booth.mode === 'time') {
        // 총인원 검사가 아닌 '각 타임별 정원'이 모두 찼는지 검사합니다.
        let allSlotsFull = true;
        const slotLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
        
        for (let hour = booth.start_hour; hour <= booth.end_hour; hour++) {
          for (let i = 0; i < booth.slots_per_hour; i++) {
            const suffix = booth.slots_per_hour === 1 ? '' : ` ${slotLabels[i]}타임`;
            const timeString = `${hour}시${suffix}`;
            const currentCount = booth.slot_counts?.[timeString] || 0;
            
            // 빈 자리가 하나라도 있는 타임이 발견되면 전체 마감이 아님!
            if (booth.limit_per_slot === 0 || currentCount < booth.limit_per_slot) {
              allSlotsFull = false;
              break; 
            }
          }
          if (!allSlotsFull) break;
        }
        return allSlotsFull;
      }
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-md mx-auto pt-20">
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">나름청소년활동센터 <br/> 체험부스</h1>
        <p className="text-slate-500 font-bold mb-12">체험하고 싶은 부스를 선택해 주세요.</p>
        
        <div className="grid gap-6">
          {booths.length > 0 ? (
            booths.map(booth => {
              const closed = isBoothFullyClosed(booth);
              
              return closed ? (
                <div key={booth.id} className="group bg-slate-50 px-6 py-4 rounded-[2.5rem] border-2 border-slate-100 opacity-50 grayscale cursor-not-allowed block">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-black text-slate-500">{booth.name}</span>
                    <span className="bg-red-500 text-white text-sm font-black px-4 py-1.5 rounded-full">마감됨</span>
                  </div>
                </div>
              ) : (
                <Link key={booth.id} to={`/reserve/${booth.id}`} className="group bg-slate-50 px-6 py-4 rounded-[2.5rem] border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all block">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-black text-slate-900 group-hover:text-blue-600">{booth.name}</span>
                    <span className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-slate-200 group-hover:border-blue-200">
                      <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                    </span>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="text-center text-slate-400 font-bold py-20 bg-slate-50 rounded-3xl">현재 운영 중인 체험 부스가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;