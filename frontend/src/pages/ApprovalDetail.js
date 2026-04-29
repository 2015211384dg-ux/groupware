import DOMPurify from 'dompurify';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/authService';
import './ApprovalDetail.css';
import { IconEdit, IconTrash, IconPaperclip, IconCheck, IconX } from '../components/common/Icons';
import { useToast } from '../components/common/Toast';

const STATUS_MAP = {
    DRAFT:       { label: '임시저장', cls: 'draft' },
    PENDING:     { label: '대기',     cls: 'pending' },
    IN_PROGRESS: { label: '진행중',   cls: 'progress' },
    APPROVED:    { label: '완료',     cls: 'approved' },
    REJECTED:    { label: '반려',     cls: 'rejected' },
    CANCELLED:   { label: '취소',     cls: 'cancelled' },
};

const LINE_TYPE  = { APPROVAL: '결재', AGREEMENT: '합의', REFERENCE: '참조' };
const LINE_TYPE_CLS = { APPROVAL: 'approval', AGREEMENT: 'agreement', REFERENCE: 'reference' };
const LINE_STATUS_DOT = {
    WAITING:  'waiting',
    PENDING:  'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    SKIPPED:  'waiting',
};

const CURRENCY_SYMBOLS = { KRW: '₩', USD: '$', EUR: '€', JPY: '¥', CNY: '¥' };

const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
};
const formatShortDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
    });
};

