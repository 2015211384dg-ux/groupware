import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../services/SettingsContext';
import api from '../../services/authService';
import './Header.css';
import { IconBell, IconSettings, IconApproval, IconLogout, IconUser } from '../../components/Icons';

// 알림 타입별 아이콘/색상
const NOTIF_META = {
    REQUEST:  { icon: '→', color: '#667eea', label: '결재 요청' },
    APPROVED: { icon: '✓', color: '#2f855a', label: '승인 완료' },
    REJECTED: { icon: '❌', color: '#e53e3e', label: '반려'      },
    COMMENT:  { icon: '💬', color: '#f6ad55', label: '의견'      },
    CC:       { icon: '◎', color: '#888',    label: '참조'      },
};

const formatTime = (d) => {
    const diff = Date.now() - new Date(d);
    if (diff < 60000)    return '방금 전';
    if (diff < 3600000)  return `${Math.floor(diff/60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}시간 전`;
    return new Date(d).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit' });
};

// ─── 알림 드롭다운 ─────────────────────────
function NotificationPanel({ onClose }) {
    const navigate  = useNavigate();
    const [notifs, setNotifs]   = useState([]);
    const [unread, setUnread]   = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/approval/notifications').then(res => {
            setNotifs(res.data.data.notifications);
            setUnread(res.data.data.unread);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const handleReadAll = async () => {
        try {
            await api.put('/approval/notifications/read');
            setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnread(0);
        } catch(e) { console.error(e); }
    };

    const handleDelete = async (e, notifId) => {
        e.stopPropagation();
        try {
            await api.delete(`/approval/notifications/${notifId}`);
            setNotifs(prev => {
                const next = prev.filter(n => n.id !== notifId);
                setUnread(next.filter(n => !n.is_read).length);
                return next;
            });
        } catch(e) { console.error(e); }
    };

    const handleClick = async (notif) => {
        // 클릭 시 읽음 처리 후 해당 문서로 이동
        if (!notif.is_read) {
            setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
            setUnread(prev => Math.max(0, prev - 1));
        }
        onClose();
        navigate(`/approval/documents/${notif.document_id}`);
    };

    return (
        <div className="notif-panel">
            <div className="notif-panel-header">
                <span className="notif-panel-title">
                    결재 알림
                    {unread > 0 && <span className="notif-unread-count">{unread}</span>}
                </span>
                {unread > 0 && (
                    <button className="notif-read-all" onClick={handleReadAll}>
                        전체 읽음
                    </button>
                )}
            </div>

            <div className="notif-list">
                {loading ? (
                    <div className="notif-empty">로딩 중...</div>
                ) : notifs.length === 0 ? (
                    <div className="notif-empty">
                        <IconBell size={32} style={{opacity:0.25}} />
                        <span>새로운 알림이 없습니다.</span>
                    </div>
                ) : notifs.map(notif => {
                    const meta = NOTIF_META[notif.type] || NOTIF_META.REQUEST;
                    return (
                        <div
                            key={notif.id}
                            className={`notif-item ${notif.is_read ? 'read' : 'unread'}`}
                            onClick={() => handleClick(notif)}
                        >
                            <div className="notif-icon" style={{ background: meta.color + '18', color: meta.color }}>
                                {meta.icon}
                            </div>
                            <div className="notif-content">
                                <div className="notif-type-label" style={{ color: meta.color }}>
                                    {meta.label}
                                </div>
                                <div className="notif-msg">{notif.message}</div>
                                <div className="notif-time">{formatTime(notif.created_at)}</div>
                            </div>
                            {!notif.is_read && <div className="notif-dot" />}
                            <button
                                className="notif-delete-btn"
                                onClick={(e) => handleDelete(e, notif.id)}
                                title="삭제"
                            >×</button>
                        </div>
                    );
                })}
            </div>

            <div className="notif-panel-footer" onClick={() => { onClose(); navigate('/approval'); }}>
                결재함 전체보기 →
            </div>
        </div>
    );
}

