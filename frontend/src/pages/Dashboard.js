import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/authService';
import './Dashboard.css';
import {
    IconBoard, IconApproval, IconAddressBook,
    IconCalendar, IconUser, IconHR, IconChat
} from '../components/Icons';
import { getCategoryColor } from '../utils/categoryColor';

const Dashboard = memo(({ user }) => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        unreadNotices: 0,
        myPosts: 0,
        newComments: 0,
        ongoingTasks: 0
    });
    const [recentNotices, setRecentNotices] = useState([]);
    const [birthdays, setBirthdays] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = useCallback(async () => {
        try {
            const res = await api.get('/dashboard/stats');
            const data = res.data.data;
            setStats({
                unreadNotices: data.unreadNotices,
                myPosts: data.myPosts,
                newComments: data.newComments,
                ongoingTasks: data.ongoingTasks
            });
            setRecentNotices(data.recentNotices || []);
        } catch (e) {
            console.error('대시보드 데이터 조회 실패:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const formatDate = useCallback((dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).replace(/\. /g, '.').replace(/\.$/, '');
    }, []);

    const isNewPost = useCallback((dateString) => {
        const diff = Math.abs(new Date() - new Date(dateString));
        return Math.floor(diff / (1000 * 60 * 60 * 24)) <= 7;
    }, []);

    const today = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });

    const quickLinks = [
        { label: '게시판',   icon: <IconBoard size={20} />,       path: '/boards' },
        { label: '전자결재', icon: <IconApproval size={20} />,    path: '/approval' },
        { label: '주소록',   icon: <IconAddressBook size={20} />, path: '/addressbook/all' },
        { label: '캘린더',   icon: <IconCalendar size={20} />,    path: '/calendar' },
        { label: '내 정보',  icon: <IconUser size={20} />,        path: '/hr/myinfo' },
        { label: '내 설정',  icon: <IconHR size={20} />,          path: '/my-settings' },
    ];

    if (loading) {
        return (
            <div className="dashboard">
                <div className="dashboard-grid">
                    <aside className="dash-left">
                        <div className="dash-profile-card" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                            <div className="skel" style={{ width:72, height:72, borderRadius:'50%' }} />
                            <div className="skel" style={{ height:18, width:'55%' }} />
                            <div className="skel" style={{ height:13, width:'40%' }} />
                            <div className="skel" style={{ height:13, width:'60%', marginTop:4 }} />
                        </div>
                    </aside>
                    <main className="dash-main">
                        <div className="dash-card">
                            <div className="dash-card-header">
                                <div className="skel" style={{ height:15, width:80 }} />
                            </div>
                            <div className="stats-grid-2x2" style={{ marginTop:14 }}>
                                {[...Array(4)].map((_,i) => (
                                    <div key={i} className="stats-cell" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                                        <div className="skel" style={{ height:30, width:'50%' }} />
                                        <div className="skel" style={{ height:12, width:'70%' }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="dash-card">
                            <div className="dash-card-header">
                                <div className="skel" style={{ height:15, width:100 }} />
                            </div>
                            <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:10 }}>
                                {[...Array(4)].map((_,i) => (
                                    <div key={i} className="skel" style={{ height:48, borderRadius:8 }} />
                                ))}
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-grid">

                {/* ── 왼쪽: 프로필 카드 ── */}
                <aside className="dash-left">
                    <div className="dash-profile-card">
                        <div className="profile-avatar-lg">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="profile-greeting">
                            <span className="profile-name-lg">{user?.name}님,</span>
                            <span className="profile-hello-lg">안녕하세요.</span>
                        </div>
                        <div className="profile-meta">
                            {user?.position && (
                                <span className="profile-pos">{user.position}</span>
                            )}
                            {user?.department && (
                                <span className="profile-dept">{user.department}</span>
                            )}
                        </div>
                        <div className="profile-date">{today}</div>
                    </div>
                </aside>

                {/* ── 가운데: 현황 + 공지 ── */}
                <main className="dash-main">
                    <div className="dash-card">
                        <div className="dash-card-header">
                            <span className="dash-card-title">나의 현황</span>
                        </div>
                        <div className="stats-grid-2x2">
                            <div className="stats-cell">
                                <span className="stats-cell-value">{stats.unreadNotices}</span>
                                <span className="stats-cell-label">미확인 공지</span>
                            </div>
                            <div className="stats-cell">
                                <span className="stats-cell-value">{stats.myPosts}</span>
                                <span className="stats-cell-label">내가 쓴 글</span>
                            </div>
                            <div className="stats-cell">
                                <span className="stats-cell-value">{stats.newComments}</span>
                                <span className="stats-cell-label">새 댓글</span>
                            </div>
                            <div className="stats-cell">
                                <span className="stats-cell-value">{stats.ongoingTasks}</span>
                                <span className="stats-cell-label">결재 대기</span>
                            </div>
                        </div>
                    </div>

                    <div className="dash-card">
                        <div className="dash-card-header">
                            <span className="dash-card-title">최근 공지사항</span>
                            <span className="dash-card-more" onClick={() => navigate('/boards/1')}>전체보기</span>
                        </div>
                        <div className="notice-list">
                            {recentNotices.length > 0 ? (
                                recentNotices.map((notice) => (
                                    <div
                                        key={notice.id}
                                        className="notice-item"
                                        onClick={() => navigate(`/boards/1/posts/${notice.id}`)}
                                    >
                                        <div className="notice-item-top">
                                            {notice.category && (
                                                <span className="notice-badge" style={getCategoryColor(notice.category)}>
                                                    {notice.category}
                                                </span>
                                            )}
                                            {!notice.category && isNewPost(notice.created_at) && (
                                                <span className="notice-badge" style={getCategoryColor('NEW')}>NEW</span>
                                            )}
                                            <p className="notice-title">{notice.title}</p>
                                        </div>
                                        <div className="notice-meta">
                                            <span className="notice-author">{notice.author_name}</span>
                                            <span className="notice-sep">·</span>
                                            <span className="notice-date">{formatDate(notice.created_at)}</span>
                                            {notice.comment_count > 0 && (
                                                <span className="notice-comment-count">
                                                    <IconChat size={12} />
                                                    {notice.comment_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-notice">
                                    <p>최근 공지사항이 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                {/* ── 오른쪽: 바로가기 + 생일자 ── */}
                <aside className="dash-right">
                    <div className="dash-card">
                        <div className="dash-card-header">
                            <span className="dash-card-title">바로가기</span>
                        </div>
                        <div className="quicklinks-grid">
                            {quickLinks.map((link) => (
                                <div
                                    key={link.label}
                                    className="quicklink-item"
                                    onClick={() => navigate(link.path)}
                                >
                                    <div className="quicklink-icon-wrap">{link.icon}</div>
                                    <span className="quicklink-label">{link.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="dash-card">
                        <div className="dash-card-header">
                            <span className="dash-card-title">이번 주 생일자</span>
                        </div>
                        <div className="birthday-list">
                            {birthdays.length > 0 ? (
                                birthdays.map((b, i) => (
                                    <div key={i} className="birthday-item">
                                        <div className="birthday-avatar">{b.name?.charAt(0) || 'U'}</div>
                                        <div className="birthday-info">
                                            <p className="birthday-name">{b.name}</p>
                                            <p className="birthday-dept">{b.department} · {b.date}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-notice">
                                    <p>이번 주 생일자가 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

            </div>
        </div>
    );
});

Dashboard.displayName = 'Dashboard';
export default Dashboard;
