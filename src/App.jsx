import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import LandingPage from './pages/LandingPage';
import UserForm from './pages/client/UserForm';
import CheckReservation from './pages/client/CheckReservation';
import AdminBoothList from './pages/admin/AdminBoothList';
import AdminDetail from './pages/admin/AdminDetail';
import AdminMain from './pages/admin/AdminMain';
import AdminSummary from './pages/admin/AdminSummary';
import AdminBoothBatch from './pages/admin/AdminBoothBatch';
import AdminEventManager from './pages/admin/AdminEventManager';
import AdminRoute from './components/AdminRoute'; // [추가]

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<LandingPage />} />{/* 1. 메인 랜딩 (부스 목록) */}
          <Route path="/reserve/:boothId" element={<UserForm />} />{/* 2. 사용자 신청: /reserve/1, /reserve/2 형태로 접속 */}
          <Route path="/check/:boothId" element={<CheckReservation />} />{/* 3. 예약 확인 */}


            <Route path="/manage" element={<AdminMain />} />{/* - 관리자 메인 (전체 통계) */}
            <Route path="/manage/events" element={<AdminEventManager />} />{/* - 행사 목록 관리 (추가/삭제/변경) */}
            <Route path="/manage/booths" element={<AdminBoothList />} />{/* - 부스 목록 관리 (추가/삭제/상태변경) */}
            <Route path="/manage/booths/:boothId" element={<AdminDetail />} />{/* - 특정 부스 상세 대시보드 (신청자 명단) */}
            <Route path="/manage/summary" element={<AdminSummary />} />
            <Route path="/manage/batch" element={<AdminBoothBatch />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;