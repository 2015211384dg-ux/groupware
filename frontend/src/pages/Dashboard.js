import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/authService';
import './Dashboard.css';
import { IconBell, IconEdit, IconChat, IconCalendar } from '../components/Icons';
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
            // 대시보드 통계 조회
            const statsResponse = await api.get('/dashboard/stats');
            const data = statsResponse.data.data;
            
            console.log('📊 대시보드 데이터:', data);
            
            setStats({
                unreadNotices: data.unreadNotices,
                myPosts: data.myPosts,
                newComments: data.newComments,
                ongoingTasks: data.ongoingTasks
            });
            
            console.log('📋 최근 공지사항:', data.recentNotices);
            setRecentNotices(data.recentNotices || []);
        } catch (error) {
            console.error('대시보드 데이터 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [/*fetchDashboardData*/]);

    const formatDate = useCallback((dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\. /g, '.').replace(/\.$/, '');
    }, []);

    const isNewPost = useCallback((dateString) => {
        const postDate = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - postDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
    }, []);

    const handleNoticeClick = useCallback((noticeId) => {
        navigate(`/boards/1/posts/${noticeId}`);
    }, [navigate]);

    const handleViewAllClick = useCallback(() => {
        navigate('/boards/1');
    }, [navigate]);

    const widgets = useMemo(() => [
        {
            title: '미확인 공지사항',
            value: stats.unreadNotices,
            icon: <IconBell size={22} color="white" />,
            color: '#667eea'
        },
        {
            title: '내가 쓴 글',
            value: stats.myPosts,
            icon: <IconEdit size={22} color="white" />,
            color: '#f093fb'
        },
        {
            title: '새 댓글',
            value: stats.newComments,
            icon: <IconChat size={22} color="white" />,
            color: '#4facfe'
        },
        {
            title: '진행 업무',
            value: stats.ongoingTasks + '일',
            icon: <IconCalendar size={22} color="white" />,
            color: '#43e97b'
        }
    ], [stats]);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>로딩 중...</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>안녕하세요, {user?.name}님 👋</h1>
                <p>{new Date().toLocaleDateString('ko-KR', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'long'
                })}</p>
            </div>

            <div className="dashboard-stats">
                {widgets.map((widget, index) => (
                    <div key={index} className="stat-card" style={{ borderTopColor: widget.color }}>
                        <div className="stat-icon" style={{ background: widget.color }}>
                            {widget.icon}
                        </div>
                        <div className="stat-content">
                            <p className="stat-title">{widget.title}</p>
                            <p className="stat-value">{widget.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-content">
                <div className="content-section">
                    <div className="section-header">
                        <h2>최근 공지사항</h2>
                        <a onClick={handleViewAllClick}>전체보기 →</a>
                    </div>
                    <div className="notice-list">
                        {recentNotices.length > 0 ? (
                            recentNotices.map((notice) => (
                                <div 
                                    key={notice.id} 
                                    className="notice-item"
                                    onClick={() => handleNoticeClick(notice.id)}
                                >
                                    {notice.category && (
                                        <span className="notice-badge" style={getCategoryColor(notice.category)}>{notice.category}</span>
                                    )}
                                    {isNewPost(notice.created_at) && !notice.category && (
                                        <span className="notice-badge" style={getCategoryColor('NEW')}>NEW</span>
                                    )}
                                    <div className="notice-content">
                                        <p className="notice-title">
                                            {notice.title}
                                        </p>
                                        <div className="notice-meta">
                                            <span className="notice-author">{notice.author_name}</span>
                                            <span className="notice-date">{formatDate(notice.created_at)}</span>
                                            {notice.comment_count > 0 && (
                                                <span className="notice-comments">
                                                    💬 {notice.comment_count}
                                                </span>
                                            )}
                                        </div>
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

                <div className="content-section">
                    <div className="section-header">
                        <h2>이번 주 생일자</h2>
                    </div>
                    <div className="birthday-list">
                        {birthdays.length > 0 ? (
                            birthdays.map((birthday, index) => (
                                <div key={index} className="birthday-item">
                                    <div className="birthday-avatar">
                                        {birthday.name?.charAt(0) || 'U'}
                                    </div>
                                    <div className="birthday-info">
                                        <p className="birthday-name">{birthday.name}</p>
                                        <p className="birthday-dept">
                                            {birthday.department} • {birthday.date} 🎂
                                        </p>
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

                <div className="content-section full-width">
                    <div className="section-header">
                        <h2>나의 근태 현황</h2>
                        <a onClick={() => window.open('https://shiftee.io/ko/accounts/login', '_blank')}>
                            상세보기 →
                        </a>
                    </div>
                    <div className="attendance-chart">
                        <p className="chart-placeholder"> 구현 예정</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;