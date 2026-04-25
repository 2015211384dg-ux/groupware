import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProjectHub.css';
import api from '../services/api';
import { IconProject, IconTask, IconPlus } from '../components/common/Icons';
import { useToast } from '../components/common/Toast';
import ProjectCreateModal from '../components/project/ProjectCreateModal';
import { ProjectIcon } from '../components/project/ProjectIcon';

const IconBoard = (p) => (
    <svg width={p.size||36} height={p.size||36} viewBox="0 0 24 24" fill="none"
         stroke={p.color||'currentColor'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <path d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        <path d="M9 12h6M9 16h4"/>
    </svg>
);

const ROLE_KO = { owner: '소유자', manager: '관리자', member: '멤버', viewer: '뷰어' };

const STATUS_KO = {
    todo: '할 일', in_progress: '진행 중', done: '완료', on_hold: '보류'
};

function dueDateLabel(due) {
    if (!due) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(due); d.setHours(0,0,0,0);
    const diff = Math.round((d - today) / 86400000);
    if (diff < 0)  return { text: `D+${Math.abs(diff)}`, cls: 'overdue' };
    if (diff === 0) return { text: 'D-day', cls: 'soon' };
    if (diff <= 3) return { text: `D-${diff}`, cls: 'soon' };
    return { text: d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }), cls: '' };
}

