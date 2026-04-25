import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ProjectDetail.css';
import api from '../services/api';
import { useToast } from '../components/common/Toast';
import UserAvatar from '../components/common/UserAvatar';
import TaskDetailPanel from '../components/project/TaskDetailPanel';
import FeedTab from '../components/project/FeedTab';
import FileTab from '../components/project/FileTab';
import InsightTab from '../components/project/InsightTab';
import ActivityTab from '../components/project/ActivityTab';
import GanttTab from '../components/project/GanttTab';
import CalendarTab from '../components/project/CalendarTab';
import TaskTable from '../components/project/TaskTable';
import MemberModal from '../components/project/MemberModal';
import ProjectSettingsModal from '../components/project/ProjectSettingsModal';
import { ProjectIcon } from '../components/project/ProjectIcon';
import {
    IconPlus, IconChevronDown, IconChevronUp, IconUsers, IconTask, IconSettings
} from '../components/common/Icons';

const STATUS_KO  = { todo: '할 일', in_progress: '진행 중', done: '완료', on_hold: '보류' };
const PRIORITY_KO = { urgent: '긴급', high: '높음', normal: '보통', low: '낮음' };

const TABS = [
    { key: 'task',     label: '업무' },
    { key: 'feed',     label: '피드' },
    { key: 'gantt',    label: '간트차트' },
    { key: 'calendar', label: '캘린더' },
    { key: 'file',     label: '파일' },
    { key: 'insight',  label: '인사이트' },
];

function dueDateLabel(due) {
    if (!due) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(due); d.setHours(0,0,0,0);
    const diff = Math.round((d - today) / 86400000);
    if (diff < 0)   return { text: `D+${Math.abs(diff)}`, cls: 'overdue' };
    if (diff === 0) return { text: 'D-day', cls: 'soon' };
    if (diff <= 3)  return { text: `D-${diff}`, cls: 'soon' };
    return { text: d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }), cls: '' };
}

// 빠른 업무 추가 인라인 폼
function InlineAddTask({ groupId, projectId, onAdded }) {
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const toast = useToast();
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        try {
            const res = await api.post(`/projects/${projectId}/tasks`, {
                title: title.trim(),
                group_id: groupId,
            });
            onAdded(res.data.task);
            setTitle('');
        } catch (err) {
            toast.error(err.response?.data?.message || '업무 추가 실패');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="task-add-inline">
            <input
                ref={inputRef}
                className="task-add-input"
                placeholder="업무 제목을 입력하세요"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(e); if (e.key === 'Escape') onAdded(null); }}
                disabled={saving}
            />
            <button className="task-add-btn" onClick={handleSubmit} disabled={saving || !title.trim()}>
                추가
            </button>
            <button className="task-add-cancel" onClick={() => onAdded(null)}>취소</button>
        </div>
    );
}