// ─── 직원 프로필 팝업 ────────────────────────────
function UserProfilePopup({ userId, anchorEl, onClose }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errMsg, setErrMsg]   = useState('');
    const popupRef = useRef(null);

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        setErrMsg('');
        api.get(`/addressbook/by-user/${userId}`)
            .then(r => {
                if (r.data?.data) setProfile(r.data.data);
                else setErrMsg('직원 정보가 없습니다.');
            })
            .catch(e => {
                const msg = e.response?.data?.message || e.message || '알 수 없는 오류';
                setErrMsg(`오류: ${msg} (${e.response?.status || 'network'})`);
            })
            .finally(() => setLoading(false));
    }, [userId]);

    // 팝업 위치 계산 (앵커 기준)
    useEffect(() => {
        if (!anchorEl || !popupRef.current) return;
        const rect = anchorEl.getBoundingClientRect();
        const popup = popupRef.current;
        const popupW = 340;
        const viewW  = window.innerWidth;
        let left = rect.right + 12;
        if (left + popupW > viewW - 16) left = rect.left - popupW - 12;
        popup.style.top  = `${Math.max(60, rect.top)}px`;
        popup.style.left = `${Math.max(8, left)}px`;
    }, [anchorEl, profile]);

    // 바깥 클릭 닫기
    useEffect(() => {
        const handle = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target) &&
                anchorEl && !anchorEl.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [anchorEl, onClose]);

    const getInitial = (name) => name ? name.charAt(0) : '?';

    return (
        <div className="upp-overlay-bg" onClick={onClose}>
            <div ref={popupRef} className="upp-popup" onClick={e => e.stopPropagation()}>
                {loading ? (
                    <div className="upp-loading">
                        <div className="upp-spinner" />
                    </div>
                ) : (errMsg || !profile) ? (
                    <div className="upp-empty">{errMsg || '정보를 불러올 수 없습니다.'}</div>
                ) : (
                    <>
                        <button className="upp-close" onClick={onClose}>
                            <IconX size={14}/>
                        </button>

                        {/* 프로필 상단 */}
                        <div className="upp-top">
                            <div className="upp-avatar-wrap">
                                {profile.profile_image ? (
                                    <img
                                        src={profile.profile_image.startsWith('http')
                                            ? profile.profile_image
                                            : `/uploads/${profile.profile_image}`}
                                        alt={profile.name}
                                        className="upp-avatar-img"
                                    />
                                ) : (
                                    <div className="upp-avatar-fallback">
                                        {getInitial(profile.name)}
                                    </div>
                                )}
                            </div>
                            <div className="upp-name-block">
                                <div className="upp-name">{profile.name}</div>
                                <div className="upp-position">
                                    {[profile.job_title, profile.position].filter(Boolean).join(' / ') || '—'}
                                </div>
                            </div>
                        </div>

                        {/* 퀵 액션 버튼 */}
                        <div className="upp-actions">
                            <a className="upp-action-btn" href={`mailto:${profile.email}`} title="메일">
                                <span className="upp-action-icon mail">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                                        <polyline points="2,4 12,13 22,4"/>
                                    </svg>
                                </span>
                                <span className="upp-action-label">메일</span>
                            </a>
                            {profile.phone && (
                                <a className="upp-action-btn" href={`tel:${profile.phone}`} title="전화">
                                    <span className="upp-action-icon phone">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 0 0 .1 1.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.45-.45a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                                        </svg>
                                    </span>
                                    <span className="upp-action-label">전화</span>
                                </a>
                            )}
                        </div>

                        {/* 상세 정보 */}
                        <div className="upp-info-list">
                            <div className="upp-info-row">
                                <span className="upp-info-label">소속</span>
                                <div className="upp-info-value">
                                    {profile.parent_dept_name && (
                                        <div className="upp-info-company">{profile.parent_dept_name}</div>
                                    )}
                                    <div>
                                        {[profile.department_name, profile.job_title].filter(Boolean).join('  ')}
                                    </div>
                                    {profile.position && (
                                        <div className="upp-info-sub">{profile.position}</div>
                                    )}
                                </div>
                            </div>
                            {profile.phone && (
                                <div className="upp-info-row">
                                    <span className="upp-info-label">전화</span>
                                    <span className="upp-info-value">
                                        🇰🇷 {profile.phone}
                                    </span>
                                </div>
                            )}
                            {profile.email && (
                                <div className="upp-info-row">
                                    <span className="upp-info-label">이메일</span>
                                    <div className="upp-info-value">
                                        <div>{profile.email}</div>
                                        {profile.username && profile.username !== profile.email && (
                                            <div className="upp-info-sub">{profile.username}</div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {profile.hire_date && (
                                <div className="upp-info-row">
                                    <span className="upp-info-label">입사일</span>
                                    <span className="upp-info-value">
                                        {new Date(profile.hire_date).toLocaleDateString('ko-KR', {
                                            year: 'numeric', month: '2-digit', day: '2-digit'
                                        }).replace(/\. /g, '.').replace('.', '')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── 결재선 보기 모달 ─────────────────────────────
const LINE_TYPE_LABEL = { APPROVAL: '결재', AGREEMENT: '합의', REFERENCE: '참조' };
const LINE_STATUS_COLOR = {
    APPROVED: { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46' },
    REJECTED: { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' },
    PENDING:  { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' },
    WAITING:  { bg: '#fff',    border: '#e5e7eb', text: '#374151' },
    SKIPPED:  { bg: '#f3f4f6', border: '#e5e7eb', text: '#9ca3af' },
};

function ApprovalLineModal({ lines, onClose, onNameClick }) {
    const [splitAgreement, setSplitAgreement] = useState(false);
    const [large, setLarge]                   = useState(false);

    // step 기준으로 그룹핑
    const steps = [];
    const sorted = [...lines].sort((a, b) => a.step - b.step);
    sorted.forEach(line => {
        const existing = steps.find(s => s.step === line.step && s.type === line.type);
        if (existing) existing.members.push(line);
        else steps.push({ step: line.step, type: line.type, members: [line] });
    });

    // 합의 나누어 보기: 합의인 경우 멤버를 각각 독립 step으로
    const displaySteps = splitAgreement
        ? steps.flatMap(s =>
            s.type === 'AGREEMENT'
                ? s.members.map((m, i) => ({ ...s, step: s.step + i * 0.01, members: [m] }))
                : [s]
          )
        : steps;

    return (
        <>
            <div className="alm-overlay" onClick={onClose} />
            <div className={`alm-modal ${large ? 'large' : ''}`}>
                {/* 헤더 */}
                <div className="alm-header">
                    <span className="alm-title">결재선 보기</span>
                    <div className="alm-header-right">
                        <button
                            className={`alm-large-btn ${large ? 'active' : ''}`}
                            onClick={() => setLarge(v => !v)}
                        >크게 보기</button>
                        <button className="alm-close-btn" onClick={onClose}>
                            <IconX size={16}/>
                        </button>
                    </div>
                </div>

                {/* 툴바 */}
                <div className="alm-toolbar">
                    <label className="alm-check-label">
                        <input
                            type="checkbox"
                            checked={splitAgreement}
                            onChange={e => setSplitAgreement(e.target.checked)}
                        />
                        합의 나누어 보기
                    </label>
                </div>

                {/* 결재 플로우 */}
                <div className="alm-body">
                    <div className="alm-flow">
                        {displaySteps.map((s, idx) => {
                            const colors = LINE_STATUS_COLOR[s.members[0]?.status] || LINE_STATUS_COLOR.WAITING;
                            return (
                                <React.Fragment key={`${s.step}-${s.type}-${idx}`}>
                                    {/* 화살표 */}
                                    {idx > 0 && (
                                        <div className="alm-arrow">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="9 18 15 12 9 6"/>
                                            </svg>
                                        </div>
                                    )}

                                    {/* 단계 카드 */}
                                    <div className="alm-step-card">
                                        {/* 단계 뱃지 */}
                                        <div className="alm-step-badge">
                                            <span className="alm-step-num">{idx + 1}</span>
                                            <span className="alm-step-sep">/</span>
                                            <span className="alm-step-type">{LINE_TYPE_LABEL[s.type] || s.type}</span>
                                        </div>

                                        {/* 멤버 목록 */}
                                        <div className="alm-step-members">
                                            {s.members.map(line => {
                                                const mc = LINE_STATUS_COLOR[line.status] || LINE_STATUS_COLOR.WAITING;
                                                return (
                                                    <div
                                                        key={line.id}
                                                        className="alm-member-box"
                                                        style={{ background: mc.bg, borderColor: mc.border }}
                                                        onClick={e => onNameClick(line.approver_id, e.currentTarget)}
                                                    >
                                                        <span className="alm-member-name" style={{ color: mc.text }}>
                                                            {line.approver_name}
                                                            {line.dept_name ? `/${line.dept_name}` : ''}
                                                        </span>
                                                        {line.status !== 'WAITING' && (
                                                            <span className="alm-member-status" style={{ color: mc.text }}>
                                                                {line.status === 'APPROVED' ? '승인' :
                                                                 line.status === 'REJECTED' ? '반려' :
                                                                 line.status === 'PENDING'  ? '진행중' :
                                                                 line.status === 'SKIPPED'  ? '생략' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* 푸터 */}
                <div className="alm-footer">
                    <button className="alm-confirm-btn" onClick={onClose}>확인</button>
                </div>
            </div>
        </>
    );
}

// ─── 결재선 테이블 (결재선 요약용) ────────────────
function ApprovalLineView({ lines }) {
    const approvals  = lines.filter(l => l.type === 'APPROVAL');
    const agreements = lines.filter(l => l.type === 'AGREEMENT');
    const refs       = lines.filter(l => l.type === 'REFERENCE');

    return (
        <div className="ad-sign-table-wrap">
            <table className="ad-sign-table">
                <tbody>
                    {approvals.length > 0 && (<>
                        <tr>
                            <th className="ad-tbl-row-label" rowSpan={4}>결재</th>
                            {approvals.map(l => (
                                <th key={l.id} className="ad-tbl-head">{l.position || l.job_title || '—'}</th>
                            ))}
                        </tr>
                        <tr>
                            {approvals.map(l => {
                                const isApproved = l.status === 'APPROVED';
                                const isRejected = l.status === 'REJECTED';
                                const isPending  = l.status === 'PENDING';
                                return (
                                    <td key={l.id} className={`ad-tbl-sign-row ${isApproved?'approved':''} ${isRejected?'rejected':''} ${isPending?'pending':''}`}>
                                        {isApproved && l.signature_data
                                            ? <img src={l.signature_data} alt="서명" className="ad-tbl-sign-img" />
                                            : isApproved
                                                ? <span className="ad-tbl-sign">{l.approver_name}</span>
                                                : isRejected
                                                    ? <span className="ad-tbl-sign rejected">{l.approver_name}</span>
                                                    : <span className="ad-tbl-sign waiting">—</span>
                                        }
                                    </td>
                                );
                            })}
                        </tr>
                        <tr>{approvals.map(l => <td key={l.id} className="ad-tbl-name-row">{l.approver_name}</td>)}</tr>
                        <tr>{approvals.map(l => (
                            <td key={l.id} className="ad-tbl-date-row">
                                {l.actioned_at ? formatShortDate(l.actioned_at) : (l.status==='PENDING'?'진행중':'대기')}
                            </td>
                        ))}</tr>
                    </>)}

                    {agreements.length > 0 && (<>
                        <tr className="ad-tbl-divider-row"><td colSpan={agreements.length+1} /></tr>
                        <tr>
                            <th className="ad-tbl-row-label" rowSpan={4}>합의</th>
                            {agreements.map(l => <th key={l.id} className="ad-tbl-head">{l.position || l.job_title || '—'}</th>)}
                        </tr>
                        <tr>
                            {agreements.map(l => {
                                const isApproved = l.status === 'APPROVED';
                                const isRejected = l.status === 'REJECTED';
                                return (
                                    <td key={l.id} className={`ad-tbl-sign-row ${isApproved?'approved':''} ${isRejected?'rejected':''}`}>
                                        {isApproved && l.signature_data
                                            ? <img src={l.signature_data} alt="서명" className="ad-tbl-sign-img" />
                                            : isApproved
                                                ? <span className="ad-tbl-sign">{l.approver_name}</span>
                                                : isRejected
                                                    ? <span className="ad-tbl-sign rejected">{l.approver_name}</span>
                                                    : <span className="ad-tbl-sign waiting">—</span>
                                        }
                                    </td>
                                );
                            })}
                        </tr>
                        <tr>{agreements.map(l => <td key={l.id} className="ad-tbl-name-row">{l.approver_name}</td>)}</tr>
                        <tr>{agreements.map(l => (
                            <td key={l.id} className="ad-tbl-date-row">
                                {l.actioned_at ? formatShortDate(l.actioned_at) : (l.status==='PENDING'?'진행중':'대기')}
                            </td>
                        ))}</tr>
                    </>)}

                    {refs.length > 0 && (<>
                        <tr className="ad-tbl-divider-row"><td colSpan={refs.length+1} /></tr>
                        <tr>
                            <th className="ad-tbl-row-label" rowSpan={2}>참조</th>
                            {refs.map(r => <th key={r.id} className="ad-tbl-head">{r.position || r.job_title || '—'}</th>)}
                        </tr>
                        <tr>{refs.map(r => <td key={r.id} className="ad-tbl-name-row">{r.approver_name}</td>)}</tr>
                    </>)}
                </tbody>
            </table>
        </div>
    );
}

// ─── 결재 처리 모달 ─────────────────────────
function ActionModal({ doc, myLine, onClose, onDone }) {
    const toast = useToast();
    const [action, setAction]   = useState('APPROVED');
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (action === 'REJECTED' && !comment.trim()) {
            toast.warning('반려 시 의견을 입력해주세요.');
            return;
        }
        try {
            setLoading(true);
            await api.post(`/approval/documents/${doc.id}/action`, { action, comment });
            toast.success(action === 'APPROVED' ? '승인 처리되었습니다.' : '반려 처리되었습니다.');
            onDone();
        } catch (e) {
            toast.error(e.response?.data?.message || '처리 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="ad-overlay" onClick={onClose} />
            <div className="ad-action-modal">
                <div className="ad-modal-header">
                    <h3>결재 처리</h3>
                    <button onClick={onClose}>✕</button>
                </div>
                <div className="ad-modal-body">
                    <div className="ad-doc-title-preview">{doc.title}</div>
                    <div className="ad-action-select">
                        <button
                            className={`ad-action-btn approve ${action === 'APPROVED' ? 'active' : ''}`}
                            onClick={() => setAction('APPROVED')}
                        >
                            <IconCheck size={15}/> 승인
                        </button>
                        <button
                            className={`ad-action-btn reject ${action === 'REJECTED' ? 'active' : ''}`}
                            onClick={() => setAction('REJECTED')}
                        >
                            <IconX size={15}/> 반려
                        </button>
                    </div>
                    <div className="ad-comment-area">
                        <label>의견 {action === 'REJECTED' && <span className="ad-required">*</span>}</label>
                        <textarea
                            placeholder="의견을 입력하세요. (선택)"
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            rows={4}
                        />
                    </div>
                </div>
                <div className="ad-modal-footer">
                    <button className="ad-btn-cancel" onClick={onClose}>취소</button>
                    <button
                        className={`ad-btn-action ${action === 'APPROVED' ? 'approve' : 'reject'}`}
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? '처리 중...' : (action === 'APPROVED' ? '승인' : '반려')}
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── 메인 컴포넌트 ───────────────────────────
function ApprovalDetail() {
    const toast = useToast();
    const { id } = useParams();
    const navigate = useNavigate();

    const [doc, setDoc]                 = useState(null);
    const [loading, setLoading]         = useState(true);
    const [showAction, setShowAction]   = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    // UI 상태
    const [summaryOpen, setSummaryOpen]       = useState(true);
    const [sideLineOpen, setSideLineOpen]     = useState(true);

    // 프로필 팝업
    const [profilePopup, setProfilePopup]   = useState(null); // { userId, anchorEl }
    // 결재선 보기 모달
    const [showLineModal, setShowLineModal] = useState(false);

    const fetchDoc = useCallback(async () => {
        try {
            setLoading(true);
            const [docRes, meRes] = await Promise.all([
                api.get(`/approval/documents/${id}`),
                api.get('/auth/me'),
            ]);
            setDoc(docRes.data.data);
            setCurrentUser(meRes.data.user);
        } catch (e) {
            console.error(e);
            toast.error('문서를 불러올 수 없습니다.');
            navigate('/approval');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchDoc(); }, [fetchDoc]);

    if (loading) return (
        <div className="ad-loading-wrap">
            <div className="ad-spinner" />
            <p>로딩 중...</p>
        </div>
    );
    if (!doc) return null;

    const st = STATUS_MAP[doc.status] || { label: doc.status, cls: '' };
    const myLine = doc.lines?.find(l => l.approver_id === currentUser?.id && l.status === 'PENDING');
    const isDrafter = doc.drafter_id === currentUser?.id;

    const handleCancel = async () => {
        if (!window.confirm('상신을 취소하시겠습니까?')) return;
        try {
            await api.post(`/approval/documents/${id}/cancel`);
            toast.success('취소되었습니다.');
            fetchDoc();
        } catch (e) {
            toast.error(e.response?.data?.message || '취소 실패');
        }
    };
    const handleDelete = async () => {
        if (!window.confirm('삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        try {
            await api.delete(`/approval/documents/${id}`);
            toast.success('삭제되었습니다.');
            navigate('/approval');
        } catch (e) {
            toast.error(e.response?.data?.message || '삭제 실패');
        }
    };
    const handleEdit = () => navigate(`/approval/write/edit/${id}`);

    return (
        <div className="ad-page">
            {showAction && myLine && (
                <ActionModal
                    doc={doc} myLine={myLine}
                    onClose={() => setShowAction(false)}
                    onDone={() => { setShowAction(false); fetchDoc(); }}
                />
            )}
            {profilePopup && (
                <UserProfilePopup
                    userId={profilePopup.userId}
                    anchorEl={profilePopup.anchorEl}
                    onClose={() => setProfilePopup(null)}
                />
            )}
            {showLineModal && (
                <ApprovalLineModal
                    lines={doc.lines || []}
                    onClose={() => setShowLineModal(false)}
                    onNameClick={(userId, el) => {
                        setProfilePopup({ userId, anchorEl: el });
                    }}
                />
            )}

            {/* ── 상단 헤더 ── */}
            <div className="ad-header">
                <div className="ad-header-left">
                    <button className="ad-back-btn" onClick={() => navigate('/approval')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6"/>
                        </svg>
                        {doc.template_name || '결재 문서'}
                    </button>
                </div>
                <div className="ad-header-right">
                    {myLine && (
                        <button className="ad-btn-action-main" onClick={() => setShowAction(true)}>
                            <IconCheck size={14}/> 결재 처리
                        </button>
                    )}
                    {isDrafter && doc.status === 'DRAFT' && (
                        <>
                            <button className="ad-btn-edit" onClick={handleEdit}><IconEdit size={14}/> 수정</button>
                            <button className="ad-btn-delete" onClick={handleDelete}><IconTrash size={14}/> 삭제</button>
                        </>
                    )}
                    {isDrafter && ['PENDING','IN_PROGRESS'].includes(doc.status) && (
                        <button className="ad-btn-cancel-doc" onClick={handleCancel}>상신 취소</button>
                    )}
                </div>
            </div>

            {/* ── 2컬럼 레이아웃 ── */}
            <div className="ad-layout">

                {/* ── 좌측 메인 ── */}
                <div className="ad-main">

                    {/* 결재선 요약 (접기/펼치기) */}
                    <div className="ad-approval-summary">
                        <div className="ad-summary-header" onClick={() => setSummaryOpen(o => !o)}>
                            <span className="ad-summary-label">결재선 요약</span>
                            <span className="ad-summary-chevron">{summaryOpen ? '▲' : '▼'}</span>
                        </div>
                        {summaryOpen && (
                            <div className="ad-summary-body">
                                <ApprovalLineView lines={doc.lines || []} />
                            </div>
                        )}
                    </div>

                    {/* 문서 본문 */}
                    <div className="ad-doc-body">
                        <h1 className="ad-doc-title">{doc.title}</h1>
                        <div className="ad-doc-meta">
                            <span>{doc.drafter_name}{doc.drafter_dept ? ` (${doc.drafter_dept})` : ''}</span>
                            <span className="ad-doc-meta-sep">•</span>
                            <span>{formatDate(doc.submitted_at || doc.created_at)}</span>
                            {doc.doc_number && (
                                <><span className="ad-doc-meta-sep">•</span><span>{doc.doc_number}</span></>
                            )}
                            <span className="ad-doc-meta-sep">•</span>
                            <span className={`ad-status-badge ${st.cls}`}>{st.label}</span>
                        </div>

                        <div className="ad-doc-divider" />

                        {/* 서식 필드 */}
                        {doc.template_fields?.length > 0 && Object.keys(doc.form_data || {}).length > 0 && (
                            <div className="ad-form-view">
                                {doc.template_fields.map(f => {
                                    const raw = doc.form_data[f.key];
                                    let display = raw || '-';
                                    if (f.type === 'amount' && raw) {
                                        display = `${CURRENCY_SYMBOLS[f.currency] || '₩'} ${Number(raw).toLocaleString()}`;
                                    }
                                    return (
                                        <div key={f.key} className="ad-fv-row">
                                            <span className="ad-fv-label">{f.label}</span>
                                            <span className="ad-fv-value">{display}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* 자유 본문 */}
                        {doc.content && (
                            <div className="ad-content-section">
                                <div className="ad-fv-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                                    <span className="ad-fv-label">
                                        {(doc.template_fields || []).some(f => f.key === 'content' || f.label === '내용')
                                            ? '비고' : '내용'}
                                    </span>
                                    <div
                                        className="ad-content-body ql-editor"
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(doc.content) }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* 첨부파일 */}
                        {doc.attachments?.length > 0 && (
                            <div className="ad-attach-section">
                                <div className="ad-attach-label">
                                    <IconPaperclip size={13}/> 첨부파일
                                </div>
                                <div className="ad-attach-list">
                                    {doc.attachments.map(a => (
                                        <a key={a.id} className="ad-attach-item"
                                            href={`/uploads/${a.filepath}`} download>
                                            <IconPaperclip size={13}/>
                                            {a.filename}
                                            <span className="ad-attach-size">
                                                ({Math.round((a.filesize || 0) / 1024)}KB)
                                            </span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 인쇄 버튼 */}
                    <div className="ad-print-bar no-print">
                        <button className="ad-print-btn" onClick={() => window.print()}>인쇄</button>
                    </div>
                </div>

                {/* ── 우측 사이드바 ── */}
                <div className="ad-sidebar">

                    {/* 사이드바 상단 액션 버튼 */}
                    <div className="ad-sidebar-topbar">
                        {myLine && (
                            <button className="ad-sidebar-top-btn primary" onClick={() => setShowAction(true)}>
                                결재 처리
                            </button>
                        )}
                        {isDrafter && doc.status === 'DRAFT' && (
                            <>
                                <button className="ad-sidebar-top-btn" onClick={handleEdit}>수정</button>
                                <button className="ad-sidebar-top-btn danger" onClick={handleDelete}>삭제</button>
                            </>
                        )}
                        {isDrafter && ['PENDING','IN_PROGRESS'].includes(doc.status) && (
                            <button className="ad-sidebar-top-btn danger" onClick={handleCancel}>상신 취소</button>
                        )}
                        <button className="ad-sidebar-top-btn" onClick={() => window.print()}>인쇄</button>
                    </div>

                    {/* 결재선 */}
                    <div className="ad-sidebar-section">
                        <div
                            className="ad-sidebar-section-header"
                            onClick={() => setSideLineOpen(o => !o)}
                        >
                            <span className="ad-sidebar-section-title">결재선</span>
                            <div className="ad-sidebar-section-right">
                                <button
                                    className="ad-sidebar-view-btn"
                                    onClick={e => { e.stopPropagation(); setShowLineModal(true); }}
                                >보기</button>
                                <span className="ad-sidebar-chevron">{sideLineOpen ? '▲' : '▼'}</span>
                            </div>
                        </div>
                        {sideLineOpen && (
                            <div className="ad-sidebar-lines">
                                {(doc.lines || []).map(line => (
                                    <div
                                        key={line.id}
                                        className={`ad-sidebar-line-item ${line.status === 'PENDING' ? 'active-approver' : ''}`}
                                    >
                                        <span className={`ad-line-type-badge ${LINE_TYPE_CLS[line.type] || 'approval'}`}>
                                            {LINE_TYPE[line.type] || line.type}
                                        </span>
                                        <div className="ad-line-info">
                                            <div
                                                className="ad-line-name ad-line-name-btn"
                                                onClick={e => setProfilePopup(
                                                    profilePopup?.userId === line.approver_id
                                                        ? null
                                                        : { userId: line.approver_id, anchorEl: e.currentTarget }
                                                )}
                                            >
                                                {line.approver_name}
                                                {line.dept_name ? `/${line.dept_name}` : ''}
                                            </div>
                                            {line.actioned_at && (
                                                <div className="ad-line-date">{formatDate(line.actioned_at)}</div>
                                            )}
                                            {!line.actioned_at && line.status === 'PENDING' && (
                                                <div className="ad-line-date" style={{color:'#3b82f6'}}>진행중</div>
                                            )}
                                        </div>
                                        <span className={`ad-line-status-dot ${LINE_STATUS_DOT[line.status] || 'waiting'}`} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 결재 처리 코멘트 (결재 순서가 된 경우) */}
                    {myLine && (
                        <div className="ad-sidebar-action-section">
                            <textarea
                                className="ad-sidebar-comment-textarea"
                                placeholder="문서에 대한 의견을 여기에 입력해 주세요."
                                rows={4}
                            />
                            <div className="ad-sidebar-comment-footer">
                                <button className="ad-sidebar-file-btn">파일 첨부</button>
                                <button
                                    className="ad-sidebar-confirm-btn"
                                    onClick={() => setShowAction(true)}
                                >
                                    확인
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ApprovalDetail;
