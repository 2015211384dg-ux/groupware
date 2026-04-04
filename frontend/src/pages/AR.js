import React, { useState, useEffect, useCallback } from 'react';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    ArcElement, Tooltip, Legend, Title
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import api from '../services/authService';
import { useToast } from '../components/Toast';
import { IconPlus, IconTrash, IconEdit, IconX, IconCheck, IconSearch } from '../components/Icons';
import { CURRENCIES, CATEGORIES, STATUS_LABEL, STATUS_CLS, fmt, fmtDate, exportXLSX } from './arUtils';
import './AR.css';
import './AR-dashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title);

// 도넛 중앙 텍스트 플러그인
const centerLabelPlugin = {
    id: 'centerLabel',
    beforeDraw(chart) {
        const text = chart.options.plugins?.centerLabel?.text;
        if (!text) return;
        const { ctx, chartArea } = chart;
        const cx = (chartArea.left + chartArea.right) / 2;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.font = '700 15px sans-serif';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, cy);
        ctx.restore();
    }
};

// ── 스켈레톤 로딩 컴포넌트 ────────────────────
function SkeletonDashboard() {
    return (
        <>
            <div className="ar-kpi-grid">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="ar-skeleton-card">
                        <div className="ar-skeleton-base ar-skeleton-dot-ph" />
                        <div className="ar-skeleton-base ar-skeleton-label-ph" />
                        <div className="ar-skeleton-base ar-skeleton-value-ph" />
                        <div className="ar-skeleton-base ar-skeleton-sub-ph" />
                    </div>
                ))}
            </div>
            <div className="ar-dash-charts">
                <div className="ar-dash-chart-card">
                    <div className="ar-skeleton-base" style={{ height: 14, width: 160, marginBottom: 16, borderRadius: 6 }} />
                    <div className="ar-skeleton-base" style={{ height: 200, borderRadius: 8 }} />
                </div>
                <div className="ar-dash-chart-card">
                    <div className="ar-skeleton-base" style={{ height: 14, width: 120, marginBottom: 16, borderRadius: 6 }} />
                    <div className="ar-skeleton-base" style={{ height: 200, borderRadius: 8 }} />
                </div>
            </div>
            <div className="ar-table-section">
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f5f5f5', display: 'flex', gap: 8 }}>
                    <div className="ar-skeleton-base" style={{ height: 28, width: 280, borderRadius: 8 }} />
                    <div className="ar-skeleton-base" style={{ height: 28, width: 200, borderRadius: 8 }} />
                </div>
                <div style={{ padding: '0 18px' }}>
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="ar-skeleton-base" style={{ height: 46, borderRadius: 6, margin: '8px 0' }} />
                    ))}
                </div>
            </div>
        </>
    );
}

