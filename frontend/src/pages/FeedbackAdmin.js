import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/authService';
import { useToast } from '../components/Toast';
import {
    IconBug, IconLightbulb, IconAlertTriangle, IconMessageSquare,
    IconCheckCircle, IconRefresh, IconX, IconSearch, IconUser
} from '../components/Icons';
import './FeedbackAdmin.css';

const TYPES = [
    { value: 'bug',           label: '버그 신고',   Icon: IconBug,           color: '#ef4444', bg: '#fef2f2' },
    { value: 'improvement',   label: '기능 개선',   Icon: IconLightbulb,     color: '#f59e0b', bg: '#fffbeb' },
    { value: 'inconvenience', label: '불편사항',    Icon: IconAlertTriangle, color: '#8b5cf6', bg: '#f5f3ff' },
    { value: 'other',         label: '기타',        Icon: IconMessageSquare, color: '#6b7280', bg: '#f3f4f6' },
];

const STATUSES = [
    { value: 'pending',   label: '접수됨',   color: '#6b7280', bg: '#f3f4f6',   dot: '#9ca3af' },
    { value: 'reviewing', label: '검토 중',  color: '#d97706', bg: '#fef3c7',   dot: '#f59e0b' },
    { value: 'resolved',  label: '처리완료', color: '#059669', bg: '#d1fae5',   dot: '#10b981' },
    { value: 'hold',      label: '보류',     color: '#9ca3af', bg: '#f9fafb',   dot: '#d1d5db' },
];

function getSLA(createdAt) {
    const hours = (Date.now() - new Date(createdAt)) / 3600000;
    if (hours < 24) return { label: `${Math.floor(hours)}h`, level: 'ok' };
    const days = Math.floor(hours / 24);
    if (days < 3) return { label: `${days}일`, level: 'warn' };
    return { label: `${days}일 경과`, level: 'danger' };
}

function TicketCard({ ticket, selected, onClick }) {
    const typeInfo = TYPES.find(t => t.value === ticket.type) || TYPES[3];
    const sla = getSLA(ticket.created_at);
    return (
        <div
            className={`fa-ticket ${selected ? 'selected' : ''}`}
            onClick={onClick}
        >
            <div className="fa-ticket-top">
                <span
                    className="fa-ticket-type"
                    style={{ color: typeInfo.color, background: typeInfo.bg }}
                >
                    <typeInfo.Icon size={11} />
                    {typeInfo.label}
                </span>
                <span className={`fa-ticket-sla ${sla.level}`}>{sla.label}</span>
            </div>
            <div className="fa-ticket-title">{ticket.title}</div>
            <div className="fa-ticket-meta">
                <span className="fa-ticket-author">{ticket.user_name}</span>
                <span className="fa-ticket-dot" />
                <span>{new Date(ticket.created_at).toLocaleDateString('ko-KR')}</span>
                {ticket.admin_note && (
                    <span className="fa-ticket-note-icon">
                        <IconCheckCircle size={12} />
                    </span>
                )}
            </div>
        </div>
    );
}