// ─── 메인 Header ──────────────────────────
function Header({ user, onLogout, onToggleSidebar }) {
    const [showUserMenu, setShowUserMenu]   = useState(false);
    const [showNotif, setShowNotif]         = useState(false);
    const [unreadCount, setUnreadCount]     = useState(0);
    const { siteSettings } = useSettings();
    const navigate = useNavigate();
    const notifRef = useRef(null);

    // 미읽 알림 수 폴링 (30초마다)
    const fetchUnread = useCallback(async () => {
        try {
            const res = await api.get('/approval/notifications');
            setUnreadCount(res.data.data.unread || 0);
        } catch(e) { /* 조용히 실패 */ }
    }, []);

    useEffect(() => {
        fetchUnread();
        const timer = setInterval(fetchUnread, 30000);
        return () => clearInterval(timer);
    }, [fetchUnread]);

    // 패널 외부 클릭 시 닫기
    useEffect(() => {
        const handler = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setShowNotif(false);
            }
        };
        if (showNotif) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showNotif]);

    const handleMenuClick = (path) => {
        navigate(path);
        setShowUserMenu(false);
    };

    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN'].includes(user?.role);

    const handleBellClick = () => {
        setShowNotif(prev => !prev);
        setShowUserMenu(false);
    };

    return (
        <header className="header">
            <div className="header-left">
                <button className="menu-toggle" onClick={onToggleSidebar}>☰</button>
                <h1 className="header-logo">{siteSettings.site_name}</h1>
            </div>

            <div className="header-right">
                {/* 🔔 알림 벨 */}
                <div className="notif-wrap" ref={notifRef}>
                    <button
                        className={`notification-button ${showNotif ? 'active' : ''}`}
                        onClick={handleBellClick}
                    >
                        <IconBell size={20} />
                        {unreadCount > 0 && (
                            <span className="notification-badge">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotif && (
                        <NotificationPanel onClose={() => setShowNotif(false)} />
                    )}
                </div>

                {/* 👤 유저 메뉴 */}
                <div className="user-menu">
                    <button
                        className="user-button"
                        onClick={() => { setShowUserMenu(!showUserMenu); setShowNotif(false); }}
                    >
                        <div className="user-avatar">{user?.name?.charAt(0) || 'U'}</div>
                        <span className="user-name">{user?.name}</span>
                        <span className="user-dropdown">▼</span>
                    </button>

                    {showUserMenu && (
                        <>
                            <div className="dropdown-overlay" onClick={() => setShowUserMenu(false)} />
                            <div className="user-dropdown-menu">
                                <div className="dropdown-header">
                                    <div className="dropdown-avatar">{user?.name?.charAt(0) || 'U'}</div>
                                    <div className="dropdown-info">
                                        <p className="dropdown-name">{user?.name}</p>
                                        <p className="dropdown-email">{user?.email}</p>
                                        <p className="dropdown-role">{user?.position || '직원'}</p>
                                    </div>
                                </div>
                                <div className="dropdown-divider" />
                                <button className="dropdown-item" onClick={() => handleMenuClick('/hr/myinfo')}>
                                    👤 내 정보
                                </button>
                                <button className="dropdown-item" onClick={() => handleMenuClick('/my-settings')}>
                                    내 설정
                                </button>
                                <button className="dropdown-item" onClick={() => handleMenuClick('/approval')}>
                                    결재함
                                    {unreadCount > 0 && (
                                        <span className="dropdown-notif-badge">{unreadCount}</span>
                                    )}
                                </button>
                                {isAdmin && (
                                    <button className="dropdown-item" onClick={() => handleMenuClick('/admin/settings')}>
                                        🔧 시스템 설정
                                    </button>
                                )}
                                <div className="dropdown-divider" />
                                <button className="dropdown-item logout" onClick={onLogout}>
                                    🚪 로그아웃
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}

export default Header;