// ── 프로젝트 생성 모달 ────────────────────────
function CreateModal({ onClose, onSave }) {
    const toast = useToast();
    const [form, setForm] = useState({
        ar_code: '', title: '', description: '',
        budget_amount: '', currency: 'KRW', team_dept_ids: []
    });
    const [departments, setDepartments] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/ar/departments').then(r => setDepartments(r.data.data)).catch(() => {});
    }, []);

    const toggleDept = (id) => setForm(f => ({
        ...f,
        team_dept_ids: f.team_dept_ids.includes(id)
            ? f.team_dept_ids.filter(d => d !== id)
            : [...f.team_dept_ids, id]
    }));

    const handleSubmit = async () => {
        if (!form.ar_code || !form.title || !form.budget_amount) {
            toast.warning('AR 코드, 프로젝트명, 예산금액은 필수입니다.');
            return;
        }
        setSaving(true);
        try {
            await api.post('/ar/projects', form);
            toast.success('프로젝트가 생성되었습니다.');
            onSave();
        } catch (e) {
            toast.error(e.response?.data?.message || '생성 실패');
        } finally { setSaving(false); }
    };

    return (
        <div className="ar-modal-overlay" onClick={onClose}>
            <div className="ar-modal" onClick={e => e.stopPropagation()}>
                <div className="ar-modal-header">
                    <h3>새 AR 프로젝트 생성</h3>
                    <button onClick={onClose}><IconX size={16}/></button>
                </div>
                <div className="ar-modal-body">
                    <div className="ar-field-group">
                        <label>AR 코드 <span className="ar-req">*</span></label>
                        <input className="ar-input" placeholder="예: AR-2024-001"
                            value={form.ar_code} onChange={e => setForm(f => ({ ...f, ar_code: e.target.value }))} />
                    </div>
                    <div className="ar-field-group">
                        <label>프로젝트명 <span className="ar-req">*</span></label>
                        <input className="ar-input" placeholder="프로젝트 제목 입력"
                            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div className="ar-field-row">
                        <div className="ar-field-group" style={{ flex: 1 }}>
                            <label>예산금액 <span className="ar-req">*</span></label>
                            <div className="ar-amount-wrap">
                                <span className="ar-amount-sym">{CURRENCIES[form.currency]}</span>
                                <input className="ar-input ar-amount-input" placeholder="0"
                                    value={form.budget_amount ? Number(form.budget_amount).toLocaleString() : ''}
                                    onChange={e => setForm(f => ({ ...f, budget_amount: e.target.value.replace(/[^0-9]/g, '') }))} />
                            </div>
                        </div>
                        <div className="ar-field-group" style={{ width: 120 }}>
                            <label>통화</label>
                            <select className="ar-select" value={form.currency}
                                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                                {Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="ar-field-group">
                        <label>
                            열람 허용 팀
                            <span className="ar-label-hint"> (재경팀은 자동 포함 · 미선택 시 PM만 열람)</span>
                        </label>
                        <div className="ar-dept-grid">
                            {departments.map(d => (
                                <label key={d.id} className={`ar-dept-chip ${form.team_dept_ids.includes(d.id) ? 'selected' : ''}`}>
                                    <input type="checkbox" checked={form.team_dept_ids.includes(d.id)}
                                        onChange={() => toggleDept(d.id)} />
                                    {d.name}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="ar-field-group">
                        <label>프로젝트 내용</label>
                        <textarea className="ar-textarea" rows={3} placeholder="프로젝트 목적, 배경, 범위 등"
                            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                </div>
                <div className="ar-modal-footer">
                    <button className="ar-btn-cancel" onClick={onClose}>취소</button>
                    <button className="ar-btn-primary" onClick={handleSubmit} disabled={saving}>
                        <IconCheck size={14}/> {saving ? '생성 중...' : '프로젝트 생성'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 지출 추가 모달 ────────────────────────────
function ExpenseModal({ project, onClose, onSave }) {
    const toast = useToast();
    const today = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({
        amount: '', description: '', category: '기타', spent_at: today
    });
    const [saving, setSaving] = useState(false);

    const remaining = Number(project.budget_amount) - Number(project.spent_amount);
    const amountNum = Number(form.amount || 0);
    const isOverBudget = amountNum > 0 && amountNum > remaining;

    const handleSubmit = async () => {
        if (!form.amount || !form.description || !form.spent_at) {
            toast.warning('금액, 설명, 날짜는 필수입니다.');
            return;
        }
        if (isOverBudget) {
            toast.error(`잔여 예산(${CURRENCIES[project.currency] || '₩'} ${remaining.toLocaleString()})을 초과합니다.`);
            return;
        }
        setSaving(true);
        try {
            await api.post(`/ar/projects/${project.id}/expenses`, form);
            toast.success('지출이 등록되었습니다.');
            onSave();
        } catch (e) {
            toast.error(e.response?.data?.message || '등록 실패');
        } finally { setSaving(false); }
    };

    return (
        <div className="ar-modal-overlay" onClick={onClose}>
            <div className="ar-modal" onClick={e => e.stopPropagation()}>
                <div className="ar-modal-header">
                    <h3>지출 등록</h3>
                    <button onClick={onClose}><IconX size={16}/></button>
                </div>
                <div className="ar-modal-body">
                    <div className="ar-field-group">
                        <label>프로젝트</label>
                        <div className="ar-info-text">[{project.ar_code}] {project.title}</div>
                    </div>
                    <div className="ar-field-row">
                        <div className="ar-field-group" style={{ flex: 1 }}>
                            <label>금액 <span className="ar-req">*</span></label>
                            <div className="ar-amount-wrap">
                                <span className="ar-amount-sym">{CURRENCIES[project.currency] || '₩'}</span>
                                <input className={`ar-input ar-amount-input ${isOverBudget ? 'input-error' : ''}`} placeholder="0"
                                    value={form.amount ? Number(form.amount).toLocaleString() : ''}
                                    onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^0-9]/g, '') }))} />
                            </div>
                            {isOverBudget && (
                                <span className="ar-field-error">잔여 예산 {CURRENCIES[project.currency] || '₩'} {remaining.toLocaleString()} 초과</span>
                            )}
                        </div>
                        <div className="ar-field-group" style={{ width: 140 }}>
                            <label>카테고리</label>
                            <select className="ar-select" value={form.category}
                                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="ar-field-group" style={{ width: 150 }}>
                            <label>지출일 <span className="ar-req">*</span></label>
                            <input type="date" className="ar-input" value={form.spent_at} max={today}
                                onClick={e => e.currentTarget.showPicker?.()}
                                onChange={e => setForm(f => ({ ...f, spent_at: e.target.value }))} />
                        </div>
                    </div>
                    <div className="ar-field-group">
                        <label>내용 <span className="ar-req">*</span></label>
                        <textarea className="ar-textarea" rows={3} placeholder="지출 내용을 설명해주세요"
                            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                </div>
                <div className="ar-modal-footer">
                    <button className="ar-btn-cancel" onClick={onClose}>취소</button>
                    <button className="ar-btn-primary" onClick={handleSubmit} disabled={saving || isOverBudget}>
                        <IconCheck size={14}/> {saving ? '등록 중...' : '지출 등록'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 지출 수정 모달 ────────────────────────────
function EditExpenseModal({ expense, project, onClose, onSave }) {
    const toast = useToast();
    const today = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({
        amount: expense.amount,
        description: expense.description,
        category: expense.category || '기타',
        spent_at: expense.spent_at?.slice(0, 10) || '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!form.amount || !form.description || !form.spent_at) {
            toast.warning('금액, 설명, 날짜는 필수입니다.');
            return;
        }
        setSaving(true);
        try {
            await api.put(`/ar/expenses/${expense.id}`, form);
            toast.success('수정됐습니다.');
            onSave();
        } catch (e) {
            toast.error(e.response?.data?.message || '수정 실패');
        } finally { setSaving(false); }
    };

    return (
        <div className="ar-modal-overlay" onClick={onClose}>
            <div className="ar-modal" onClick={e => e.stopPropagation()}>
                <div className="ar-modal-header">
                    <h3>지출 수정</h3>
                    <button onClick={onClose}><IconX size={16}/></button>
                </div>
                <div className="ar-modal-body">
                    <div className="ar-field-row">
                        <div className="ar-field-group" style={{ flex: 1 }}>
                            <label>금액 <span className="ar-req">*</span></label>
                            <div className="ar-amount-wrap">
                                <span className="ar-amount-sym">{CURRENCIES[project.currency] || '₩'}</span>
                                <input className="ar-input ar-amount-input" placeholder="0"
                                    value={form.amount ? Number(form.amount).toLocaleString() : ''}
                                    onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^0-9]/g, '') }))} />
                            </div>
                        </div>
                        <div className="ar-field-group" style={{ width: 140 }}>
                            <label>카테고리</label>
                            <select className="ar-select" value={form.category}
                                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="ar-field-group" style={{ width: 150 }}>
                            <label>지출일 <span className="ar-req">*</span></label>
                            <input type="date" className="ar-input" value={form.spent_at} max={today}
                                onClick={e => e.currentTarget.showPicker?.()}
                                onChange={e => setForm(f => ({ ...f, spent_at: e.target.value }))} />
                        </div>
                    </div>
                    <div className="ar-field-group">
                        <label>내용 <span className="ar-req">*</span></label>
                        <textarea className="ar-textarea" rows={3}
                            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                </div>
                <div className="ar-modal-footer">
                    <button className="ar-btn-cancel" onClick={onClose}>취소</button>
                    <button className="ar-btn-primary" onClick={handleSubmit} disabled={saving}>
                        <IconCheck size={14}/> {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 슬라이드 패널 ─────────────────────────────
function SlidePanel({ projectId, currentUser, onClose, onViewDetail, onRefresh }) {
    const toast = useToast();
    const today = new Date().toISOString().slice(0, 10);
    const [data, setData]         = useState(null);
    const [loading, setLoading]   = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        amount: '', description: '', category: '기타', spent_at: today
    });
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/ar/projects/${projectId}`);
            setData(res.data.data);
        } catch { toast.error('불러오기 실패'); }
        finally { setLoading(false); }
    }, [projectId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAddExpense = async () => {
        if (!form.amount || !form.description || !form.spent_at) {
            toast.warning('금액, 설명, 날짜는 필수입니다.');
            return;
        }
        const proj = data?.project;
        const remaining = Number(proj?.budget_amount) - Number(proj?.spent_amount);
        if (Number(form.amount) > remaining) {
            toast.error(`잔여 예산(${remaining.toLocaleString()})을 초과합니다.`);
            return;
        }
        setSaving(true);
        try {
            await api.post(`/ar/projects/${projectId}/expenses`, form);
            toast.success('지출이 등록되었습니다.');
            setForm({ amount: '', description: '', category: '기타', spent_at: today });
            setShowForm(false);
            fetchData();
            onRefresh();
        } catch (e) {
            toast.error(e.response?.data?.message || '등록 실패');
        } finally { setSaving(false); }
    };

    if (loading) return (
        <div className="ar-slide-panel">
            <div className="ar-panel-loading">로딩 중...</div>
        </div>
    );
    if (!data) return null;

    const { project, expenses } = data;
    const budget    = Number(project.budget_amount);
    const spent     = Number(project.spent_amount);
    const remaining = budget - spent;
    const pct       = budget > 0 ? Math.min(100, Math.round(spent / budget * 100)) : 0;
    const isOver    = spent > budget;
    const sym       = CURRENCIES[project.currency] || '₩';
    const recent    = expenses.slice(0, 5);

    return (
        <div className="ar-slide-panel">
            {/* 헤더 */}
            <div className="ar-panel-header">
                <div className="ar-panel-header-top">
                    <div className="ar-panel-badges">
                        <span className="ar-code-badge">{project.ar_code}</span>
                        <span className={`ar-status-badge ${STATUS_CLS[project.status]}`}>{STATUS_LABEL[project.status]}</span>
                    </div>
                    <button className="ar-panel-close" onClick={onClose}><IconX size={15}/></button>
                </div>
                <h3 className="ar-panel-title">{project.title}</h3>
                <div className="ar-panel-meta">PM: {project.creator_name}</div>
            </div>

            {/* 예산 현황 */}
            <div className="ar-panel-budget">
                <div className="ar-panel-budget-row">
                    <span>총 예산</span>
                    <span className="ar-panel-bval">{sym} {budget.toLocaleString()}</span>
                </div>
                <div className="ar-panel-budget-row">
                    <span>총 지출</span>
                    <span className={`ar-panel-bval ${isOver ? 'red' : ''}`}>{sym} {spent.toLocaleString()}</span>
                </div>
                <div className="ar-panel-budget-row">
                    <span>{isOver ? '초과 금액' : '잔여 예산'}</span>
                    <span className={`ar-panel-bval ${isOver ? 'red' : 'green'}`}>
                        {isOver ? '▲ ' : ''}{sym} {Math.abs(remaining).toLocaleString()}
                    </span>
                </div>
                <div className="ar-panel-progress-track">
                    <div className={`ar-panel-progress-fill ${isOver ? 'over' : pct >= 80 ? 'warn' : ''}`}
                        style={{ width: `${pct}%` }} />
                </div>
                <div className="ar-panel-pct-row">
                    <span className={`ar-panel-pct ${isOver ? 'over' : pct >= 80 ? 'warn' : ''}`}>
                        {pct}% 집행
                    </span>
                    <span className="ar-panel-exp-cnt">{expenses.length}건</span>
                </div>
            </div>

            {/* 액션 버튼 */}
            <div className="ar-panel-actions">
                <button
                    className={`ar-panel-btn-add ${showForm ? 'cancel' : ''}`}
                    onClick={() => setShowForm(f => !f)}>
                    {showForm ? <><IconX size={13}/> 취소</> : <><IconPlus size={13}/> 지출 등록</>}
                </button>
                <button className="ar-panel-btn-detail" onClick={onViewDetail}>
                    전체 보기 →
                </button>
            </div>

            {/* 빠른 지출 등록 폼 */}
            {showForm && (
                <div className="ar-panel-form">
                    <div className="ar-panel-form-row">
                        <div className="ar-panel-field" style={{ flex: 1 }}>
                            <label>금액</label>
                            <div className="ar-amount-wrap">
                                <span className="ar-amount-sym">{sym}</span>
                                <input className="ar-input ar-amount-input" placeholder="0"
                                    value={form.amount ? Number(form.amount).toLocaleString() : ''}
                                    onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^0-9]/g, '') }))} />
                            </div>
                        </div>
                        <div className="ar-panel-field" style={{ width: 110 }}>
                            <label>카테고리</label>
                            <select className="ar-select" value={form.category}
                                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="ar-panel-field">
                        <label>내용</label>
                        <input className="ar-input" placeholder="지출 내용을 입력하세요"
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div className="ar-panel-field">
                        <label>지출일</label>
                        <input type="date" className="ar-input" value={form.spent_at} max={today}
                            onChange={e => setForm(f => ({ ...f, spent_at: e.target.value }))} />
                    </div>
                    <button className="ar-panel-submit" onClick={handleAddExpense} disabled={saving}>
                        <IconCheck size={13}/> {saving ? '등록 중...' : '등록하기'}
                    </button>
                </div>
            )}

            {/* 최근 지출 내역 */}
            <div className="ar-panel-section-title">
                최근 지출
                {expenses.length > 5 && <span className="ar-panel-more">총 {expenses.length}건</span>}
            </div>
            {recent.length === 0 ? (
                <div className="ar-panel-empty">등록된 지출이 없습니다.</div>
            ) : (
                <div className="ar-panel-exp-list">
                    {recent.map(exp => (
                        <div key={exp.id} className="ar-panel-exp-item">
                            <div className="ar-panel-exp-top">
                                <span className="ar-cat-badge">{exp.category || '기타'}</span>
                                <span className="ar-panel-exp-amount">{sym} {Number(exp.amount).toLocaleString()}</span>
                            </div>
                            <div className="ar-panel-exp-desc">{exp.description}</div>
                            <div className="ar-panel-exp-foot">
                                <span>{exp.user_name}</span>
                                <span>{exp.spent_at?.slice(0, 10)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── 프로젝트 상세 ─────────────────────────────
function ProjectDetail({ projectId, onBack, currentUser }) {
    const toast = useToast();
    const [data, setData]           = useState(null);
    const [loading, setLoading]     = useState(true);
    const [showExpModal, setShowExpModal]   = useState(false);
    const [editExpense, setEditExpense]     = useState(null);
    const [statusSaving, setStatusSaving]  = useState(false);

    const fetchDetail = useCallback(async () => {
        try {
            const res = await api.get(`/ar/projects/${projectId}`);
            setData(res.data.data);
        } catch { toast.error('불러오기 실패'); }
        finally { setLoading(false); }
    }, [projectId]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    const handleDeleteExpense = async (id) => {
        if (!window.confirm('지출을 삭제하시겠습니까?')) return;
        try {
            await api.delete(`/ar/expenses/${id}`);
            toast.success('삭제됐습니다.');
            fetchDetail();
        } catch (e) { toast.error(e.response?.data?.message || '삭제 실패'); }
    };

    const handleStatusChange = async (newStatus) => {
        setStatusSaving(true);
        try {
            const p = data.project;
            await api.put(`/ar/projects/${projectId}`, {
                title: p.title, description: p.description,
                budget_amount: p.budget_amount, currency: p.currency,
                status: newStatus,
            });
            toast.success('상태가 변경됐습니다.');
            fetchDetail();
        } catch { toast.error('상태 변경 실패'); }
        finally { setStatusSaving(false); }
    };

    if (loading) return <div className="ar-loading">로딩 중...</div>;
    if (!data) return null;

    const { project, expenses, monthly, byCategory, teamDepts = [] } = data;
    const spent = Number(project.spent_amount);
    const budget = Number(project.budget_amount);
    const remaining = budget - spent;
    const pct = budget > 0 ? Math.min(100, Math.round(spent / budget * 100)) : 0;
    const sym = CURRENCIES[project.currency] || '₩';
    const isOver = spent > budget;
    const isPM = project.created_by === currentUser?.id || ['SUPER_ADMIN','ADMIN'].includes(currentUser?.role);

    const barData = {
        labels: monthly.map(m => m.month),
        datasets: [{
            label: '월별 지출',
            data: monthly.map(m => Number(m.total)),
            backgroundColor: 'rgba(102,126,234,0.7)',
            borderRadius: 6,
        }]
    };
    const doughnutData = {
        labels: byCategory.map(b => b.category),
        datasets: [{
            data: byCategory.map(b => Number(b.total)),
            backgroundColor: ['#667eea','#764ba2','#f093fb','#4facfe','#43e97b','#f5af19'],
            borderWidth: 0,
        }]
    };

    return (
        <div className="ar-detail">
            {showExpModal && (
                <ExpenseModal project={project} onClose={() => setShowExpModal(false)}
                    onSave={() => { setShowExpModal(false); fetchDetail(); }} />
            )}
            {editExpense && (
                <EditExpenseModal expense={editExpense} project={project}
                    onClose={() => setEditExpense(null)}
                    onSave={() => { setEditExpense(null); fetchDetail(); }} />
            )}

            <div className="ar-detail-header">
                <div className="ar-detail-header-left">
                    <button className="ar-back-btn" onClick={onBack}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        목록으로
                    </button>
                    <div>
                        <div className="ar-detail-title-row">
                            <span className="ar-code-badge">{project.ar_code}</span>
                            <h2 className="ar-detail-title">{project.title}</h2>
                        </div>
                        {teamDepts.length > 0 && (
                            <div className="ar-team-tags">
                                <span className="ar-team-label">열람팀:</span>
                                <span className="ar-team-tag finance">재경팀</span>
                                {teamDepts.map(d => (
                                    <span key={d.id} className="ar-team-tag">{d.name}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="ar-detail-header-right">
                    {isPM ? (
                        <select className={`ar-status-select ${STATUS_CLS[project.status]}`}
                            value={project.status}
                            onChange={e => handleStatusChange(e.target.value)}
                            disabled={statusSaving}>
                            <option value="active">진행중</option>
                            <option value="on_hold">보류</option>
                            <option value="closed">완료</option>
                        </select>
                    ) : (
                        <span className={`ar-status-badge ${STATUS_CLS[project.status]}`}>{STATUS_LABEL[project.status]}</span>
                    )}
                    {expenses.length > 0 && (
                        <button className="ar-btn-secondary" onClick={() => exportXLSX(project, expenses, monthly, byCategory)}>
                            Excel 내보내기
                        </button>
                    )}
                    <button className="ar-btn-primary" onClick={() => setShowExpModal(true)}>
                        <IconPlus size={14}/> 지출 등록
                    </button>
                </div>
            </div>

            <div className="ar-summary-row">
                <div className="ar-sum-card blue">
                    <div className="ar-sum-label">총 예산</div>
                    <div className="ar-sum-value">{fmt(budget, project.currency)}</div>
                </div>
                <div className="ar-sum-card orange">
                    <div className="ar-sum-label">총 지출</div>
                    <div className="ar-sum-value">{fmt(spent, project.currency)}</div>
                </div>
                <div className={`ar-sum-card ${isOver ? 'red' : 'green'}`}>
                    <div className="ar-sum-label">{isOver ? '초과 금액' : '잔여 예산'}</div>
                    <div className="ar-sum-value">{isOver ? '▲ ' : ''}{fmt(Math.abs(remaining), project.currency)}</div>
                </div>
                <div className="ar-sum-card purple">
                    <div className="ar-sum-label">집행률</div>
                    <div className="ar-sum-value">{pct}%</div>
                </div>
            </div>

            <div className="ar-progress-wrap">
                <div className="ar-progress-header">
                    <span>예산 집행 현황</span>
                    <span className={isOver ? 'ar-over-text' : ''}>{pct}% 사용</span>
                </div>
                <div className="ar-progress-bar">
                    <div className={`ar-progress-fill ${isOver ? 'over' : pct > 80 ? 'warn' : ''}`}
                        style={{ width: `${pct}%` }} />
                </div>
            </div>

            {(monthly.length > 0 || byCategory.length > 0) && (
                <div className="ar-charts-row">
                    {monthly.length > 0 && (
                        <div className="ar-chart-card">
                            <div className="ar-chart-title">월별 지출</div>
                            <Bar data={barData} options={{
                                responsive: true, maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: { y: { ticks: { callback: v => `${sym}${Number(v).toLocaleString()}` } } }
                            }} />
                        </div>
                    )}
                    {byCategory.length > 0 && (
                        <div className="ar-chart-card ar-chart-sm">
                            <div className="ar-chart-title">카테고리별 지출</div>
                            <div className="ar-doughnut-wrap">
                                <Doughnut data={doughnutData} options={{
                                    responsive: true, maintainAspectRatio: false,
                                    plugins: {
                                        legend: { position: 'right', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } }
                                    }
                                }} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {project.description && (
                <div className="ar-desc-card">
                    <div className="ar-section-title">프로젝트 내용</div>
                    <p className="ar-desc-body">{project.description}</p>
                </div>
            )}

            <div className="ar-expense-card">
                <div className="ar-section-title">지출 내역 ({expenses.length}건)</div>
                {expenses.length === 0 ? (
                    <div className="ar-empty">등록된 지출이 없습니다.</div>
                ) : (
                    <table className="ar-table">
                        <thead>
                            <tr>
                                <th>날짜</th>
                                <th>내용</th>
                                <th>카테고리</th>
                                <th>등록자</th>
                                <th style={{ textAlign: 'right' }}>금액</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map(exp => (
                                <tr key={exp.id}>
                                    <td className="ar-td-date">{fmtDate(exp.spent_at)}</td>
                                    <td className="ar-td-desc">{exp.description}</td>
                                    <td><span className="ar-cat-badge">{exp.category || '기타'}</span></td>
                                    <td className="ar-td-user">{exp.user_name}</td>
                                    <td className="ar-td-amount">{fmt(exp.amount, project.currency)}</td>
                                    <td>
                                        <div className="ar-exp-actions">
                                            {exp.user_id === currentUser?.id && (
                                                <button className="ar-exp-edit" onClick={() => setEditExpense(exp)} title="수정">
                                                    <IconEdit size={13}/>
                                                </button>
                                            )}
                                            {['SUPER_ADMIN','ADMIN'].includes(currentUser?.role) && (
                                                <button className="ar-exp-del" onClick={() => handleDeleteExpense(exp.id)} title="삭제">
                                                    <IconTrash size={13}/>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, paddingRight: 8 }}>합계</td>
                                <td className="ar-td-amount" style={{ fontWeight: 800 }}>{fmt(spent, project.currency)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
        </div>
    );
}

// ── 메인 AR 대시보드 ──────────────────────────
export default function AR({ user }) {
    const toast = useToast();
    const [projects, setProjects]       = useState([]);
    const [monthlyStats, setMonthlyStats] = useState([]);
    const [loading, setLoading]         = useState(true);
    const [showCreate, setShowCreate]   = useState(false);
    const [selectedId, setSelectedId]   = useState(null);
    const [panelId, setPanelId]         = useState(null);
    const [activeTab, setActiveTab]     = useState('all');
    const [search, setSearch]           = useState('');
    const [sortBy, setSortBy]           = useState('created_at');

    const fetchAll = useCallback(async () => {
        try {
            const [pRes, sRes] = await Promise.all([
                api.get('/ar/projects'),
                api.get('/ar/stats'),
            ]);
            setProjects(pRes.data.data || []);
            setMonthlyStats(sRes.data.data?.monthly || []);
        } catch { toast.error('불러오기 실패'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    if (selectedId) {
        return <ProjectDetail
            projectId={selectedId}
            onBack={() => { setSelectedId(null); fetchAll(); }}
            currentUser={user} />;
    }

    // ── KPI 계산 ──
    const total       = projects.length;
    const cntActive   = projects.filter(p => p.status === 'active').length;
    const cntOnHold   = projects.filter(p => p.status === 'on_hold').length;
    const cntClosed   = projects.filter(p => p.status === 'closed').length;
    const getPct      = p => Number(p.budget_amount) > 0 ? Number(p.spent_amount) / Number(p.budget_amount) : 0;
    const cntDanger   = projects.filter(p => getPct(p) >= 0.8).length;
    const totalBudget = projects.reduce((s, p) => s + Number(p.budget_amount), 0);
    const totalSpent  = projects.reduce((s, p) => s + Number(p.spent_amount), 0);
    const avgPct      = total > 0 ? Math.round(projects.reduce((s, p) => s + getPct(p) * 100, 0) / total) : 0;

    // ── 차트 데이터 ──
    const barData = {
        labels: monthlyStats.map(m => m.month),
        datasets: [{
            label: '월별 지출',
            data: monthlyStats.map(m => Number(m.total)),
            backgroundColor: 'rgba(102,126,234,0.8)',
            hoverBackgroundColor: 'rgba(102,126,234,1)',
            borderRadius: 5,
        }]
    };
    const donutData = {
        labels: ['진행중', '보류', '완료'],
        datasets: [{
            data: [cntActive, cntOnHold, cntClosed],
            backgroundColor: ['#667eea', '#f6ad55', '#68d391'],
            borderWidth: 2,
            borderColor: '#fff',
        }]
    };

    // ── 필터 & 정렬 ──
    let filtered = projects.filter(p => {
        if (activeTab === 'active')  return p.status === 'active';
        if (activeTab === 'on_hold') return p.status === 'on_hold';
        if (activeTab === 'closed')  return p.status === 'closed';
        if (activeTab === 'danger')  return getPct(p) >= 0.8;
        return true;
    });
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(p =>
            p.ar_code.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q) ||
            (p.creator_name || '').includes(q)
        );
    }
    filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'pct_desc')       return getPct(b) - getPct(a);
        if (sortBy === 'pct_asc')        return getPct(a) - getPct(b);
        if (sortBy === 'remaining_asc')  return (Number(a.budget_amount) - Number(a.spent_amount)) - (Number(b.budget_amount) - Number(b.spent_amount));
        return new Date(b.created_at) - new Date(a.created_at);
    });

    const kpiCards = [
        { label: '전체 AR',   value: total,                                      sub: `보류 ${cntOnHold} · 완료 ${cntClosed}`,  cls: 'default' },
        { label: '진행중',    value: cntActive,                                   sub: '활성 프로젝트',                           cls: 'blue' },
        { label: '주의 필요', value: cntDanger,                                   sub: '집행률 80% 이상',                         cls: cntDanger > 0 ? 'red' : 'green' },
        { label: '총 예산',   value: `₩ ${totalBudget.toLocaleString()}`,         sub: '전체 합산',                               cls: 'purple', lg: true },
        { label: '총 지출',   value: `₩ ${totalSpent.toLocaleString()}`,          sub: '전체 집행 합계',                          cls: 'orange', lg: true },
        { label: '평균 집행률', value: `${avgPct}%`,                              sub: '전체 프로젝트 평균',                       cls: avgPct >= 80 ? 'red' : avgPct >= 60 ? 'orange' : 'blue' },
    ];

    return (
        <div className="ar-page">
            {showCreate && (
                <CreateModal onClose={() => setShowCreate(false)}
                    onSave={() => { setShowCreate(false); fetchAll(); }} />
            )}

            {/* 페이지 헤더 */}
            <div className="ar-header">
                <div>
                    <h1 className="ar-page-title">AR (Appropriation Request)</h1>
                    <p className="ar-page-sub">프로젝트 예산 승인 및 지출 관리</p>
                </div>
                <button className="ar-btn-primary" onClick={() => setShowCreate(true)}>
                    <IconPlus size={14}/> 프로젝트 생성
                </button>
            </div>

            {loading ? (
                <SkeletonDashboard />
            ) : (
                <>
                    {/* KPI 카드 */}
                    <div className="ar-kpi-grid">
                        {kpiCards.map(({ label, value, sub, cls, lg }) => (
                            <div key={label} className="ar-kpi-card">
                                <div className="ar-kpi-dot-row">
                                    <span className={`ar-kpi-dot ${cls}`}/>
                                    <span className="ar-kpi-label">{label}</span>
                                </div>
                                <div className={`ar-kpi-value ${lg ? 'sm' : ''}`}>{value}</div>
                                <div className="ar-kpi-sub">{sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* 집계 차트 */}
                    {(monthlyStats.length > 0 || total > 0) && (
                        <div className="ar-dash-charts">
                            {monthlyStats.length > 0 && (
                                <div className="ar-dash-chart-card">
                                    <div className="ar-dash-chart-title">전체 월별 지출 추이</div>
                                    <div className="ar-dash-chart-body">
                                        <Bar data={barData} options={{
                                            responsive: true, maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: {
                                                y: { ticks: { callback: v => `₩${(v / 10000).toFixed(0)}만` } }
                                            }
                                        }} />
                                    </div>
                                </div>
                            )}
                            {total > 0 && (
                                <div className="ar-dash-chart-card ar-dash-chart-sm">
                                    <div className="ar-dash-chart-title">프로젝트 상태 현황</div>
                                    <div className="ar-dash-chart-body" style={{ position: 'relative' }}>
                                        <Doughnut
                                            data={donutData}
                                            plugins={[centerLabelPlugin]}
                                            options={{
                                                responsive: true, maintainAspectRatio: false,
                                                cutout: '62%',
                                                plugins: {
                                                    centerLabel: { text: `총 ${total}건` },
                                                    legend: { position: 'right', labels: { boxWidth: 11, padding: 14, font: { size: 12 } } }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 프로젝트 테이블 */}
                    <div className="ar-table-section">
                        <div className="ar-table-topbar">
                            <div className="ar-tabs">
                                {[
                                    { key: 'all',     label: `전체`,  count: total },
                                    { key: 'active',  label: `진행중`, count: cntActive },
                                    { key: 'on_hold', label: `보류`,   count: cntOnHold },
                                    { key: 'closed',  label: `완료`,   count: cntClosed },
                                    { key: 'danger',  label: `위험`,   count: cntDanger, warn: cntDanger > 0 },
                                ].map(({ key, label, count, warn }) => (
                                    <button key={key}
                                        className={`ar-tab ${activeTab === key ? 'active' : ''} ${warn ? 'warn' : ''}`}
                                        onClick={() => { setActiveTab(key); setPanelId(null); }}>
                                        {label}
                                        <span className="ar-tab-count">{count}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="ar-table-tools">
                                <div className="ar-search-wrap">
                                    <IconSearch size={14} className="ar-search-icon" />
                                    <input className="ar-search" placeholder="AR 코드 / 프로젝트명 / PM"
                                        value={search} onChange={e => setSearch(e.target.value)} />
                                    {search && (
                                        <button className="ar-search-clear" onClick={() => setSearch('')}>
                                            <IconX size={12} />
                                        </button>
                                    )}
                                </div>
                                <select className="ar-sort-select" value={sortBy}
                                    onChange={e => setSortBy(e.target.value)}>
                                    <option value="created_at">최신순</option>
                                    <option value="pct_desc">집행률 높은순</option>
                                    <option value="pct_asc">집행률 낮은순</option>
                                    <option value="remaining_asc">잔여예산 낮은순</option>
                                </select>
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <div className="ar-empty-state">
                                <div className="ar-empty-svg-wrap">
                                    {search ? (
                                        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#c8cdd8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                            <line x1="8" y1="11" x2="14" y2="11"/>
                                        </svg>
                                    ) : (
                                        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#c8cdd8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
                                            <polyline points="13 2 13 9 20 9"/>
                                            <line x1="9" y1="13" x2="15" y2="13"/>
                                            <line x1="9" y1="17" x2="12" y2="17"/>
                                        </svg>
                                    )}
                                </div>
                                <p className="ar-empty-title">
                                    {search ? `"${search}" 검색 결과가 없습니다` : '프로젝트가 없습니다'}
                                </p>
                                <p className="ar-empty-desc">
                                    {search
                                        ? 'AR 코드, 프로젝트명, PM 이름으로 검색해 보세요'
                                        : activeTab !== 'all' ? '다른 탭에서 확인해 보세요' : '첫 번째 AR 프로젝트를 생성해 보세요'}
                                </p>
                                {activeTab === 'all' && !search && (
                                    <button className="ar-btn-primary" onClick={() => setShowCreate(true)}>
                                        <IconPlus size={14}/> 프로젝트 생성
                                    </button>
                                )}
                                {search && (
                                    <button className="ar-empty-clear-btn" onClick={() => setSearch('')}>
                                        검색 초기화
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="ar-main-table-wrap">
                                <table className="ar-main-table">
                                    <thead>
                                        <tr>
                                            <th>AR 코드</th>
                                            <th>프로젝트명</th>
                                            <th>PM</th>
                                            <th>상태</th>
                                            <th style={{ textAlign: 'right' }}>예산</th>
                                            <th style={{ textAlign: 'right' }}>지출</th>
                                            <th style={{ minWidth: 150 }}>집행률</th>
                                            <th>생성일</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(p => {
                                            const pct    = Number(p.budget_amount) > 0 ? Math.min(100, Math.round(Number(p.spent_amount) / Number(p.budget_amount) * 100)) : 0;
                                            const isOver = Number(p.spent_amount) > Number(p.budget_amount);
                                            const isDanger  = pct >= 80;
                                            const isSelected = panelId === p.id;
                                            return (
                                                <tr key={p.id}
                                                    className={`ar-main-row ${isDanger ? 'danger' : ''} ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => setPanelId(prev => prev === p.id ? null : p.id)}>
                                                    <td><span className="ar-code-badge">{p.ar_code}</span></td>
                                                    <td className="ar-td-title">{p.title}</td>
                                                    <td className="ar-td-meta">{p.creator_name}</td>
                                                    <td><span className={`ar-status-badge ${STATUS_CLS[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                                                    <td style={{ textAlign: 'right' }}>{fmt(Number(p.budget_amount), p.currency)}</td>
                                                    <td style={{ textAlign: 'right', color: isOver ? '#e53e3e' : undefined }}>
                                                        {fmt(Number(p.spent_amount), p.currency)}
                                                    </td>
                                                    <td>
                                                        <div className="ar-tbl-pct-wrap">
                                                            <div className="ar-tbl-bar">
                                                                <div className={`ar-tbl-bar-fill ${isOver ? 'over' : isDanger ? 'warn' : ''}`}
                                                                    style={{ width: `${pct}%` }} />
                                                            </div>
                                                            <span className={`ar-tbl-pct ${isOver ? 'over' : isDanger ? 'warn' : ''}`}>{pct}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="ar-td-meta">{fmtDate(p.created_at)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* 슬라이드 패널 */}
            {panelId && (
                <>
                    <div className="ar-panel-overlay" onClick={() => setPanelId(null)} />
                    <SlidePanel
                        key={panelId}
                        projectId={panelId}
                        currentUser={user}
                        onClose={() => setPanelId(null)}
                        onViewDetail={() => { setSelectedId(panelId); setPanelId(null); }}
                        onRefresh={fetchAll}
                    />
                </>
            )}
        </div>
    );
}
