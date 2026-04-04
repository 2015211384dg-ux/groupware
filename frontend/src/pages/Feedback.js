import React, { useState, useEffect } from 'react';
import api from '../services/authService';
import { useToast } from '../components/Toast';
import { IconMessageSquare, IconBug, IconLightbulb, IconAlertTriangle, IconInfo, IconCheckCircle } from '../components/Icons';
import './Feedback.css';

const TYPES = [
    { value: 'bug',          label: '버그 신고',      icon: <IconBug size={18} />,          color: '#ef4444' },
    { value: 'improvement',  label: '기능 개선 제안',  icon: <IconLightbulb size={18} />,    color: '#f59e0b' },
    { value: 'inconvenience',label: '불편사항',        icon: <IconAlertTriangle size={18} />, color: '#8b5cf6' },
    { value: 'other',        label: '기타',            icon: <IconMessageSquare size={18} />, color: '#6b7280' },
];

const STATUS_MAP = {
    pending:    { label: '접수됨',   color: '#6b7280', bg: '#f3f4f6' },
    reviewing:  { label: '검토 중',  color: '#f59e0b', bg: '#fef3c7' },
    resolved:   { label: '처리완료', color: '#059669', bg: '#d1fae5' },
    hold:       { label: '보류',     color: '#9ca3af', bg: '#f9fafb' },
};

export default function Feedback() {
    const toast = useToast();
    const [tab, setTab] = useState('submit'); // 'submit' | 'mine'
    const [form, setForm] = useState({ type: 'bug', title: '', content: '' });
    const [submitting, setSubmitting] = useState(false);
    const [myList, setMyList] = useState([]);
    const [listLoading, setListLoading] = useState(false);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        if (tab === 'mine') fetchMine();
    }, [tab]);

    const fetchMine = async () => {
        setListLoading(true);
        try {
            const res = await api.get('/feedback/mine');
            setMyList(res.data.data);
        } catch { toast.error('불러오지 못했습니다.'); }
        finally { setListLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.content.trim()) {
            toast.error('제목과 내용을 입력해주세요.');
            return;
        }
        try {
            setSubmitting(true);
            await api.post('/feedback', form);
            toast.success('피드백이 등록되었습니다. 감사합니다!');
            setForm({ type: 'bug', title: '', content: '' });
            setTab('mine');
        } catch { toast.error('등록하지 못했습니다.'); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="feedback-page">
            <div className="feedback-header">
                <h1><IconMessageSquare size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />베타 피드백</h1>
                <p>불편했던 점, 버그, 개선 아이디어를 자유롭게 남겨주세요.</p>
            </div>

            <div className="feedback-tabs">
                <button className={tab === 'submit' ? 'active' : ''} onClick={() => setTab('submit')}>피드백 남기기</button>
                <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>내 피드백</button>
            </div>

            <div className="feedback-body">
                {tab === 'submit' && (
                    <div className="feedback-form-wrap">
                        <form onSubmit={handleSubmit} className="feedback-form">
                            {/* 유형 선택 */}
                            <div className="feedback-type-grid">
                                {TYPES.map(t => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        className={`type-card ${form.type === t.value ? 'selected' : ''}`}
                                        style={{ '--type-color': t.color }}
                                        onClick={() => setForm(p => ({ ...p, type: t.value }))}
                                    >
                                        <span className="type-icon">{t.icon}</span>
                                        <span className="type-label">{t.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="fb-field">
                                <label>제목</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="한 줄로 요약해주세요"
                                    maxLength={100}
                                    required
                                />
                            </div>

                            <div className="fb-field">
                                <label>내용</label>
                                <textarea
                                    value={form.content}
                                    onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                                    placeholder={
                                        form.type === 'bug'
                                            ? "어떤 상황에서 발생했는지, 어떻게 재현할 수 있는지 알려주세요."
                                            : form.type === 'improvement'
                                            ? "어떤 기능이 있으면 좋을지 자세히 알려주세요."
                                            : "불편했던 상황을 자세히 알려주세요."
                                    }
                                    rows={6}
                                    required
                                />
                            </div>

                            <button type="submit" className="fb-submit" disabled={submitting}>
                                {submitting ? '등록 중...' : '피드백 제출하기'}
                            </button>
                        </form>
                    </div>
                )}

                {tab === 'mine' && (
                    <div className="feedback-list">
                        {listLoading ? (
                            <div className="fb-loading"><div className="spinner" /></div>
                        ) : myList.length === 0 ? (
                            <div className="fb-empty">
                                <IconMessageSquare size={40} />
                                <p>아직 제출한 피드백이 없습니다.</p>
                                <button onClick={() => setTab('submit')}>첫 피드백 남기기</button>
                            </div>
                        ) : myList.map(item => {
                            const typeInfo = TYPES.find(t => t.value === item.type) || TYPES[3];
                            const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.pending;
                            return (
                                <div key={item.id} className="fb-item" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                                    <div className="fb-item-head">
                                        <span className="fb-item-type" style={{ color: typeInfo.color }}>{typeInfo.icon} {typeInfo.label}</span>
                                        <span className="fb-item-status" style={{ color: statusInfo.color, background: statusInfo.bg }}>{statusInfo.label}</span>
                                    </div>
                                    <div className="fb-item-title">{item.title}</div>
                                    <div className="fb-item-date">{new Date(item.created_at).toLocaleDateString('ko-KR')}</div>
                                    {expanded === item.id && (
                                        <div className="fb-item-detail">
                                            <p className="fb-item-content">{item.content}</p>
                                            {item.admin_note && (
                                                <div className="fb-admin-note">
                                                    <IconCheckCircle size={14} /> 담당자 답변: {item.admin_note}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
