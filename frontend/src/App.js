import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Components
import Login from './pages/Login';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import BoardList from './pages/BoardList';
import PostList from './pages/PostList';
import PostWrite from './pages/PostWrite';
import PostDetail from './pages/PostDetail';
import Search from './pages/Search';
import Organization from './pages/Organization';
import AddressBook from './pages/AddressBook';
import PersonalContacts from './pages/PersonalContacts';
import MyInfo from './pages/MyInfo';
import UserManagement from './pages/UserManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import MySettings from './pages/MySettings';
import Calendar from './pages/Calendar';
import Approval from './pages/Approval';
import ApprovalAdmin from './pages/ApprovalAdmin';
import ApprovalWrite from './pages/ApprovalWrite';
import ApprovalDetail from './pages/ApprovalDetail';
import Feedback from './pages/Feedback';
import FeedbackAdmin from './pages/FeedbackAdmin';
import MagicLogin from './pages/MagicLogin';

// Auth 관련
import { authService } from './services/authService';
import api from './services/authService';

import { SettingsProvider } from './services/SettingsContext';
import { ToastProvider } from './components/Toast';
import PopupNotice from './components/PopupNotice';
import ForcePasswordChange from './components/ForcePasswordChange';

// 관리자 전용 라우트 가드
const AdminRoute = ({ user, children }) => {
  const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN'];
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

AdminRoute.propTypes = {
  user: PropTypes.shape({
    role: PropTypes.string.isRequired
  }),
  children: PropTypes.node.isRequired
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 인증 상태 확인
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      // 미인증 상태 (401) — 정상 케이스
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handlePasswordChanged = async () => {
    // 비밀번호 변경 후 최신 사용자 정보 다시 로드
    const updated = await authService.getCurrentUser();
    setUser(updated);
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <SettingsProvider>
    <ToastProvider>
      <Router>
        <Routes>
        {/* 데스크탑 앱 매직 로그인 */}
        <Route path="/auth/magic" element={<MagicLogin />} />

        {/* 로그인 페이지 */}
        <Route
          path="/login"
          element={
            isAuthenticated ? 
              <Navigate to="/" replace /> : 
              <Login onLogin={handleLogin} />
          } 
        />

        {/* 메인 레이아웃 */}
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <Layout user={user} onLogout={handleLogout}>
                {!!user?.require_password_change && (
                    <ForcePasswordChange onSuccess={handlePasswordChanged} />
                )}
                <PopupNotice />
                <Routes>
                  <Route path="/" element={<Dashboard user={user} />} />
                  
                  {/* Phase 5: 검색 */}
                  <Route path="/search" element={<Search />} />
                  
                  {/* Phase 2: 게시판 */}
                  <Route path="/boards" element={<BoardList />} />
                  <Route path="/boards/:boardId" element={<PostList user={user} />} />
                  <Route path="/boards/:boardId/write" element={<PostWrite />} />
                  <Route path="/boards/:boardId/posts/:postId" element={<PostDetail user={user} />} />
                  
                  {/* Phase 3: 주소록 */}
                  <Route path="/addressbook/organization" element={<Organization />} />
                  <Route path="/addressbook/all" element={<AddressBook />} />
                  <Route path="/addressbook/personal" element={<PersonalContacts />} />
                  <Route path="/addressbook/*" element={<div>개인 주소록 (개발 중)</div>} />
                  
                  {/* Phase 4: HR */}
                  <Route path="/hr/myinfo" element={<MyInfo user={user} />} />
                  <Route path="/hr" element={<Navigate to="/hr/myinfo" replace />} />

                  <Route path="/my-settings" element={<MySettings />} />

                  {/* calendar */}
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/approval" element={<Approval />} />
                  <Route path="/admin/approval" element={<AdminRoute user={user}><ApprovalAdmin /></AdminRoute>} />
                  <Route path="/approval/write" element={<ApprovalWrite />} />
                  <Route path="/approval/write/edit/:docId" element={<ApprovalWrite />} />
                  <Route path="/approval/documents/:id" element={<ApprovalDetail />} />
                  
                  {/* 피드백 */}
                  <Route path="/feedback" element={<Feedback />} />
                  <Route path="/admin/feedback" element={<AdminRoute user={user}><FeedbackAdmin /></AdminRoute>} />

                  {/* 관리 (관리자 전용) */}
                  <Route path="/admin/users" element={<AdminRoute user={user}><UserManagement currentUser={user} /></AdminRoute>} />
                  <Route path="/admin/departments" element={<AdminRoute user={user}><DepartmentManagement /></AdminRoute>} />
                  <Route path="/admin/settings" element={<AdminRoute user={user}><Settings /></AdminRoute>} />
                  
                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
    </ToastProvider>
    </SettingsProvider>
  );
}

export default App;
