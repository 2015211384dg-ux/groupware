import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api from '../services/authService';
import './Approval.css';
import { IconInbox, IconSend, IconDraft, IconDone, IconEye, IconPen, IconHome, IconRefresh, IconCheck, IconFile } from '../components/Icons';

// ─── 상태 뱃지 ───────────────────────────
const STATUS_MAP = {
    DRAFT:       { label: '임시저장', cls: 'draft' },
    PENDING:     { label: '대기',     cls: 'pending' },
    IN_PROGRESS: { label: '진행중',   cls: 'progress' },
    APPROVED:    { label: '완료',     cls: 'approved' },
    REJECTED:    { label: '반려',     cls: 'rejected' },
    CANCELLED:   { label: '취소',     cls: 'cancelled' },
};

const StatusBadge = ({ status }) => {
    const s = STATUS_MAP[status] || { label: status, cls: '' };
    return <span className={`ap-status ${s.cls}`}>{s.label}</span>;
};

const formatDate = (d) => {
    if (!d) return '-';
    const date = new Date(d);
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
};

// ─── 사이드바 메뉴 ────────────────────────
const SIDE_MENU = [
    {
        group: '결재 문서',
        items: [
            { key: 'inbox',   label: '받은 결재함', icon: <IconInbox size={16}/> },
            { key: 'my',      label: '진행/완료',   icon: <IconSend size={16}/> },
            { key: 'draft',   label: '임시 저장',   icon: <IconDraft size={16}/> },
            { key: 'done',    label: '처리 완료',   icon: <IconDone size={16}/> },
            { key: 'cc',      label: '참조 문서',   icon: <IconEye size={16}/> },
        ]
    },
];

// ─── 문서 목록 ────────────────────────────
function DocumentList({ box, onSelect }) {
    const navigate = useNavigate();
    const [docs, setDocs]       = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage]       = useState(1);
    const [pagination, setPagination] = useState({});
    const [search, setSearch]   = useState('');

    const fetch = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/approval/documents', {
                params: { box, page, search, limit: 15 }
            });
            setDocs(res.data.data.documents);
            setPagination(res.data.data.pagination);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [box, page, search]);

    useEffect(() => { setPage(1); }, [box]);
    useEffect(() => { fetch(); }, [fetch]);

    const BOX_LABELS = {
        inbox: '받은 결재함',
        my:    '진행/완료',
        draft: '임시 저장',
        done:  '처리 완료',
        cc:    '참조 문서',
    };

    return (
        <div className="ap-list-wrap">
            <div className="ap-list-header">
                <h2>{BOX_LABELS[box]}</h2>
                <div className="ap-list-toolbar">
                    <input
                        type="text"
                        placeholder="제목 검색"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                    <span className="ap-total">총 {pagination.total || 0}건</span>
                </div>
            </div>

            <div className="ap-table-wrap">
                <table className="ap-table">
                    <thead>
                        <tr>
                            <th style={{width:140, textAlign:'center'}}>문서번호</th>
                            <th>제목</th>
                            <th style={{width:110, textAlign:'center'}}>서식</th>
                            <th style={{width:120, textAlign:'center'}}>기안자</th>
                            <th style={{width:70, textAlign:'center'}}>상태</th>
                            <th style={{width:100, textAlign:'center'}}>일자</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="ap-empty">로딩 중...</td></tr>
                        ) : docs.map(doc => (
                            <tr key={doc.id} className="ap-row" onClick={() => navigate(`/approval/documents/${doc.id}`)}>
                                <td className="ap-docnum" style={{textAlign:'center'}}>{doc.doc_number || '(임시저장)'}</td>
                                <td className="ap-title">{doc.title}</td>
                                <td style={{textAlign:'center'}}><span className="ap-tmpl-badge">{doc.template_name || '자유'}</span></td>
                                <td style={{textAlign:'center'}}>{doc.drafter_name}</td>
                                <td style={{textAlign:'center'}}><StatusBadge status={doc.status} /></td>
                                <td className="ap-date">{formatDate(doc.submitted_at || doc.created_at)}</td>
                            </tr>
                        ))}
                        {!loading && docs.length === 0 && (
                            <tr><td colSpan={6} className="ap-empty">문서가 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pagination.totalPages > 1 && (
                <div className="ap-pagination">
                    <button disabled={page === 1} onClick={() => setPage(p => p-1)}>←</button>
                    {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                        const p = page <= 3 ? i+1 : page - 2 + i;
                        if (p > pagination.totalPages) return null;
                        return <button key={p} className={page===p?'active':''} onClick={()=>setPage(p)}>{p}</button>;
                    })}
                    <button disabled={page===pagination.totalPages} onClick={() => setPage(p => p+1)}>→</button>
                </div>
            )}
        </div>
    );
}

