import React, { useState, useEffect, useCallback } from 'react';
import './ActivityTab.css';
import api from '../../services/api';

const ACTION_LABEL = {
    task_created:        { text: '업무를 추가했습니다', icon: '✅' },
    task_deleted:        { text: '업무를 삭제했습니다', icon: '🗑️' },
    task_status_changed: { text: '상태를 변경했습니다', icon: '🔄' },
    task_assigned:       { text: '담당자를 지정했습니다', icon: '👤' },
    task_unassigned:     { text: '담당자를 해제했습니다', icon: '👤' },
    task_priority_changed: { text: '우선순위를 변경했습니다', icon: '🔺' },
    task_due_changed:    { text: '마감일을 변경했습니다', icon: '📅' },
    task_progress_changed: { text: '진행률을 변경했습니다', icon: '📊' },
    comment_added:       { text: '댓글을 남겼습니다', icon: '💬' },
    member_added:        { text: '멤버가 추가되었습니다', icon: '👥' },
    member_removed:      { text: '멤버가 제거되었습니다', icon: '👥' },
    group_created:       { text: '그룹을 추가했습니다', icon: '📁' },
    feed_posted:         { text: '피드에 글을 남겼습니다', icon: '📝' },
};

const STATUS_KO = { todo: '할 일', in_progress: '진행 중', done: '완료', on_hold: '보류' };
const PRIORITY_KO = { urgent: '긴급', high: '높음', normal: '보통', low: '낮음' };

function timeAgo(dt) {
    const diff = Date.now() - new Date(dt).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1)  return '방금 전';
    if (min < 60) return `${min}분 전`;
    const h = Math.floor(min / 60);
    if (h < 24)   return `${h}시간 전`;
    const d = Math.floor(h / 24);
    if (d < 7)    return `${d}일 전`;
    return new Date(dt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function renderDetail(log) {
    try {
        const nv = log.new_value ? (typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value) : null;
        const ov = log.old_value ? (typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value) : null;

        if (log.action === 'task_status_changed' && nv?.status) {
            const from = ov?.status ? STATUS_KO[ov.status] : null;
            const to   = STATUS_KO[nv.status];
            return from ? `${from} → ${to}` : to;
        }
        if (log.action === 'task_priority_changed' && nv?.priority) {
            return `${ov?.priority ? PRIORITY_KO[ov.priority] + ' → ' : ''}${PRIORITY_KO[nv.priority]}`;
        }
        if (log.action === 'task_progress_changed' && nv?.progress !== undefined) {
            return `${ov?.progress ?? '?'}% → ${nv.progress}%`;
        }
        if (log.action === 'task_due_changed') {
            const to = nv?.due_date ? new Date(nv.due_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '없음';
            return `마감: ${to}`;
        }
    } catch {}
    return null;
}

export default function ActivityTab({ projectId }) {
    const [logs, setLogs]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset]   = useState(0);
    const LIMIT = 30;

    const fetchLogs = useCallback(async (reset = false) => {
        try {
            setLoading(true);
            const start = reset ? 0 : offset;
            const res = await api.get(`/projects/${projectId}/activity?limit=${LIMIT + 1}&offset=${start}`);
            const fetched = res.data.logs || [];
            const more = fetched.length > LIMIT;
            const slice = more ? fetched.slice(0, LIMIT) : fetched;
            setLogs(prev => reset ? slice : [...prev, ...slice]);
            setHasMore(more);
            setOffset(start + slice.length);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [projectId, offset]);

    useEffect(() => { fetchLogs(true); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    // 날짜 그룹핑
    const grouped = [];
    let lastDay = null;
    logs.forEach(log => {
        const day = new Date(log.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
        if (day !== lastDay) {
            grouped.push({ type: 'divider', day });
            lastDay = day;
        }
        grouped.push({ type: 'log', log });
    });

    return (
        <div className="act-wrap">
            {loading && logs.length === 0 ? (
                <div className="act-loading"><div className="page-loader-spinner" /></div>
            ) : logs.length === 0 ? (
                <div className="act-empty">활동 기록이 없습니다.</div>
            ) : (
                <div className="act-timeline">
                    {grouped.map((item, i) => {
                        if (item.type === 'divider') {
                            return (
                                <div key={`d-${i}`} className="act-day-divider">
                                    <span>{item.day}</span>
                                </div>
                            );
                        }
                        const { log } = item;
                        const meta = ACTION_LABEL[log.action] || { text: log.action, icon: '•' };
                        const detail = renderDetail(log);
                        const initial = log.user_name?.[0] || '?';

                        return (
                            <div key={log.id} className="act-item">
                                <div className="act-avatar">{initial}</div>
                                <div className="act-body">
                                    <div className="act-main">
                                        <span className="act-icon">{meta.icon}</span>
                                        <span className="act-user">{log.user_name}</span>
                                        <span className="act-text">{meta.text}</span>
                                        {log.task_title && (
                                            <span className="act-task-title">"{log.task_title}"</span>
                                        )}
                                    </div>
                                    {detail && <div className="act-detail">{detail}</div>}
                                    <div className="act-time">{timeAgo(log.created_at)}</div>
                                </div>
                            </div>
                        );
                    })}

                    {hasMore && (
                        <button
                            className="act-load-more"
                            onClick={() => fetchLogs(false)}
                            disabled={loading}
                        >
                            {loading ? '로딩 중...' : '더 보기'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
