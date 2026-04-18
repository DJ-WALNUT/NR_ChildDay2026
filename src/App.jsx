import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import UserForm from './pages/client/UserForm';
import CheckReservation from './pages/client/CheckReservation';
import AdminBoothManager from './pages/admin/AdminBoothManager';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminMain from './pages/admin/AdminMain';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* 1. 메인 랜딩 (부스 목록) */}
          <Route path="/" element={<LandingPage />} />
          {/* 2. 사용자 신청: /reserve/1, /reserve/2 형태로 접속 */}
          <Route path="/reserve/:boothId" element={<UserForm />} />
          {/* 3. 예약 확인 */}
          <Route path="/check" element={<CheckReservation />} />
          {/* 4. 관리자 메인 (전체 통계) */}
          <Route path="/admin" element={<AdminMain />} />
          {/* 5. 부스 목록 관리 (추가/삭제/상태변경) */}
          <Route path="/admin/booths" element={<AdminBoothManager />} />
          {/* 6. 특정 부스 상세 대시보드 (신청자 명단) */}
          <Route path="/admin/booths/:boothId" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;