import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import AdminHeader from './AdminHeader';

const AdminBoothManager = () => {
  const [booths, setBooths] = useState([]);
  const [newBoothName, setNewBoothName] = useState("");
  const navigate = useNavigate();

  const fetchBooths = async () => {
    const res = await fetch(`${API_BASE_URL}/api/booths`);
    const data = await res.json();
    setBooths(data);
  };

  useEffect(() => { fetchBooths(); }, []);

  const addBooth = async () => {
    if (!newBoothName) return;
    await fetch(`${API_BASE_URL}/api/booths`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBoothName })
    });
    setNewBoothName("");
    fetchBooths();
  };

  const toggleBooth = async (id) => {
    await fetch(`${API_BASE_URL}/api/booths/${id}/toggle`, { method: 'PATCH' });
    fetchBooths();
  };

  const deleteBooth = async (id) => {
    if (!window.confirm("부스와 모든 예약 데이터가 삭제됩니다.")) return;
    await fetch(`${API_BASE_URL}/api/booths/${id}`, { method: 'DELETE' });
    fetchBooths();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader />
      <main className="max-w-4xl mx-auto p-8 space-y-8">
        <div className="flex gap-4 bg-white p-6 rounded-[2rem] border-2 border-slate-900 shadow-lg">
          <input 
            className="flex-1 px-6 font-bold outline-none"
            placeholder="새 부스 이름"
            value={newBoothName}
            onChange={(e) => setNewBoothName(e.target.value)}
          />
          <button onClick={addBooth} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black">추가</button>
        </div>

        <div className="grid gap-4">
          {booths.map(booth => (
            <div key={booth.id} className="bg-white p-6 rounded-[1.5rem] border flex justify-between items-center shadow-sm">
              <div onClick={() => navigate(`/admin/booths/${booth.id}`)} className="cursor-pointer flex-1">
                <h3 className="text-xl font-black">{booth.name}</h3>
                <p className="text-slate-400 font-bold">신청: {booth.count}명</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => toggleBooth(booth.id)} className={`px-4 py-2 rounded-xl font-bold ${booth.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {booth.is_active ? "운영 중" : "마감됨"}
                </button>
                <button onClick={() => deleteBooth(booth.id)} className="text-slate-300 hover:text-red-500">삭제</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminBoothManager;