// src/components/AdminRoute.jsx
import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';

const AdminRoute = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(
    sessionStorage.getItem('adminAuth') === 'true'
  );

  useEffect(() => {
    if (!isAuthenticated) {
      // 환경변수에서 비밀번호를 가져옵니다. 설정 안 되어있으면 기본값 사용.
      const correctPassword = import.meta.env.VITE_ADMIN_PASSWORD || '1234'; 
      const input = window.prompt('관리자 비밀번호를 입력해주세요.');

      if (input === correctPassword) {
        sessionStorage.setItem('adminAuth', 'true');
        setIsAuthenticated(true);
      } else {
        alert('비밀번호가 일치하지 않거나 취소되었습니다.');
        navigate('/'); // 메인 페이지로 튕겨냅니다.
      }
    }
  }, [isAuthenticated, navigate]);

  // 인증되기 전에는 아무것도 보여주지 않습니다.
  if (!isAuthenticated) return null; 

  // 인증되면 하위 라우트(관리자 페이지들)를 렌더링합니다.
  return <Outlet />;
};

export default AdminRoute;