// ─── 메인 대시보드 카드 ──────────────────
function DashboardHome({ onBoxSelect }) {
    const navigate = useNavigate();
    const [summary, setSummary]   = useState({ inbox:0, my_pending:0, my_approved:0, my_draft:0 });
    const [recentDocs, setRecentDocs] = useState([]);
    const [loading, setLoading]   = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [sumRes, listRes] = await Promise.all([
                    api.get('/approval/summary'),
                    api.get('/approval/documents', { params: { box: 'my', limit: 5 } })
                ]);
                setSummary(sumRes.data.data);
                setRecentDocs(listRes.data.data.documents);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, []);

    const cards = [
        { key:'inbox',   label:'받은 결재',  value: summary.inbox,      icon:<IconInbox size={22}/>, color:'#667eea' },
        { key:'my',      label:'진행 중',    value: summary.my_pending, icon:<IconRefresh size={22}/>, color:'#f6ad55' },
        { key:'done',    label:'처리 완료',  value: summary.my_approved,icon:<IconCheck size={22}/>, color:'#68d391' },
        { key:'draft',   label:'임시 저장',  value: summary.my_draft,   icon:<IconDraft size={22}/>, color:'#a0aec0' },
    ];

    return (
        <div className="ap-dashboard">
            {/* 요약 카드 */}
            <div className="ap-summary-cards">
                {cards.map(c => (
                    <div key={c.key} className="ap-summary-card" onClick={() => onBoxSelect(c.key)}>
                        <div className="ap-card-icon" style={{ background: c.color + '20', color: c.color }}>
                            {c.icon}
                        </div>
                        <div className="ap-card-info">
                            <div className="ap-card-value" style={{ color: c.color }}>
                                {loading ? '-' : c.value}
                            </div>
                            <div className="ap-card-label">{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 최근 문서 */}
            <div className="ap-recent-section">
                <div className="ap-section-title">최근 문서</div>
                <div className="ap-recent-list">
                    {loading ? (
                        <div className="ap-empty-msg">로딩 중...</div>
                    ) : recentDocs.length === 0 ? (
                        <div className="ap-empty-msg">작성한 문서가 없습니다.</div>
                    ) : recentDocs.map(doc => (
                        <div key={doc.id} className="ap-recent-item"
                            onClick={() => navigate(`/approval/documents/${doc.id}`)}>
                            <div className="ap-recent-info">
                                <span className="ap-recent-title">{doc.title}</span>
                                <span className="ap-recent-meta">
                                    {doc.template_name || '자유양식'} · {formatDate(doc.submitted_at || doc.created_at)}
                                </span>
                            </div>
                            <StatusBadge status={doc.status} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── 메인 컴포넌트 ────────────────────────
function Approval() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const [activeBox, setActiveBox] = useState(() => searchParams.get('box') || 'home');

    // URL ?box= 변경 시 activeBox 동기화
    useEffect(() => {
        const box = searchParams.get('box');
        setActiveBox(box || 'home');
    }, [location.search]);

    return (
        <div className="approval-page">
            {/* 좌측 사이드바 */}
            <aside className="ap-sidebar">
                <div className="ap-sidebar-top">
                    <button
                        className="ap-write-side-btn"
                        onClick={() => navigate('/approval/write')}
                    >
                        <IconPen size={15} style={{marginRight:6}}/> 문서 작성
                    </button>
                </div>

                <nav className="ap-nav">
                    <button
                        className={`ap-nav-home ${activeBox === 'home' ? 'active' : ''}`}
                        onClick={() => setActiveBox('home')}
                    >
                        결재 홈
                    </button>

                    {SIDE_MENU.map(group => (
                        <div key={group.group} className="ap-nav-group">
                            <div className="ap-nav-group-title">{group.group}</div>
                            {group.items.map(item => (
                                <button
                                    key={item.key}
                                    className={`ap-nav-item ${activeBox === item.key ? 'active' : ''}`}
                                    onClick={() => setActiveBox(item.key)}
                                >
                                    <span className="ap-nav-icon">{item.icon}</span>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>
            </aside>

            {/* 우측 콘텐츠 */}
            <main className="ap-main">
                {activeBox === 'home'
                    ? <DashboardHome onBoxSelect={setActiveBox} />
                    : <DocumentList box={activeBox} />
                }
            </main>
        </div>
    );
}

export default Approval;
