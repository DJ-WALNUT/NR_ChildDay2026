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

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-md mx-auto pt-20">
        <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">나름청소년활동센터 <br/> 체험부스</h1>
        <p className="text-slate-500 font-bold mb-12">체험하고 싶은 부스를 선택해 주세요.</p>
        
        <div className="grid gap-6">
          {booths.length > 0 ? (
            booths.map(booth => (
              <Link 
                key={booth.id} 
                to={`/reserve/${booth.id}`}
                className="group bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all block"
              >
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-black text-slate-900 group-hover:text-blue-600">{booth.name}</span>
                  <span className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-slate-200 group-hover:border-blue-200">
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                  </span>
                </div>
              </Link>
              ))
            ) : (
            <p className="text-center text-slate-400 font-bold py-20 bg-slate-50 rounded-3xl">
              현재 운영 중인 체험 부스가 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;