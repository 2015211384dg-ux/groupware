import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import './App.css';

import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './components/common/Toast';
import { ConfirmProvider } from './components/common/Confirm';
import { authService } from './services/authService';
import api from './services/api';
import MaintenancePage from './pages/MaintenancePage';
import AppRoutes from './routes/AppRoutes';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN'];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState({ on: false, message: '' });
  const [sessionTimeout, setSessionTimeout] = useState(60); // 분 단위

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const check = () => {
      api.get('/settings/maintenance').then(res => {
        setMaintenance({ on: !!res.data.maintenance, message: res.data.message || '' });
      }).catch(() => {});
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
    } catch {
      // 미인증 상태 (401) — 정상 케이스
    } finally {
      setLoading(false);
    }
  };

  // 공개 설정 로드 (session_timeout 포함)
  useEffect(() => {
    api.get('/settings/public').then(res => {
      if (res.data?.success) setSessionTimeout(res.data.data.session_timeout || 60);
    }).catch(() => {});
  }, []);

  // 유휴 세션 타임아웃 — stale closure 방지를 위해 ref 사용
  const logoutRef = useRef(null);
  const handleLogout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);
  logoutRef.current = handleLogout;

  useEffect(() => {
    if (!isAuthenticated) return;
    const ms = sessionTimeout * 60 * 1000;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => logoutRef.current(), ms);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [isAuthenticated, sessionTimeout]);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handlePasswordChanged = async () => {
    const updated = await authService.getCurrentUser();
    setUser(updated);
  };


  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>로딩 중...</p>
      </div>
    );
  }

  if (maintenance.on && isAuthenticated && !ADMIN_ROLES.includes(user?.role)) {
    return <MaintenancePage message={maintenance.message} onLogout={handleLogout} />;
  }

  return (
    <SettingsProvider>
      <ToastProvider>
      <ConfirmProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes
            isAuthenticated={isAuthenticated}
            user={user}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onPasswordChanged={handlePasswordChanged}
          />
        </Router>
      </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}

export default App;
