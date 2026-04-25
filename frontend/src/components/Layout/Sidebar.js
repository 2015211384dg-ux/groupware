import React, { useState, memo, useMemo, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';
import { NotificationPanel } from './Header';
import { useSettings } from '../../context/SettingsContext';
import api from '../../services/authService';
import UserAvatar from '../common/UserAvatar';
import {
    IconHome, IconBoard, IconAddressBook, IconHR, IconCalendar,
    IconApproval, IconAdmin, IconSearch, IconMessageSquare,
    IconBell, IconUser, IconSettings, IconLogout, IconBudget, IconProject
} from '../common/Icons';

const ROLE_LABEL = {
    SUPER_ADMIN: '슈퍼관리자',
    HR_ADMIN: 'HR 관리자',
    ADMIN: '관리자',
};

const Sidebar = memo(({ isOpen, onToggle, user, onLogout }) => {
    const location = useLocation();
    const navigate  = useNavigate();
    const { siteSettings } = useSettings();

    // ── 알림 ──
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotif, setShowNotif]     = useState(false);
    const notifRef = useRef(null);

    const fetchUnread = useCallback(async () => {
        try {
            const res = await api.get('/approval/notifications');
            setUnreadCount(res.data.data.unread || 0);
        } catch { /* 조용히 실패 */ }
    }, []);

    useEffect(() => {
        fetchUnread();
        const t = setInterval(fetchUnread, 30000);
        return () => clearInterval(t);
    }, [fetchUnread]);

    useEffect(() => {
        const handler = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setShowNotif(false);
            }
        };
        if (showNotif) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showNotif]);

    // ── 유저 드롭다운 ──
    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef(null);
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN'].includes(user?.role);

    useEffect(() => {
        const handler = (e) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
                setShowUserMenu(false);
            }
        };
        if (showUserMenu) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showUserMenu]);

    // ── 메뉴 구성 ──
    const menuItems = useMemo(() => {
        const items = [
            { type: 'label', title: '메인' },
            { title: '홈',    icon: <IconHome />, path: '/' },
            { type: 'label', title: '커뮤니케이션' },
            {
                title: '게시판', icon: <IconBoard />, path: '/boards',
                subItems: [
                    { title: '공지사항',   path: '/boards/1' },
                    { title: '자료실',     path: '/boards/2' },
                    { title: '자유게시판', path: '/boards/3' },
                    { title: 'FAQ',        path: '/boards/4' }
                ]
            },
            {
                title: '주소록', icon: <IconAddressBook />, path: '/addressbook',
                subItems: [
                    { title: '조직도',      path: '/addressbook/organization' },
                    { title: '전체 주소록', path: '/addressbook/all' },
                    { title: '개인 주소록', path: '/addressbook/personal' }
                ]
            },
            { type: 'label', title: '업무' },
            {
                title: 'HR', icon: <IconHR />, path: '/hr',
                subItems: [
                    { title: '내 정보',   path: '/hr/myinfo' },
                    { title: '근태 관리', path: 'https://shiftee.io/ko/accounts/login', external: true },
                    { title: '연차 신청', path: 'https://shiftee.io/ko/accounts/login', external: true }
                ]
            },
            { title: '캘린더', icon: <IconCalendar />, path: '/calendar' },
            {
                title: '결재', icon: <IconApproval />, path: '/approval',
                subItems: [
                    { title: '결재 홈',    path: '/approval?box=home' },
                    { title: '받은 결재함', path: '/approval?box=inbox' },
                    { title: '진행/완료',  path: '/approval?box=my' },
                    { title: '임시 저장',  path: '/approval?box=draft' },
                ]
            },
            { title: '프로젝트', icon: <IconProject />, path: '/project' },
            { type: 'label', title: '예산 관리' },
            {
                title: '예산 관리', icon: <IconBudget />, path: '/budget',
                subItems: [
                    { title: 'AR',           path: '/budget/ar' },
                    { title: 'AI 전표 자동화', path: '/budget/voucher-ai' },
                ]
            },
            { type: 'label', title: '기타' },
            { title: '피드백', icon: <IconMessageSquare />, path: '/feedback' },
            { title: '검색',   icon: <IconSearch />,        path: '/search' },
        ];

        if (['SUPER_ADMIN', 'HR_ADMIN', 'ADMIN'].includes(user?.role)) {
            items.push({ type: 'label', title: '관리' });
            items.push({
                title: '관리', icon: <IconAdmin />, path: '/admin',
                subItems: [
                    { title: '사용자 관리', path: '/admin/users' },
                    { title: '부서 관리',   path: '/admin/departments' },
                    { title: '시스템 설정', path: '/admin/settings' },
                    { title: '결재 관리',   path: '/admin/approval' },
                    { title: '피드백 관리', path: '/admin/feedback' },
                    ...(['SUPER_ADMIN','ADMIN'].includes(user?.role) ? [{ title: 'AR 관리', path: '/admin/ar' }] : []),
                    ...(['SUPER_ADMIN','ADMIN'].includes(user?.role) ? [{ title: 'AI 문서 관리', path: '/admin/chatbot' }] : []),
                ]
            });
        }

        return items;
    }, [user?.role]);

    // ── 펼침 상태 (path 기반) ──
    const getDefaultOpenPath = () => {
        const path = location.pathname;
        const item = menuItems.find(item =>
            item.subItems && (
                path.startsWith(item.path + '/') ||
                path.startsWith(item.path + '?') ||
                (item.path !== '/' && path === item.path) ||
                item.subItems.some(s => !s.external && path.startsWith(s.path))
            )
        );
        return item ? item.path : null;
    };

    const [openPath, setOpenPath] = useState(getDefaultOpenPath);

    useEffect(() => {
        const p = getDefaultOpenPath();
        if (p !== null) setOpenPath(p);
    }, [location.pathname]);

    const handleToggle = (path, hasSubItems) => {
        if (!hasSubItems) return;
        setOpenPath(prev => prev === path ? null : path);
    };

    const initials = user?.name?.slice(0, 1) || 'U';
    const roleLabel = ROLE_LABEL[user?.role] || '직원';

    return (
        <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>

            {/* ── 로고 영역 ── */}
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">
                    <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
                        <rect width="32" height="32" rx="8" fill="#2563EB"/>
                        <rect x="7" y="7" width="8" height="8" rx="2" fill="white" opacity="0.9"/>
                        <rect x="17" y="7" width="8" height="8" rx="2" fill="white" opacity="0.6"/>
                        <rect x="7" y="17" width="8" height="8" rx="2" fill="white" opacity="0.6"/>
                        <rect x="17" y="17" width="8" height="8" rx="2" fill="white" opacity="0.9"/>
                    </svg>
                </div>
                {isOpen && (
                    <span className="sidebar-logo-text">
                        {siteSettings?.site_name || '그룹웨어'}
                    </span>
                )}
                <button className="sidebar-toggle-btn" onClick={onToggle} title="사이드바 접기/펼치기">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isOpen
                            ? <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
                            : <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
                        }
                    </svg>
                </button>
            </div>

            {/* ── 네비게이션 ── */}
            <nav className="sidebar-nav">
                {menuItems.map((item, index) => {
                    if (item.type === 'label') {
                        return (
                            <span key={`label-${index}`} className="nav-section-label">
                                {item.title}
                            </span>
                        );
                    }

                    const isExpanded = openPath === item.path;
                    const hasSubItems = !!item.subItems;

                    return hasSubItems ? (
                        <div key={item.path} className="nav-item-group">
                            <div
                                className={`nav-item ${isExpanded ? 'active' : ''}`}
                                onClick={() => handleToggle(item.path, true)}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                {isOpen && (
                                    <>
                                        <span className="nav-title">{item.title}</span>
                                        <span className={`nav-arrow ${isExpanded ? 'open' : ''}`}>›</span>
                                    </>
                                )}
                            </div>

                            {isOpen && isExpanded && (
                                <div className="sub-nav">
                                    {item.subItems.map((subItem, subIndex) => (
                                        subItem.external ? (
                                            <a
                                                key={subIndex}
                                                href={subItem.path}
                                                className="sub-nav-item"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {subItem.title}
                                            </a>
                                        ) : (() => {
                                            const [spath, squery] = subItem.path.split('?');
                                            const isActive = squery
                                                ? location.pathname === spath && location.search === `?${squery}`
                                                : location.pathname === spath && !location.search;
                                            return (
                                                <a
                                                    key={subIndex}
                                                    href={subItem.path}
                                                    className={`sub-nav-item ${isActive ? 'active' : ''}`}
                                                    onClick={(e) => { e.preventDefault(); navigate(subItem.path); }}
                                                >
                                                    {subItem.title}
                                                </a>
                                            );
                                        })()
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            end
                            onClick={() => setOpenPath(null)}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {isOpen && <span className="nav-title">{item.title}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {/* ── Footer: 알림 + 유저 ── */}
            <div className="sidebar-footer">

                {/* 알림 벨 */}
                <div className="sb-notif-wrap" ref={notifRef}>
                    <button
                        className={`sb-notif-btn ${showNotif ? 'active' : ''}`}
                        onClick={() => { setShowNotif(p => !p); setShowUserMenu(false); }}
                        title="알림"
                    >
                        <IconBell size={18} />
                        {unreadCount > 0 && (
                            <span className="sb-notif-badge">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                        {isOpen && <span className="sb-footer-label">알림</span>}
                    </button>

                    {showNotif && (
                        <div className="sb-notif-panel-wrap">
                            <NotificationPanel onClose={() => setShowNotif(false)} onRead={fetchUnread} />
                        </div>
                    )}
                </div>

                {/* 유저 */}
                <div className="sb-user-wrap" ref={userMenuRef}>
                    <button
                        className="sb-user-btn"
                        onClick={() => { setShowUserMenu(p => !p); setShowNotif(false); }}
                    >
                        <UserAvatar name={user?.name} profileImage={user?.profile_image} size={32} />
                        {isOpen && (
                            <div className="sb-user-info">
                                <span className="sb-user-name">{user?.name}</span>
                                <span className="sb-user-role">{roleLabel}</span>
                            </div>
                        )}
                    </button>

                    {showUserMenu && (
                        <div className="sb-user-dropdown">
                            <div className="sb-dropdown-header">
                                <UserAvatar name={user?.name} profileImage={user?.profile_image} size={44} />
                                <div>
                                    <div className="sb-user-name">{user?.name}</div>
                                    <div className="sb-user-email">{user?.email}</div>
                                    <div className="sb-user-role">{user?.position || roleLabel}</div>
                                </div>
                            </div>
                            <div className="sb-dropdown-divider" />
                            <button className="sb-dropdown-item" onClick={() => { navigate('/hr/myinfo'); setShowUserMenu(false); }}>
                                <IconUser size={15} /> 내 정보
                            </button>
                            <button className="sb-dropdown-item" onClick={() => { navigate('/my-settings'); setShowUserMenu(false); }}>
                                <IconSettings size={15} /> 내 설정
                            </button>
                            {isAdmin && (
                                <button className="sb-dropdown-item" onClick={() => { navigate('/admin/settings'); setShowUserMenu(false); }}>
                                    <IconAdmin size={15} /> 시스템 설정
                                </button>
                            )}
                            <div className="sb-dropdown-divider" />
                            <button className="sb-dropdown-item sb-dropdown-logout" onClick={onLogout}>
                                <IconLogout size={15} /> 로그아웃
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;
