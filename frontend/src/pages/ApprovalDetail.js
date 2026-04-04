import DOMPurify from 'dompurify';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/authService';
import './ApprovalDetail.css';
import { IconEdit, IconTrash, IconPaperclip, IconFile, IconCheck, IconX } from '../components/Icons';
import { useToast } from '../components/Toast';

const STATUS_MAP = {
    DRAFT:       { label: '임시저장', cls: 'draft' },
    PENDING:     { label: '대기',     cls: 'pending' },
    IN_PROGRESS: { label: '진행중',   cls: 'progress' },
    APPROVED:    { label: '완료',     cls: 'approved' },
    REJECTED:    { label: '반려',     cls: 'rejected' },
    CANCELLED:   { label: '취소',     cls: 'cancelled' },
};

const LINE_TYPE = { APPROVAL: '결재', AGREEMENT: '합의', REFERENCE: '참조' };
const LINE_STATUS = {
    WAITING:  { label: '대기',  cls: 'waiting' },
    PENDING:  { label: '진행중',cls: 'pending' },
    APPROVED: { label: '승인',  cls: 'approved' },
    REJECTED: { label: '반려',  cls: 'rejected' },
    SKIPPED:  { label: '생략',  cls: 'skipped' },
};

const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
};

// ─── 결재선 시각화 (네이버웍스 스타일) ─────
function ApprovalLineView({ lines }) {
    const approvals  = lines.filter(l => l.type === 'APPROVAL');
    const agreements = lines.filter(l => l.type === 'AGREEMENT');
    const refs       = lines.filter(l => l.type === 'REFERENCE');

    // 결재선 셀 컴포넌트
    const LineCell = ({ line }) => {
        const isApproved = line.status === 'APPROVED';
        const isRejected = line.status === 'REJECTED';
        const isPending  = line.status === 'PENDING';

        return (
            <td className={`ad-tbl-cell ${isApproved?'approved':''} ${isRejected?'rejected':''} ${isPending?'pending':''}`}>
                {/* 직책 행 */}
                <div className="ad-tbl-position">{line.position || line.job_title || '—'}</div>
                {/* 서명 행 */}
                <div className="ad-tbl-sign-box">
                    {isApproved && <span className="ad-tbl-sign">{line.approver_name}</span>}
                    {isRejected && <span className="ad-tbl-sign rejected">{line.approver_name}</span>}
                    {isPending  && <span className="ad-tbl-sign pending">—</span>}
                    {!isApproved && !isRejected && !isPending && <span className="ad-tbl-sign waiting">—</span>}
                </div>
                {/* 이름 행 */}
                <div className="ad-tbl-name">{line.approver_name}</div>
                {/* 날짜 행 */}
                <div className="ad-tbl-date">
                    {line.actioned_at
                        ? new Date(line.actioned_at).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'})
                        : (isPending ? '진행중' : '대기')}
                </div>
                {line.comment && <div className="ad-tbl-comment">💬 {line.comment}</div>}
            </td>
        );
    };

    // 참조 셀
    const RefCell = ({ line }) => (
        <td className="ad-tbl-cell ref">
            <div className="ad-tbl-position">{line.position || line.job_title || '—'}</div>
            <div className="ad-tbl-sign-box">
                <span className="ad-tbl-sign ref">{line.approver_name}</span>
            </div>
            <div className="ad-tbl-name">{line.approver_name}</div>
            <div className="ad-tbl-date">참조</div>
        </td>
    );

    return (
        <div className="ad-sign-table-wrap">
            <table className="ad-sign-table">
                <tbody>
                    {/* 직책 헤더 행 */}
                    {approvals.length > 0 && (
                        <tr>
                            <th className="ad-tbl-row-label" rowSpan={4}>결재</th>
                            {approvals.map(l => (
                                <th key={l.id} className="ad-tbl-head">{l.position || l.job_title || '—'}</th>
                            ))}
                        </tr>
                    )}
                    {/* 서명 행 */}
                    {approvals.length > 0 && (
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
                    )}
                    {/* 이름 행 */}
                    {approvals.length > 0 && (
                        <tr>
                            {approvals.map(l => (
                                <td key={l.id} className="ad-tbl-name-row">{l.approver_name}</td>
                            ))}
                        </tr>
                    )}
                    {/* 날짜 행 */}
                    {approvals.length > 0 && (
                        <tr>
                            {approvals.map(l => (
                                <td key={l.id} className="ad-tbl-date-row">
                                    {l.actioned_at
                                        ? new Date(l.actioned_at).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'})
                                        : (l.status==='PENDING'?'진행중':'대기')}
                                </td>
                            ))}
                        </tr>
                    )}

                    {/* 합의 */}
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
                        <tr>{agreements.map(l => <td key={l.id} className="ad-tbl-date-row">{l.actioned_at ? new Date(l.actioned_at).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}) : (l.status==='PENDING'?'진행중':'대기')}</td>)}</tr>
                    </>)}

                    {/* 참조 */}
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

// ─── 결재 처리 모달 ───────────────────────
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

