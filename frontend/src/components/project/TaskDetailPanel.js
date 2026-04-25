import React, { useState, useEffect, useRef, useCallback } from 'react';
import './TaskDetailPanel.css';
import api from '../../services/api';
import { useToast } from '../common/Toast';
import { useConfirm } from '../common/Confirm';
import { IconClose, IconPlus, IconSend, IconTrash } from '../common/Icons';

const STATUS_OPTIONS  = [
    { value: 'todo',        label: '할 일' },
    { value: 'in_progress', label: '진행 중' },
    { value: 'done',        label: '완료' },
    { value: 'on_hold',     label: '보류' },
];

const PRIORITY_OPTIONS = [
    { value: 'urgent', label: '⚡ 긴급' },
    { value: 'high',   label: '↑ 높음' },
    { value: 'normal', label: '— 보통' },
    { value: 'low',    label: '↓ 낮음' },
];

function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60)   return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export default function TaskDetailPanel({ task, projectId, members, myRole, onClose, onUpdated, onDeleted }) {
    const toast   = useToast();
    const confirm = useConfirm();

    const [form, setForm] = useState({
        title:       task.title       || '',
        status:      task.status      || 'todo',
        priority:    task.priority    || 'normal',
        progress:    task.progress    ?? 0,
        start_date:  task.start_date  ? task.start_date.slice(0, 10) : '',
        due_date:    task.due_date    ? task.due_date.slice(0, 10) : '',
        description: task.description || '',
    });
    const [assignees,  setAssignees]  = useState(task.assignees || []);
    const [comments,   setComments]   = useState(task.comments  || []);
    const [saving,     setSaving]     = useState(false);
    const [commentText, setCommentText] = useState('');
    const [sendingComment, setSendingComment] = useState(false);
    const [showMemberDrop, setShowMemberDrop] = useState(false);

    const canWrite = myRole !== 'viewer';
    const canDelete = ['owner','manager'].includes(myRole) || task.created_by === undefined;

    // 댓글 로드
    const loadComments = useCallback(async () => {
        try {
            const res = await api.get(`/projects/${projectId}/tasks/${task.id}/comments`);
            setComments(res.data.comments || []);
        } catch {}
    }, [projectId, task.id]);

    useEffect(() => { loadComments(); }, [loadComments]);

    // 패널 외부 클릭 무시 (overlay는 따로 처리)
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // 저장
    const handleSave = async () => {
        if (!form.title.trim()) { toast.warning('업무 제목을 입력해주세요.'); return; }
        setSaving(true);
        try {
            await api.patch(`/projects/${projectId}/tasks/${task.id}`, {
                title:       form.title.trim(),
                description: form.description || null,
                priority:    form.priority,
                progress:    Number(form.progress),
                start_date:  form.start_date || null,
                due_date:    form.due_date   || null,
            });

            // 상태가 변경된 경우 별도 PATCH
            if (form.status !== task.status) {
                await api.patch(`/projects/${projectId}/tasks/${task.id}/status`, { status: form.status });
            }

            toast.success('저장되었습니다.');
            onUpdated({ ...task, ...form, assignees });
        } catch (err) {
            toast.error(err.response?.data?.message || '저장 실패');
        } finally {
            setSaving(false);
        }
    };

    // 삭제
    const handleDelete = async () => {
        const ok = await confirm('업무를 삭제할까요?', { confirmText: '삭제', danger: true });
        if (!ok) return;
        try {
            await api.delete(`/projects/${projectId}/tasks/${task.id}`);
            toast.success('업무가 삭제되었습니다.');
            onDeleted(task.id);
        } catch (err) {
            toast.error(err.response?.data?.message || '삭제 실패');
        }
    };

    // 담당자 추가
    const handleAddAssignee = async (member) => {
        if (assignees.find(a => a.user_id === member.user_id)) {
            setShowMemberDrop(false);
            return;
        }
        try {
            const res = await api.post(`/projects/${projectId}/tasks/${task.id}/assignees`, { user_id: member.user_id });
            setAssignees(prev => [...prev, res.data.assignee]);
            setShowMemberDrop(false);
        } catch (err) {
            toast.error(err.response?.data?.message || '담당자 추가 실패');
        }
    };

    // 담당자 제거
    const handleRemoveAssignee = async (userId) => {
        try {
            await api.delete(`/projects/${projectId}/tasks/${task.id}/assignees/${userId}`);
            setAssignees(prev => prev.filter(a => a.user_id !== userId));
        } catch {
            toast.error('담당자 제거 실패');
        }
    };

    // 댓글 전송
    const handleSendComment = async () => {
        if (!commentText.trim()) return;
        setSendingComment(true);
        try {
            const res = await api.post(`/projects/${projectId}/tasks/${task.id}/comments`, {
                content: commentText.trim()
            });
            setComments(prev => [...prev, res.data.comment]);
            setCommentText('');
        } catch {
            toast.error('댓글 전송 실패');
        } finally {
            setSendingComment(false);
        }
    };

    // 미지정 멤버 (이미 담당자 아닌 사람)
    const availableMembers = members.filter(
        m => !assignees.find(a => a.user_id === m.user_id)
    );

    return (
        <>
            <div className="tdp-overlay" onClick={onClose} />
            <div className="tdp-panel">
                {/* 헤더 */}
                <div className="tdp-header">
                    <button className="tdp-close" onClick={onClose}><IconClose size={15} /></button>
                    <input
                        className="tdp-title-input"
                        value={form.title}
                        onChange={e => set('title', e.target.value)}
                        disabled={!canWrite}
                        placeholder="업무 제목"
                    />
                    {canDelete && (
                        <button className="tdp-delete" onClick={handleDelete} title="업무 삭제">
                            <IconTrash size={15} />
                        </button>
                    )}
                </div>

                {/* 본문 */}
                <div className="tdp-body">
                    {/* 상태 / 우선순위 */}
                    <div className="tdp-meta-row">
                        <select
                            className={`tdp-select s-${form.status}`}
                            value={form.status}
                            onChange={e => set('status', e.target.value)}
                            disabled={!canWrite}
                        >
                            {STATUS_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        <select
                            className="tdp-select"
                            value={form.priority}
                            onChange={e => set('priority', e.target.value)}
                            disabled={!canWrite}
                        >
                            {PRIORITY_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* 담당자 */}
                    <div className="tdp-section">
                        <div className="tdp-section-label">담당자</div>
                        <div className="tdp-assignees">
                            {assignees.map(a => (
                                <div key={a.user_id} className="tdp-assignee-chip">
                                    <div className="tdp-assignee-avatar">{a.name?.[0]}</div>
                                    {a.name}
                                    {canWrite && (
                                        <button
                                            className="tdp-assignee-remove"
                                            onClick={() => handleRemoveAssignee(a.user_id)}
                                        >✕</button>
                                    )}
                                </div>
                            ))}
                            {canWrite && (
                                <div style={{ position: 'relative' }}>
                                    <button
                                        className="tdp-btn-add-assignee"
                                        onClick={() => setShowMemberDrop(v => !v)}
                                    >
                                        <IconPlus size={12} /> 담당자 추가
                                    </button>
                                    {showMemberDrop && availableMembers.length > 0 && (
                                        <div className="tdp-member-dropdown">
                                            {availableMembers.map(m => (
                                                <div
                                                    key={m.user_id}
                                                    className="tdp-member-item"
                                                    onClick={() => handleAddAssignee(m)}
                                                >
                                                    <div className="tdp-assignee-avatar" style={{ width:22,height:22,fontSize:10 }}>
                                                        {m.name?.[0]}
                                                    </div>
                                                    <span>{m.name}</span>
                                                    {m.position && (
                                                        <span style={{ color: '#8b8fa8', fontSize: 11 }}>
                                                            {m.position}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {showMemberDrop && availableMembers.length === 0 && (
                                        <div className="tdp-member-dropdown">
                                            <div className="tdp-member-item" style={{ color: '#8b8fa8' }}>
                                                추가할 멤버가 없습니다.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 날짜 */}
                    <div className="tdp-section">
                        <div className="tdp-section-label">일정</div>
                        <div className="tdp-date-row">
                            <div className="tdp-date-field">
                                <div className="tdp-date-label">시작일</div>
                                <input
                                    type="date"
                                    className="tdp-date-input"
                                    value={form.start_date}
                                    onChange={e => set('start_date', e.target.value)}
                                    disabled={!canWrite}
                                />
                            </div>
                            <div className="tdp-date-field">
                                <div className="tdp-date-label">마감일</div>
                                <input
                                    type="date"
                                    className="tdp-date-input"
                                    value={form.due_date}
                                    onChange={e => set('due_date', e.target.value)}
                                    disabled={!canWrite}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 진행률 */}
                    <div className="tdp-section">
                        <div className="tdp-section-label">진행률</div>
                        <div className="tdp-progress-row">
                            <input
                                type="range"
                                min={0} max={100} step={5}
                                className="tdp-progress-slider"
                                value={form.progress}
                                onChange={e => set('progress', e.target.value)}
                                disabled={!canWrite}
                            />
                            <span className="tdp-progress-value">{form.progress}%</span>
                        </div>
                    </div>

                    {/* 설명 */}
                    <div className="tdp-section">
                        <div className="tdp-section-label">설명</div>
                        <textarea
                            className="tdp-desc-textarea"
                            placeholder="업무 설명을 입력하세요..."
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            rows={4}
                            disabled={!canWrite}
                        />
                    </div>

                    {/* 저장 버튼 */}
                    {canWrite && (
                        <button className="tdp-save-btn" onClick={handleSave} disabled={saving}>
                            {saving ? '저장 중...' : '변경사항 저장'}
                        </button>
                    )}

                    <div className="tdp-divider" />

                    {/* 댓글 */}
                    <div className="tdp-section">
                        <div className="tdp-section-label">댓글 {comments.length > 0 ? `(${comments.length})` : ''}</div>
                        <div className="tdp-comments">
                            {comments.length === 0 && (
                                <div style={{ color: '#b0b5c4', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                                    첫 댓글을 작성해보세요.
                                </div>
                            )}
                            {comments.map(c => (
                                <div key={c.id} className="tdp-comment">
                                    <div className="tdp-comment-avatar">{c.user_name?.[0]}</div>
                                    <div className="tdp-comment-body">
                                        <div className="tdp-comment-meta">
                                            <span className="tdp-comment-author">{c.user_name}</span>
                                            <span className="tdp-comment-time">{timeAgo(c.created_at)}</span>
                                        </div>
                                        <div className="tdp-comment-content">{c.content}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 댓글 입력창 (고정) */}
                {canWrite && (
                    <div className="tdp-comment-form">
                        <textarea
                            className="tdp-comment-input"
                            placeholder="댓글을 입력하세요..."
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendComment();
                                }
                            }}
                            rows={1}
                        />
                        <button
                            className="tdp-comment-send"
                            onClick={handleSendComment}
                            disabled={!commentText.trim() || sendingComment}
                        >
                            <IconSend size={15} />
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