// 단일 그룹 컴포넌트
function TaskGroup({ group, tasks, projectId, onTaskAdded, onTaskClick, onStatusChange }) {
    const [collapsed, setCollapsed]   = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    const handleAdded = (task) => {
        setShowAddForm(false);
        if (task) onTaskAdded(task);
    };

    return (
        <div className="task-group">
            {/* 그룹 헤더 */}
            <div className="task-group-header" onClick={() => setCollapsed(c => !c)}>
                <div className="task-group-color" style={{ background: group.color || '#667eea' }} />
                <span className="task-group-name">{group.name}</span>
                <span className="task-group-count">{tasks.length}개</span>
                <div className={`task-group-toggle ${collapsed ? '' : 'open'}`}>
                    {collapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                </div>
                <button
                    className="btn-add-task"
                    onClick={(e) => { e.stopPropagation(); setCollapsed(false); setShowAddForm(true); }}
                >
                    <IconPlus size={13} /> 업무 추가
                </button>
            </div>

            {/* 업무 행들 */}
            {!collapsed && (
                <>
                    {tasks.length === 0 && !showAddForm && (
                        <div className="task-empty">
                            업무가 없습니다.{' '}
                            <span
                                style={{ color: '#667eea', cursor: 'pointer' }}
                                onClick={() => setShowAddForm(true)}
                            >업무 추가하기</span>
                        </div>
                    )}

                    {tasks.map(task => {
                        const due = dueDateLabel(task.due_date);
                        const isDone = task.status === 'done';
                        return (
                            <div
                                key={task.id}
                                className={`task-row ${isDone ? 'done' : ''}`}
                                onClick={() => onTaskClick(task)}
                            >
                                {/* 완료 체크 */}
                                <div
                                    className={`task-row-check ${isDone ? 'done' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStatusChange(task, isDone ? 'todo' : 'done');
                                    }}
                                />

                                {/* 제목 */}
                                <span className="task-row-title">{task.title}</span>

                                {/* 담당자 */}
                                {task.assignees?.length > 0 && (
                                    <div className="task-assignees">
                                        {task.assignees.slice(0, 3).map(a => (
                                            <div
                                                key={a.user_id}
                                                className="task-assignee-avatar"
                                                title={a.name}
                                                style={{ background: '#667eea' }}
                                            >
                                                {a.name?.[0]}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 마감일 */}
                                {due ? (
                                    <span className={`task-due ${due.cls}`}>{due.text}</span>
                                ) : (
                                    <span className="task-due">—</span>
                                )}

                                {/* 우선순위 */}
                                <span className={`task-priority priority-${task.priority}`}>
                                    {PRIORITY_KO[task.priority]}
                                </span>

                                {/* 상태 */}
                                <span className={`task-status status-${task.status}`}>
                                    {STATUS_KO[task.status]}
                                </span>

                                {/* 진행률 */}
                                <div className="task-progress-wrap">
                                    <div className="task-progress-bar-mini">
                                        <div className="task-progress-fill-mini" style={{ width: `${task.progress}%` }} />
                                    </div>
                                    <span style={{ fontSize: 11, color: '#8b8fa8', minWidth: 28 }}>{task.progress}%</span>
                                </div>
                            </div>
                        );
                    })}

                    {showAddForm && (
                        <InlineAddTask
                            groupId={group.id}
                            projectId={projectId}
                            onAdded={handleAdded}
                        />
                    )}
                </>
            )}
        </div>
    );
}

export default function ProjectDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast    = useToast();

    const [project,  setProject]  = useState(null);
    const [members,  setMembers]  = useState([]);
    const [groups,   setGroups]   = useState([]);
    const [tasks,    setTasks]    = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [activeTab, setActiveTab] = useState('task');
    const [selectedTask, setSelectedTask] = useState(null);
    const [showMemberModal,   setShowMemberModal]   = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    // 데이터 로드
    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            const [pRes, gRes, tRes] = await Promise.all([
                api.get(`/projects/${id}`),
                api.get(`/projects/${id}/task-groups`),
                api.get(`/projects/${id}/tasks`),
            ]);
            setProject(pRes.data.project);
            setGroups(gRes.data.groups || []);
            setTasks(tRes.data.tasks || []);
            setActiveTab(pRes.data.project.home_tab || 'task');
            // 멤버는 실패해도 페이지가 깨지지 않도록 별도 처리
            api.get(`/projects/${id}/members`)
                .then(r => setMembers(r.data.members || []))
                .catch(() => {});
        } catch (err) {
            if (err.response?.status === 404 || err.response?.status === 403) {
                navigate('/project');
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [id, navigate]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // 상태 변경
    const handleStatusChange = async (task, newStatus) => {
        try {
            await api.patch(`/projects/${id}/tasks/${task.id}/status`, { status: newStatus });
            setTasks(prev => prev.map(t =>
                t.id === task.id ? { ...t, status: newStatus } : t
            ));
        } catch (err) {
            toast.error('상태 변경 실패');
        }
    };

    // 업무 추가
    const handleTaskAdded = (task) => {
        setTasks(prev => [...prev, task]);
    };

    // 업무 상세 업데이트 후 목록 갱신
    const handleTaskUpdated = (updated) => {
        setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
        setSelectedTask(updated);
    };

    // 업무 삭제
    const handleTaskDeleted = (taskId) => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        setSelectedTask(null);
    };

    // 그룹별 업무 분류
    const getGroupTasks = (groupId) =>
        tasks.filter(t => (groupId === null ? !t.group_id : t.group_id === groupId));

    const ungrouptedTasks = tasks.filter(t => !t.group_id);

    if (loading) {
        return (
            <div className="pd-loading">
                <div className="page-loader-spinner" />
                프로젝트 불러오는 중...
            </div>
        );
    }

    if (!project) return null;

    const color = project.color || '#667eea';
    const totalTasks = tasks.length;
    const doneTasks  = tasks.filter(t => t.status === 'done').length;

    return (
        <div className="pd-wrap">
            {/* 프로젝트 헤더 */}
            <div className="pd-header">
                <div className="pd-header-top">
                    <div className="pd-project-icon" style={{ background: color }}>
                        {project.emoji
                            ? <ProjectIcon iconKey={project.emoji} size={22} color="#fff" strokeWidth={1.8} />
                            : <IconTask size={22} color="#fff" />}
                    </div>
                    <div className="pd-project-meta">
                        <div className="pd-project-name">{project.name}</div>
                        <div className="pd-project-desc">
                            {project.description || '설명 없음'} &nbsp;·&nbsp;
                            업무 {doneTasks}/{totalTasks}
                        </div>
                    </div>
                    <div className="pd-header-actions">
                        {/* 멤버 아바타 */}
                        <div className="pd-member-avatars">
                            {members.slice(0, 5).map((m, i) => (
                                <div key={m.user_id} className="pd-member-avatar" title={m.name}
                                     style={{ background: color, zIndex: 10 - i }}>
                                    {m.name?.[0]}
                                </div>
                            ))}
                            {members.length > 5 && (
                                <div className="pd-member-avatar pd-member-avatar-more">
                                    +{members.length - 5}
                                </div>
                            )}
                        </div>
                        {['owner','manager'].includes(project.my_role) && (
                            <button className="pd-btn-invite" onClick={() => setShowMemberModal(true)}>
                                <IconUsers size={14} />
                                멤버 관리
                            </button>
                        )}
                        {['owner','manager'].includes(project.my_role) && (
                            <button className="pd-btn-settings" onClick={() => setShowSettingsModal(true)}>
                                <IconSettings size={15} />
                            </button>
                        )}
                    </div>
                </div>

                {/* 탭 바 */}
                <div className="pd-tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            className={`pd-tab ${activeTab === tab.key ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                            {tab.key === 'task' && totalTasks > 0 && (
                                <span className="pd-tab-badge">{totalTasks}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* 탭 콘텐츠 */}
            <div className="pd-content">
                {activeTab === 'task' ? (
                    <TaskTable
                        project={project}
                        groups={groups}
                        tasks={tasks}
                        members={members}
                        myRole={project.my_role}
                        onTaskAdded={handleTaskAdded}
                        onTaskClick={setSelectedTask}
                        onStatusChange={(id, status) => handleStatusChange({ id }, status)}
                        onGroupAdded={(g) => setGroups(prev => [...prev, g])}
                        onGroupDeleted={(gid) => setGroups(prev => prev.filter(g => g.id !== gid))}
                        onTaskUpdated={handleTaskUpdated}
                    />
                ) : activeTab === 'feed' ? (
                    <FeedTab
                        projectId={id}
                        myUserId={project.owner_id}
                        myRole={project.my_role}
                    />
                ) : activeTab === 'file' ? (
                    <FileTab
                        projectId={id}
                        myRole={project.my_role}
                    />
                ) : activeTab === 'insight' ? (
                    <InsightTab projectId={id} tasks={tasks} groups={groups} />
                ) : activeTab === 'gantt' ? (
                    <GanttTab tasks={tasks} groups={groups} />
                ) : activeTab === 'calendar' ? (
                    <CalendarTab tasks={tasks} />
                ) : null}
            </div>

            {/* 업무 상세 패널 */}
            {selectedTask && (
                <TaskDetailPanel
                    task={selectedTask}
                    projectId={id}
                    members={members}
                    myRole={project.my_role}
                    onClose={() => setSelectedTask(null)}
                    onUpdated={handleTaskUpdated}
                    onDeleted={handleTaskDeleted}
                />
            )}

            {/* 멤버 관리 모달 */}
            {showMemberModal && (
                <MemberModal
                    projectId={id}
                    myRole={project.my_role}
                    onClose={() => setShowMemberModal(false)}
                    onUpdated={() => {
                        api.get(`/projects/${id}/members`).then(r => setMembers(r.data.members || []));
                    }}
                />
            )}

            {/* 프로젝트 설정 모달 */}
            {showSettingsModal && (
                <ProjectSettingsModal
                    project={project}
                    myRole={project.my_role}
                    onClose={() => setShowSettingsModal(false)}
                    onUpdated={(updated) => setProject(p => ({ ...p, ...updated }))}
                    onDeleted={() => navigate('/project')}
                />
            )}
        </div>
    );
}

