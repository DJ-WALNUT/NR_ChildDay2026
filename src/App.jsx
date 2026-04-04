import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import UserForm from './pages/UserForm';
import AdminDashboard from './pages/AdminDashboard';
import CheckReservation from './pages/CheckReservation';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<UserForm />} />
          <Route path="/check" element={<CheckReservation />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;