function DetailPanel({ ticket, onClose, onStatusChange, onSaveNote }) {
    const typeInfo = TYPES.find(t => t.value === ticket.type) || TYPES[3];
    const sla = getSLA(ticket.created_at);
    const [note, setNote] = useState(ticket.admin_note || '');

    useEffect(() => {
        setNote(ticket.admin_note || '');
    }, [ticket.id, ticket.admin_note]);

    return (
        <div className="fa-panel">
            <div className="fa-panel-head">
                <span className="fa-panel-id">티켓 #{ticket.id}</span>
                <button className="fa-panel-close" onClick={onClose}>
                    <IconX size={14} />
                </button>
            </div>

            <div className="fa-panel-body">
                <div>
                    <span
                        className="fa-panel-type"
                        style={{ color: typeInfo.color, background: typeInfo.bg }}
                    >
                        <typeInfo.Icon size={12} /> {typeInfo.label}
                    </span>
                </div>
                <h2 className="fa-panel-title">{ticket.title}</h2>

                <div className="fa-panel-meta">
                    <div className="fa-panel-meta-item">
                        <IconUser size={12} />
                        <strong>{ticket.user_name}</strong>
                        <span>({ticket.username})</span>
                    </div>
                    <div className="fa-panel-meta-item">
                        <span>{new Date(ticket.created_at).toLocaleString('ko-KR')}</span>
                    </div>
                    <div className="fa-panel-meta-item">
                        <span
                            className={`fa-panel-sla-badge fa-ticket-sla ${sla.level}`}
                        >
                            경과: {sla.label}
                        </span>
                    </div>
                </div>

                <div className="fa-panel-content">{ticket.content}</div>

                {/* 상태 변경 */}
                <div className="fa-section-label">상태 변경</div>
                <div className="fa-status-btns">
                    {STATUSES.map(s => (
                        <button
                            key={s.value}
                            className={`fa-status-btn ${ticket.status === s.value ? 'active' : ''}`}
                            style={{ '--sc': s.color, '--sb': s.bg }}
                            onClick={() => onStatusChange(ticket.id, s.value)}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* 담당자 답변 */}
                <div className="fa-section-label">담당자 답변</div>
                <div className="fa-note-form">
                    {ticket.admin_note && (
                        <div className="fa-note-existing">
                            <IconCheckCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                            {ticket.admin_note}
                        </div>
                    )}
                    <textarea
                        rows={4}
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder={ticket.admin_note ? '답변을 수정하세요.' : '처리 결과나 피드백을 남겨주세요.'}
                    />
                    <button
                        className="fa-note-save"
                        onClick={() => onSaveNote(ticket.id, note)}
                        disabled={!note.trim()}
                    >
                        <IconCheckCircle size={14} />
                        {ticket.admin_note ? '답변 수정' : '답변 저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function FeedbackAdmin() {
    const toast = useToast();
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);

    useEffect(() => { fetchList(); }, [filterType, filterStatus]);

    const fetchList = async () => {
        setLoading(true);
        try {
            const res = await api.get('/feedback', {
                params: { type: filterType || undefined, status: filterStatus || undefined }
            });
            setList(res.data.data);
        } catch { toast.error('불러오지 못했습니다.'); }
        finally { setLoading(false); }
    };

    const updateStatus = async (id, status) => {
        try {
            await api.patch(`/feedback/${id}`, { status });
            setList(prev => prev.map(f => f.id === id ? { ...f, status } : f));
            setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
            toast.success('상태가 변경되었습니다.');
        } catch { toast.error('변경하지 못했습니다.'); }
    };

    const saveNote = async (id, note) => {
        if (!note.trim()) return;
        try {
            await api.patch(`/feedback/${id}`, { admin_note: note.trim() });
            setList(prev => prev.map(f => f.id === id ? { ...f, admin_note: note.trim() } : f));
            setSelected(prev => prev?.id === id ? { ...prev, admin_note: note.trim() } : prev);
            toast.success('답변이 저장되었습니다.');
        } catch { toast.error('저장하지 못했습니다.'); }
    };

    // 검색 필터 적용
    const filtered = useMemo(() => {
        if (!search.trim()) return list;
        const q = search.toLowerCase();
        return list.filter(f =>
            f.title.toLowerCase().includes(q) ||
            f.user_name?.toLowerCase().includes(q) ||
            f.username?.toLowerCase().includes(q)
        );
    }, [list, search]);

    // 상태별 그룹
    const grouped = useMemo(() => {
        const map = {};
        STATUSES.forEach(s => { map[s.value] = []; });
        filtered.forEach(f => {
            if (map[f.status]) map[f.status].push(f);
        });
        return map;
    }, [filtered]);

    const selectedTicket = selected ? list.find(f => f.id === selected) : null;

    return (
        <div className="fa-page">
            {/* Header */}
            <div className="fa-header">
                <h1 className="fa-header-title">
                    <IconMessageSquare size={20} />
                    피드백 관리
                </h1>
                <div className="fa-header-stats">
                    {STATUSES.map(s => {
                        const count = (grouped[s.value] || []).length;
                        return (
                            <div
                                key={s.value}
                                className={`fa-stat-chip ${filterStatus === s.value ? 'active' : ''}`}
                                style={{
                                    background: s.bg,
                                    color: s.color,
                                    '--chip-color': s.color,
                                }}
                                onClick={() => setFilterStatus(prev => prev === s.value ? '' : s.value)}
                            >
                                <span className="chip-count">{count}</span>
                                <span>{s.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Toolbar */}
            <div className="fa-toolbar">
                <div className="fa-search">
                    <IconSearch size={14} style={{ color: '#bbb', flexShrink: 0 }} />
                    <input
                        type="text"
                        placeholder="제목, 작성자 검색..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="fa-filter-select"
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                >
                    <option value="">전체 유형</option>
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <span className="fa-total">총 {filtered.length}건</span>
                <button className="fa-refresh-btn" onClick={fetchList}>
                    <IconRefresh size={14} />
                    새로고침
                </button>
            </div>

            {/* Main: Board + Panel */}
            <div className="fa-main">
                {loading ? (
                    <div className="fa-loading"><div className="spinner" /></div>
                ) : (
                    <>
                        <div className="fa-board">
                            {STATUSES.map(s => (
                                <div key={s.value} className="fa-col">
                                    <div className="fa-col-header">
                                        <div className="fa-col-dot" style={{ background: s.dot }} />
                                        <span className="fa-col-label">{s.label}</span>
                                        <span
                                            className="fa-col-count"
                                            style={{ background: s.dot }}
                                        >
                                            {(grouped[s.value] || []).length}
                                        </span>
                                    </div>
                                    <div className="fa-col-body">
                                        {(grouped[s.value] || []).length === 0 ? (
                                            <div className="fa-col-empty">티켓 없음</div>
                                        ) : (
                                            grouped[s.value].map(ticket => (
                                                <TicketCard
                                                    key={ticket.id}
                                                    ticket={ticket}
                                                    selected={selected === ticket.id}
                                                    onClick={() => setSelected(
                                                        selected === ticket.id ? null : ticket.id
                                                    )}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {selectedTicket && (
                            <DetailPanel
                                ticket={selectedTicket}
                                onClose={() => setSelected(null)}
                                onStatusChange={updateStatus}
                                onSaveNote={saveNote}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
