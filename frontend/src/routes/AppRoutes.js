import React, { Suspense, lazy } from 'react';
import PropTypes from 'prop-types';
import { Routes, Route, Navigate } from 'react-router-dom';

import Layout from '../components/Layout/Layout';
import ForcePasswordChange from '../components/common/ForcePasswordChange';
import PopupNotice from '../components/common/PopupNotice';

// 셸 바깥 진입점 — eager
import Login from '../pages/Login';
import MagicLogin from '../pages/MagicLogin';

// 페이지 — lazy (방문할 때만 로드)
const Dashboard        = lazy(() => import('../pages/Dashboard'));
const BoardList        = lazy(() => import('../pages/BoardList'));
const PostList         = lazy(() => import('../pages/PostList'));
const PostWrite        = lazy(() => import('../pages/PostWrite'));
const PostDetail       = lazy(() => import('../pages/PostDetail'));
const Search           = lazy(() => import('../pages/Search'));
const Organization     = lazy(() => import('../pages/Organization'));
const AddressBook      = lazy(() => import('../pages/AddressBook'));
const PersonalContacts = lazy(() => import('../pages/PersonalContacts'));
const MyInfo           = lazy(() => import('../pages/MyInfo'));
const MySettings       = lazy(() => import('../pages/MySettings'));
const Calendar         = lazy(() => import('../pages/Calendar'));
const Approval         = lazy(() => import('../pages/Approval'));
const ApprovalWrite    = lazy(() => import('../pages/ApprovalWrite'));
const ApprovalDetail   = lazy(() => import('../pages/ApprovalDetail'));
const AR               = lazy(() => import('../pages/AR'));
const VoucherAI        = lazy(() => import('../pages/VoucherAI'));
const Chatbot          = lazy(() => import('../pages/Chatbot'));
const Feedback         = lazy(() => import('../pages/Feedback'));
const NotFound         = lazy(() => import('../pages/NotFound'));
const ProjectHub       = lazy(() => import('../pages/ProjectHub'));
const ProjectDetail    = lazy(() => import('../pages/ProjectDetail'));
const MyComments       = lazy(() => import('../pages/MyComments'));

// 관리자 페이지 — 일반 사용자는 절대 로드되지 않음
const UserManagement      = lazy(() => import('../pages/UserManagement'));
const DepartmentManagement = lazy(() => import('../pages/DepartmentManagement'));
const Settings            = lazy(() => import('../pages/Settings'));
const ApprovalAdmin       = lazy(() => import('../pages/ApprovalAdmin'));
const ARAdmin             = lazy(() => import('../pages/ARAdmin'));
const FeedbackAdmin       = lazy(() => import('../pages/FeedbackAdmin'));
const ChatbotAdmin        = lazy(() => import('../pages/ChatbotAdmin'));
const AccessReview        = lazy(() => import('../pages/AccessReview'));

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN'];

const AdminRoute = ({ user, children }) => {
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

AdminRoute.propTypes = {
  user: PropTypes.shape({ role: PropTypes.string.isRequired }),
  children: PropTypes.node.isRequired
};

const PageLoader = () => (
  <div className="page-loader">
    <div className="page-loader-spinner" />
  </div>
);

function AppRoutes({ isAuthenticated, user, onLogin, onLogout, onPasswordChanged }) {
  return (
    <Routes>
      <Route path="/auth/magic" element={<MagicLogin />} />

      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login onLogin={onLogin} />}
      />

      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <Layout user={user} onLogout={onLogout}>
              {!!user?.require_password_change && (
                <ForcePasswordChange onSuccess={onPasswordChanged} />
              )}
              <PopupNotice />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Dashboard user={user} />} />
                  <Route path="/search" element={<Search />} />

                  <Route path="/boards" element={<BoardList />} />
                  <Route path="/boards/:boardId" element={<PostList user={user} />} />
                  <Route path="/boards/:boardId/write" element={<PostWrite user={user} />} />
                  <Route path="/boards/:boardId/posts/:postId" element={<PostDetail user={user} />} />

                  <Route path="/addressbook/organization" element={<Organization />} />
                  <Route path="/addressbook/all" element={<AddressBook />} />
                  <Route path="/addressbook/personal" element={<PersonalContacts />} />
                  <Route path="/addressbook/*" element={<div>개인 주소록 (개발 중)</div>} />

                  <Route path="/hr/myinfo" element={<MyInfo user={user} />} />
                  <Route path="/hr" element={<Navigate to="/hr/myinfo" replace />} />
                  <Route path="/my-settings" element={<MySettings />} />

                  <Route path="/calendar" element={<Calendar />} />

                  <Route path="/approval" element={<Approval />} />
                  <Route path="/approval/write" element={<ApprovalWrite />} />
                  <Route path="/approval/write/edit/:docId" element={<ApprovalWrite />} />
                  <Route path="/approval/documents/:id" element={<ApprovalDetail />} />
                  <Route path="/admin/approval" element={<AdminRoute user={user}><ApprovalAdmin /></AdminRoute>} />

                  <Route path="/budget/ar" element={<AR user={user} />} />
                  <Route path="/budget/voucher-ai" element={<VoucherAI />} />
                  <Route path="/budget" element={<Navigate to="/budget/ar" replace />} />
                  <Route path="/admin/ar" element={<AdminRoute user={user}><ARAdmin user={user} /></AdminRoute>} />

                  <Route path="/my-comments" element={<MyComments />} />

                  <Route path="/chatbot" element={<Chatbot />} />
                  <Route path="/feedback" element={<Feedback />} />
                  <Route path="/project" element={<ProjectHub />} />
                  <Route path="/project/:id" element={<ProjectDetail />} />

                  <Route path="/admin/users" element={<AdminRoute user={user}><UserManagement currentUser={user} /></AdminRoute>} />
                  <Route path="/admin/departments" element={<AdminRoute user={user}><DepartmentManagement /></AdminRoute>} />
                  <Route path="/admin/settings" element={<AdminRoute user={user}><Settings /></AdminRoute>} />
                  <Route path="/admin/feedback" element={<AdminRoute user={user}><FeedbackAdmin /></AdminRoute>} />
                  <Route path="/admin/chatbot" element={<AdminRoute user={user}><ChatbotAdmin /></AdminRoute>} />
                  <Route path="/admin/access-review" element={<AdminRoute user={user}><AccessReview /></AdminRoute>} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

AppRoutes.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
  user: PropTypes.object,
  onLogin: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  onPasswordChanged: PropTypes.func.isRequired
};

export default AppRoutes;