// ─── 메인 컴포넌트 ────────────────────────
function ApprovalDetail() {
    const toast = useToast();
    const { id } = useParams();
    const navigate = useNavigate();
    const [doc, setDoc]           = useState(null);
    const [loading, setLoading]   = useState(true);
    const [showAction, setShowAction] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    const fetchDoc = useCallback(async () => {
        try {
            setLoading(true);
            const [docRes, meRes] = await Promise.all([
                api.get(`/approval/documents/${id}`),
                api.get('/auth/me')
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

    // 내 결재 순서가 현재 PENDING인지 확인
    const myLine = doc.lines?.find(l =>
        l.approver_id === currentUser?.id && l.status === 'PENDING'
    );

    const handleCancel = async () => {
        if (!window.confirm('삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        try {
            await api.post(`/approval/documents/${id}/cancel`);
            toast.success('취소되었습니다.');
            fetchDoc();
        } catch (e) {
            toast.error(e.response?.data?.message || '취소 실패');
        }
    };

    const handleEdit = () => {
        // 임시저장 문서만 수정 가능 → ApprovalWrite로 이동
        navigate(`/approval/write/edit/${id}`);
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

    return (
        <div className="ad-page">
            {showAction && myLine && (
                <ActionModal
                    doc={doc}
                    myLine={myLine}
                    onClose={() => setShowAction(false)}
                    onDone={() => { setShowAction(false); fetchDoc(); }}
                />
            )}

            {/* 상단 헤더 */}
            <div className="ad-header">
                <div className="ad-header-left">
                    <button className="ad-back-btn" onClick={() => navigate('/approval')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        목록으로
                    </button>
                    <h2 className="ad-header-title">결재 문서 상세</h2>
                </div>
                <div className="ad-header-right">
                    {myLine && (
                        <button className="ad-btn-action-main" onClick={() => setShowAction(true)}>
                            <IconCheck size={14}/> 결재 처리
                        </button>
                    )}
                    {/* 임시저장: 수정 + 삭제 */}
                    {doc.drafter_id === currentUser?.id && doc.status === 'DRAFT' && (
                        <>
                            <button className="ad-btn-edit" onClick={handleEdit}><IconEdit size={14}/> 수정</button>
                            <button className="ad-btn-delete" onClick={handleDelete}><IconTrash size={14}/> 삭제</button>
                        </>
                    )}
                    {/* 진행중: 상신 취소 */}
                    {doc.drafter_id === currentUser?.id && ['PENDING','IN_PROGRESS'].includes(doc.status) && (
                        <button className="ad-btn-cancel-doc" onClick={handleCancel}>상신 취소</button>
                    )}
                </div>
            </div>

            <div className="ad-body">
                {/* 문서 메타 - 별도 카드 */}
                <div className="ad-meta-card">
                    <div className="ad-meta-top">
                        <div className="ad-doc-info">
                            <h1 className="ad-doc-title">{doc.title}</h1>
                            <div className="ad-doc-meta">
                                <span>{doc.doc_number || '(임시저장)'}</span>
                                <span>·</span>
                                <span>{doc.template_name || '자유양식'}</span>
                                <span>·</span>
                                <span>{doc.drafter_name} ({doc.drafter_dept})</span>
                                <span>·</span>
                                <span>{formatDate(doc.submitted_at || doc.created_at)}</span>
                            </div>
                        </div>
                        <span className={`ad-status-badge ${st.cls}`}>{st.label}</span>
                    </div>
                </div>

                {/* 결재선 + 내용 섹션들을 하나의 카드로 묶기 */}
                <div className="ad-card-group">
                    {/* 결재선 */}
                    <div className="ad-section">
                        <div className="ad-section-title">결재선</div>
                        <ApprovalLineView lines={doc.lines || []} />
                    </div>

                    {/* 서식 필드 */}
                    {doc.template_fields?.length > 0 && Object.keys(doc.form_data || {}).length > 0 && (
                        <div className="ad-section">
                            <div className="ad-section-title">신청 내용</div>
                            <div className="ad-form-view">
                                {doc.template_fields.map(f => {
                                    const CURRENCY_SYMBOLS = { KRW: '₩', USD: '$', EUR: '€', JPY: '¥', CNY: '¥' };
                                    const raw = doc.form_data[f.key];
                                    let display = raw || '-';
                                    if (f.type === 'amount' && raw) {
                                        const sym = CURRENCY_SYMBOLS[f.currency] || '₩';
                                        display = `${sym} ${Number(raw).toLocaleString()}`;
                                    }
                                    return (
                                        <div key={f.key} className="ad-fv-row">
                                            <span className="ad-fv-label">{f.label}</span>
                                            <span className="ad-fv-value">{display}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 본문 */}
                    {doc.content && (
                        <div className="ad-section">
                            <div className="ad-section-title">내용</div>
                            <div
                                className="ad-content-body ql-editor"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(doc.content) }}
                            />
                        </div>
                    )}

                    {/* 첨부파일 */}
                    {doc.attachments?.length > 0 && (
                        <div className="ad-section">
                            <div className="ad-section-title">첨부파일</div>
                            <div className="ad-attach-list">
                                {doc.attachments.map(a => (
                                    <a key={a.id} className="ad-attach-item"
                                        href={`/uploads/${a.filepath}`} download=<><IconPaperclip size={13} style={{marginRight:4,flexShrink:0}}/>{a.filename}</>>
                                        <><IconPaperclip size={13} style={{marginRight:4,flexShrink:0}}/>{a.filename}</>
                                        <span className="ad-attach-size">
                                            ({Math.round((a.filesize || 0) / 1024)}KB)
                                        </span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ApprovalDetail;
