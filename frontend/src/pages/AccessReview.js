import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/authService';
import { useToast } from '../components/common/Toast';
import UserAvatar from '../components/common/UserAvatar';
import { IconCheckCircle, IconAlertTriangle, IconPlus, IconLock } from '../components/common/Icons';
import './AccessReview.css';

const ROLE_LABELS = {
    SUPER_ADMIN: '최고관리자',
    ADMIN: '관리자',
    HR_ADMIN: '인사관리자',
    USER: '일반사용자',
};
const ROLE_OPTIONS = ['USER', 'HR_ADMIN', 'ADMIN', 'SUPER_ADMIN'];

const ACTION_LABELS = {
    pending: '미검토',
    confirmed: '확인',
    modified: '역할변경',
    deactivated: '비활성화',
};
const ACTION_COLORS = {
    pending: '#94a3b8',
    confirmed: '#22c55e',
    modified: '#f59e0b',
    deactivated: '#ef4444',
};

export default function AccessReview() {
    const toast = useToast();
    const [reviews, setReviews] = useState([]);
    const [activeReview, setActiveReview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [completeNotes, setCompleteNotes] = useState('');
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [deptFilter, setDeptFilter] = useState('all');

    const fetchReviews = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/access-reviews');
            setReviews(res.data.data || []);
        } catch {
            toast.error('검토 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchReviews(); }, [fetchReviews]);

    const openReview = async (id) => {
        try {
            setDetailLoading(true);
            const res = await api.get(`/access-reviews/${id}`);
            setActiveReview(res.data.data);
            setDeptFilter('all');
        } catch {
            toast.error('검토 상세를 불러오지 못했습니다.');
        } finally {
            setDetailLoading(false);
        }
    };

    const startReview = async () => {
        try {
            const res = await api.post('/access-reviews');
            toast.success(res.data.message);
            await fetchReviews();
            await openReview(res.data.data.id);
        } catch (err) {
            toast.error(err.response?.data?.message || '검토 시작 중 오류가 발생했습니다.');
        }
    };

    const handleItem = async (item, action, confirmedRole) => {
        try {
            await api.put(`/access-reviews/${activeReview.id}/items/${item.id}`, {
                action,
                confirmed_role: confirmedRole || item.original_role,
            });
            // 로컬 상태 갱신
            setActiveReview(prev => ({
                ...prev,
                items: prev.items.map(i =>
                    i.id === item.id
                        ? { ...i, action, confirmed_role: confirmedRole || item.original_role }
                        : i
                ),
            }));
        } catch (err) {
            toast.error(err.response?.data?.message || '처리 중 오류가 발생했습니다.');
        }
    };

    const handleComplete = async () => {
        try {
            setCompleting(true);
            await api.post(`/access-reviews/${activeReview.id}/complete`, { notes: completeNotes });
            toast.success('검토가 완료되었습니다. ISO 27001 감사 증적이 기록되었습니다.');
            setShowCompleteModal(false);
            setActiveReview(null);
            await fetchReviews();
        } catch (err) {
            toast.error(err.response?.data?.message || '완료 처리 중 오류가 발생했습니다.');
        } finally {
            setCompleting(false);
        }
    };

    const depts = activeReview
        ? ['all', ...new Set(activeReview.items.map(i => i.dept_name || '부서 미지정'))]
        : [];

    const filteredItems = activeReview?.items.filter(i =>
        deptFilter === 'all' || (i.dept_name || '부서 미지정') === deptFilter
    ) || [];

    const pendingCount = activeReview?.items.filter(i => i.action === 'pending').length || 0;
    const reviewedCount = activeReview?.items.filter(i => i.action !== 'pending').length || 0;
    const totalCount = activeReview?.items.length || 0;
    const progress = totalCount ? Math.round((reviewedCount / totalCount) * 100) : 0;

    const inProgressReview = reviews.find(r => r.status === 'in_progress');

    if (loading) return (
        <div className="ar-review-page">
            <div className="skel" style={{ height: 80, borderRadius: 12, marginBottom: 16 }} />
            <div className="skel" style={{ height: 300, borderRadius: 12 }} />
        </div>
    );

    return (
        <div className="ar-review-page">
            <div className="ar-review-header">
                <div>
                    <h2 className="ar-review-title">접근권한 반기 검토</h2>
                    <p className="ar-review-subtitle">ISO 27001 A.9.2.5 — 사용자 접근권한 검토 감사 증적</p>
                </div>
                {!inProgressReview && (
                    <button className="ar-review-start-btn" onClick={startReview}>
                        <IconPlus size={16} />
                        새 검토 시작
                    </button>
                )}
            </div>

            {/* 진행 중인 검토 패널 */}
            {activeReview && (
                <div className="ar-review-active-panel">
                    <div className="ar-review-progress-header">
                        <div>
                            <span className="ar-review-period">
                                {activeReview.review_year}년 {activeReview.review_half === 1 ? '상' : '하'}반기 검토
                            </span>
                            {activeReview.status === 'in_progress' && (
                                <span className="ar-review-badge in-progress">진행 중</span>
                            )}
                            {activeReview.status === 'completed' && (
                                <span className="ar-review-badge completed">완료</span>
                            )}
                        </div>
                        <div className="ar-review-stats">
                            <span>{reviewedCount} / {totalCount}명 검토</span>
                            {activeReview.status === 'in_progress' && (
                                <button
                                    className="ar-review-complete-btn"
                                    disabled={pendingCount > 0}
                                    onClick={() => setShowCompleteModal(true)}
                                    title={pendingCount > 0 ? `${pendingCount}명 미검토` : ''}
                                >
                                    <IconLock size={14} />
                                    검토 완료
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="ar-review-progress-bar-wrap">
                        <div className="ar-review-progress-bar" style={{ width: `${progress}%` }} />
                    </div>

                    {/* 부서 필터 */}
                    <div className="ar-review-dept-filter">
                        {depts.map(d => (
                            <button
                                key={d}
                                className={`ar-review-dept-chip${deptFilter === d ? ' active' : ''}`}
                                onClick={() => setDeptFilter(d)}
                            >
                                {d === 'all' ? '전체' : d}
                            </button>
                        ))}
                    </div>

                    {/* 사용자 목록 */}
                    <div className="ar-review-table-wrap">
                        <table className="ar-review-table">
                            <thead>
                                <tr>
                                    <th>사용자</th>
                                    <th>부서 / 직책</th>
                                    <th>현재 권한</th>
                                    {activeReview.status === 'in_progress' && <th>변경 권한</th>}
                                    <th>상태</th>
                                    {activeReview.status === 'in_progress' && <th>작업</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map(item => (
                                    <tr key={item.id} className={`ar-review-row action-${item.action}`}>
                                        <td>
                                            <div className="ar-review-user-cell">
                                                <UserAvatar name={item.user_name} size={32} />
                                                <div>
                                                    <div className="ar-review-user-name">{item.user_name}</div>
                                                    <div className="ar-review-username">@{item.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="ar-review-dept">{item.dept_name || '—'}</div>
                                            <div className="ar-review-position">{item.position || '—'}</div>
                                        </td>
                                        <td>
                                            <span className={`ar-review-role-badge role-${item.original_role}`}>
                                                {ROLE_LABELS[item.original_role] || item.original_role}
                                            </span>
                                        </td>
                                        {activeReview.status === 'in_progress' && (
                                            <td>
                                                <select
                                                    className="ar-review-role-select"
                                                    defaultValue={item.confirmed_role || item.original_role}
                                                    id={`role-select-${item.id}`}
                                                >
                                                    {ROLE_OPTIONS.map(r => (
                                                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                                    ))}
                                                </select>
                                            </td>
                                        )}
                                        <td>
                                            <span
                                                className="ar-review-action-badge"
                                                style={{ color: ACTION_COLORS[item.action] }}
                                            >
                                                {ACTION_LABELS[item.action]}
                                            </span>
                                        </td>
                                        {activeReview.status === 'in_progress' && (
                                            <td>
                                                <div className="ar-review-actions">
                                                    <button
                                                        className="ar-review-btn confirm"
                                                        title="권한 확인"
                                                        onClick={() => {
                                                            const sel = document.getElementById(`role-select-${item.id}`);
                                                            const newRole = sel?.value || item.original_role;
                                                            const action = newRole !== item.original_role ? 'modified' : 'confirmed';
                                                            handleItem(item, action, newRole);
                                                        }}
                                                    >
                                                        <IconCheckCircle size={14} />
                                                        확인
                                                    </button>
                                                    <button
                                                        className="ar-review-btn deactivate"
                                                        title="계정 비활성화"
                                                        onClick={() => {
                                                            if (window.confirm(`${item.user_name} 계정을 비활성화하시겠습니까?`)) {
                                                                handleItem(item, 'deactivated', item.original_role);
                                                            }
                                                        }}
                                                    >
                                                        <IconAlertTriangle size={14} />
                                                        비활성화
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 과거 검토 이력 */}
            <div className="ar-review-history">
                <h3 className="ar-review-history-title">검토 이력</h3>
                {reviews.length === 0 ? (
                    <p className="ar-review-empty">검토 이력이 없습니다.</p>
                ) : (
                    <div className="ar-review-history-list">
                        {reviews.map(r => (
                            <div
                                key={r.id}
                                className={`ar-review-history-item${activeReview?.id === r.id ? ' active' : ''}`}
                                onClick={() => openReview(r.id)}
                            >
                                <div className="ar-review-history-period">
                                    {r.review_year}년 {r.review_half === 1 ? '상' : '하'}반기
                                </div>
                                <div className="ar-review-history-meta">
                                    <span className={`ar-review-badge ${r.status === 'completed' ? 'completed' : 'in-progress'}`}>
                                        {r.status === 'completed' ? '완료' : '진행 중'}
                                    </span>
                                    <span className="ar-review-history-date">
                                        {r.status === 'completed'
                                            ? `완료: ${new Date(r.completed_at).toLocaleDateString('ko-KR')}`
                                            : `시작: ${new Date(r.started_at).toLocaleDateString('ko-KR')}`}
                                    </span>
                                    <span className="ar-review-history-count">
                                        {r.reviewed_items}/{r.total_items}명
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 완료 확인 모달 */}
            {showCompleteModal && (
                <div className="ar-review-modal-overlay" onClick={() => setShowCompleteModal(false)}>
                    <div className="ar-review-modal" onClick={e => e.stopPropagation()}>
                        <h3>검토 완료 확인</h3>
                        <p>모든 사용자 권한 검토를 완료 처리합니다.<br />완료 후에는 수정이 불가합니다.</p>
                        <textarea
                            className="ar-review-notes-input"
                            placeholder="검토 결과 메모 (선택사항)"
                            value={completeNotes}
                            onChange={e => setCompleteNotes(e.target.value)}
                            rows={3}
                        />
                        <div className="ar-review-modal-actions">
                            <button className="ar-review-btn-cancel" onClick={() => setShowCompleteModal(false)}>취소</button>
                            <button
                                className="ar-review-btn-confirm-complete"
                                onClick={handleComplete}
                                disabled={completing}
                            >
                                {completing ? '처리 중...' : '완료 처리'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