export default function ProjectHub() {
    const navigate = useNavigate();
    const toast    = useToast();
    const [tab, setTab]           = useState('my');
    const [projects, setProjects] = useState([]);
    const [myTasks, setMyTasks]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [joiningId, setJoiningId]   = useState(null);

    const fetchProjects = useCallback(async () => {
        try {
            setLoading(true);
            const [pRes, tRes] = await Promise.all([
                api.get(tab === 'my' ? '/projects' : '/projects/public'),
                api.get('/projects/my-tasks'),
            ]);
            setProjects(pRes.data.projects || []);
            setMyTasks(tRes.data.tasks || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    const handleCreated = (project) => {
        setShowCreate(false);
        navigate(`/project/${project.id}`);
    };

    const progressPct = (p) => {
        if (!p.task_total) return 0;
        return Math.round((p.task_done / p.task_total) * 100);
    };

    const handleJoin = async (e, p) => {
        e.stopPropagation();
        setJoiningId(p.id);
        try {
            const res = await api.post(`/projects/${p.id}/join`);
            if (res.data.joined) {
                toast.success(`${p.name} 프로젝트에 참여했습니다.`);
                navigate(`/project/${p.id}`);
            } else {
                toast.success('참여 요청을 보냈습니다. 관리자 승인 후 참여됩니다.');
                setProjects(prev => prev.map(pp =>
                    pp.id === p.id ? { ...pp, join_status: 'pending' } : pp
                ));
            }
        } catch (err) {
            toast.error(err.response?.data?.message || '참여 실패');
        } finally {
            setJoiningId(null);
        }
    };

    return (
        <div className="hub-wrap">
            {/* 헤더 */}
            <div className="hub-header">
                <h1 className="hub-title">
                    <IconProject size={22} style={{ color: '#667eea', flexShrink: 0 }} />
                    프로젝트 <span>관리</span>
                </h1>
                <button className="hub-btn-new" onClick={() => setShowCreate(true)}>
                    <IconPlus size={16} />
                    새 프로젝트
                </button>
            </div>

            {/* 탭 */}
            <div className="hub-tabs">
                <button className={`hub-tab ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}>
                    내 프로젝트
                </button>
                <button className={`hub-tab ${tab === 'public' ? 'active' : ''}`} onClick={() => setTab('public')}>
                    회사 공개 프로젝트
                </button>
            </div>

            {/* 프로젝트 카드 그리드 */}
            {loading ? (
                <div className="hub-loading">
                    <div className="page-loader-spinner" />
                    불러오는 중...
                </div>
            ) : projects.length === 0 ? (
                <div className="hub-empty">
                    <IconBoard size={48} color="#d1d5db" />
                    <h3>{tab === 'my' ? '참여 중인 프로젝트가 없습니다.' : '공개 프로젝트가 없습니다.'}</h3>
                    <p>{tab === 'my' ? '새 프로젝트를 만들거나 초대를 기다려주세요.' : '공개로 설정된 프로젝트가 아직 없습니다.'}</p>
                </div>
            ) : (
                <div className="hub-grid">
                    {projects.map(p => {
                        const pct = progressPct(p);
                        const color = p.color || '#667eea';
                        return (
                            <div
                                key={p.id}
                                className="project-card"
                                style={{ '--proj-color': color }}
                                onClick={() => navigate(`/project/${p.id}`)}
                            >
                                <div className="project-card-head">
                                    <div className="project-color-dot" style={{ background: color }}>
                                        {p.emoji
                                            ? <ProjectIcon iconKey={p.emoji} size={20} color="#fff" strokeWidth={1.8} />
                                            : <IconTask size={18} color="#fff" />}
                                    </div>
                                    <div className="project-card-info">
                                        <div className="project-card-name">{p.name}</div>
                                        <div className="project-card-desc">{p.description || '설명 없음'}</div>
                                    </div>
                                    {p.my_role && (
                                        <span className="project-card-role">{ROLE_KO[p.my_role]}</span>
                                    )}
                                </div>

                                <div className="project-progress">
                                    <div className="project-progress-bar">
                                        <div className="project-progress-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="project-progress-text">
                                        <span>진행률 {pct}%</span>
                                        <span>{p.task_done || 0} / {p.task_total || 0}개 완료</span>
                                    </div>
                                </div>

                                <div className="project-card-footer">
                                    <div className="project-avatar-stack">
                                        {[...Array(Math.min(p.member_count || 0, 3))].map((_, i) => (
                                            <div key={i} className="project-avatar"
                                                 style={{ background: color }}>
                                                {String.fromCharCode(65 + i)}
                                            </div>
                                        ))}
                                        {(p.member_count || 0) > 3 && (
                                            <div className="project-avatar project-avatar-more">
                                                +{p.member_count - 3}
                                            </div>
                                        )}
                                    </div>
                                    {/* 공개 탭: 참여하기 버튼 */}
                                    {tab === 'public' && !p.is_member && (
                                        p.join_status === 'pending' ? (
                                            <span className="hub-join-pending">승인 대기 중</span>
                                        ) : (
                                            <button
                                                className="hub-join-btn"
                                                onClick={(e) => handleJoin(e, p)}
                                                disabled={joiningId === p.id}
                                            >
                                                {joiningId === p.id ? '...' : p.require_approval ? '참여 요청' : '참여하기'}
                                            </button>
                                        )
                                    )}
                                    {tab === 'public' && p.is_member && (
                                        <span className="hub-joined-badge">참여 중</span>
                                    )}
                                    {tab !== 'public' && (
                                        <div className="project-task-count">
                                            <IconTask size={13} />
                                            <span className="done">{p.task_done || 0}</span>
                                            <span>/ {p.task_total || 0}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 내가 담당중인 업무 */}
            {myTasks.length > 0 && (
                <>
                    <div className="hub-section-title">
                        <IconTask size={16} color="#667eea" />
                        내가 담당중인 업무
                    </div>
                    <div className="hub-task-list">
                        {myTasks.map(t => {
                            const due = dueDateLabel(t.due_date);
                            return (
                                <div
                                    key={t.id}
                                    className="hub-task-item"
                                    onClick={() => navigate(`/project/${t.project_id}`)}
                                >
                                    <div className="hub-task-project">
                                        <div className="hub-task-project-dot"
                                             style={{ background: t.project_color || '#667eea' }}>
                                            {t.project_emoji && (
                                                <ProjectIcon iconKey={t.project_emoji} size={10} color="#fff" strokeWidth={2} />
                                            )}
                                        </div>
                                        <span className="hub-task-project-name">
                                            {t.project_name}
                                        </span>
                                    </div>
                                    <span className="hub-task-title">{t.title}</span>
                                    <div className="hub-task-meta">
                                        <span className={`task-status-badge status-${t.status}`}>
                                            {STATUS_KO[t.status]}
                                        </span>
                                        {due && (
                                            <span className={`hub-task-due ${due.cls}`}>{due.text}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* 프로젝트 생성 모달 */}
            {showCreate && (
                <ProjectCreateModal
                    onClose={() => setShowCreate(false)}
                    onCreated={handleCreated}
                />
            )}
        </div>
    );
}
