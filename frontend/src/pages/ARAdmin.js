import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/authService';
import { useToast } from '../components/Toast';
import { IconPlus, IconTrash, IconEdit, IconX, IconCheck } from '../components/Icons';
import { CURRENCIES, CATEGORIES, STATUS_LABEL, STATUS_CLS, fmt, fmtDate, exportXLSX as _exportXLSX } from './arUtils';
import './ARAdmin.css';

function exportXLSX(project, expenses, monthly = [], byCategory = []) {
    return _exportXLSX(project, expenses, monthly, byCategory, { includeDept: true });
}

// ── 프로젝트 수정 모달 ─────────────────────────
function EditProjectModal({ project, departments, onClose, onSave }) {
    const toast = useToast();
    const [form, setForm] = useState({
        ar_code:       project.ar_code,
        title:         project.title,
        description:   project.description || '',
        budget_amount: project.budget_amount,
        currency:      project.currency,
        status:        project.status,
        team_dept_ids: (project.teamDepts || []).map(d => d.id),
    });
    const [saving, setSaving] = useState(false);

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
            // 프로젝트 기본 정보 수정
            await api.put(`/ar/projects/${project.id}`, {
                title: form.title, description: form.description,
                budget_amount: form.budget_amount,
                currency: form.currency, status: form.status,
            });
            // 팀 접근권한 재설정
            await api.put(`/ar/projects/${project.id}/teams`, { team_dept_ids: form.team_dept_ids });
            toast.success('수정됐습니다.');
            onSave();
        } catch (e) {
            toast.error(e.response?.data?.message || '수정 실패');
        } finally { setSaving(false); }
    };

    return (
        <div className="ara-overlay" onClick={onClose}>
            <div className="ara-modal" onClick={e => e.stopPropagation()}>
                <div className="ara-modal-header">
                    <h3>프로젝트 수정</h3>
                    <button onClick={onClose}><IconX size={16}/></button>
                </div>
                <div className="ara-modal-body">
                    <div className="ara-field-row">
                        <div className="ara-field-group" style={{ flex: 1 }}>
                            <label>AR 코드</label>
                            <input className="ara-input" value={form.ar_code}
                                onChange={e => setForm(f => ({ ...f, ar_code: e.target.value }))} />
                        </div>
                        <div className="ara-field-group" style={{ width: 130 }}>
                            <label>상태</label>
                            <select className="ara-select" value={form.status}
                                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                <option value="active">진행중</option>
                                <option value="on_hold">보류</option>
                                <option value="closed">완료</option>
                            </select>
                        </div>
                    </div>
                    <div className="ara-field-group">
                        <label>프로젝트명</label>
                        <input className="ara-input" value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div className="ara-field-row">
                        <div className="ara-field-group" style={{ flex: 1 }}>
                            <label>예산금액</label>
                            <div className="ara-amount-wrap">
                                <span className="ara-amount-sym">{CURRENCIES[form.currency]}</span>
                                <input className="ara-input ara-amount-input" placeholder="0"
                                    value={form.budget_amount ? Number(form.budget_amount).toLocaleString() : ''}
                                    onChange={e => setForm(f => ({ ...f, budget_amount: e.target.value.replace(/[^0-9]/g, '') }))} />
                            </div>
                        </div>
                        <div className="ara-field-group" style={{ width: 110 }}>
                            <label>통화</label>
                            <select className="ara-select" value={form.currency}
                                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                                {Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="ara-field-group">
                        <label>열람 허용 팀 <span className="ara-hint">(재경팀 자동 포함)</span></label>
                        <div className="ara-dept-grid">
                            {departments.map(d => (
                                <label key={d.id} className={`ara-dept-chip ${form.team_dept_ids.includes(d.id) ? 'selected' : ''}`}>
                                    <input type="checkbox" checked={form.team_dept_ids.includes(d.id)}
                                        onChange={() => toggleDept(d.id)} />
                                    {d.name}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="ara-field-group">
                        <label>프로젝트 내용</label>
                        <textarea className="ara-textarea" rows={3} value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                </div>
                <div className="ara-modal-footer">
                    <button className="ara-btn-cancel" onClick={onClose}>취소</button>
                    <button className="ara-btn-primary" onClick={handleSubmit} disabled={saving}>
                        <IconCheck size={14}/> {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 지출 수정 모달 ─────────────────────────────
function EditExpenseModal({ expense, currency, onClose, onSave }) {
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
        <div className="ara-overlay" onClick={onClose}>
            <div className="ara-modal" onClick={e => e.stopPropagation()}>
                <div className="ara-modal-header">
                    <h3>지출 수정</h3>
                    <button onClick={onClose}><IconX size={16}/></button>
                </div>
                <div className="ara-modal-body">
                    <div className="ara-field-row">
                        <div className="ara-field-group" style={{ flex: 1 }}>
                            <label>금액</label>
                            <div className="ara-amount-wrap">
                                <span className="ara-amount-sym">{CURRENCIES[currency] || '₩'}</span>
                                <input className="ara-input ara-amount-input" placeholder="0"
                                    value={form.amount ? Number(form.amount).toLocaleString() : ''}
                                    onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^0-9]/g, '') }))} />
                            </div>
                        </div>
                        <div className="ara-field-group" style={{ width: 140 }}>
                            <label>카테고리</label>
                            <select className="ara-select" value={form.category}
                                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="ara-field-group" style={{ width: 155 }}>
                            <label>지출일</label>
                            <input type="date" className="ara-input" value={form.spent_at} max={today}
                                onClick={e => e.currentTarget.showPicker?.()}
                                onChange={e => setForm(f => ({ ...f, spent_at: e.target.value }))} />
                        </div>
                    </div>
                    <div className="ara-field-group">
                        <label>내용</label>
                        <textarea className="ara-textarea" rows={3} value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                </div>
                <div className="ara-modal-footer">
                    <button className="ara-btn-cancel" onClick={onClose}>취소</button>
                    <button className="ara-btn-primary" onClick={handleSubmit} disabled={saving}>
                        <IconCheck size={14}/> {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const ACTION_LABEL = {
    PROJECT_CREATED:  '프로젝트 생성',
    PROJECT_UPDATED:  '프로젝트 수정',
    EXPENSE_ADDED:    '지출 등록',
    EXPENSE_UPDATED:  '지출 수정',
    EXPENSE_DELETED:  '지출 삭제',
    TEAMS_UPDATED:    '열람팀 변경',
};
const ACTION_CLS = {
    PROJECT_CREATED: 'create',
    PROJECT_UPDATED: 'update',
    EXPENSE_ADDED:   'add',
    EXPENSE_UPDATED: 'update',
    EXPENSE_DELETED: 'delete',
    TEAMS_UPDATED:   'update',
};

function fmtDatetime(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── 프로젝트 상세 (관리자 뷰) ──────────────────
function AdminProjectDetail({ projectId, onBack, departments }) {
    const toast = useToast();
    const [data, setData]           = useState(null);
    const [loading, setLoading]     = useState(true);
    const [editProject, setEditProject] = useState(false);
    const [editExpense, setEditExpense] = useState(null);
    const [logs, setLogs]           = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [showLogs, setShowLogs]   = useState(false);

    const fetchDetail = useCallback(async () => {
        try {
            const res = await api.get(`/ar/projects/${projectId}`);
            setData(res.data.data);
        } catch { toast.error('불러오기 실패'); }
        finally { setLoading(false); }
    }, [projectId]);

    const fetchLogs = useCallback(async () => {
        setLogsLoading(true);
        try {
            const res = await api.get(`/ar/projects/${projectId}/logs`);
            setLogs(res.data.data || []);
        } catch { toast.error('히스토리 불러오기 실패'); }
        finally { setLogsLoading(false); }
    }, [projectId]);

    useEffect(() => {
        if (showLogs && logs.length === 0) fetchLogs();
    }, [showLogs]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);


    const handleDeleteExpense = async (exp) => {
        if (!window.confirm(`지출을 삭제하시겠습니까?\n\n"${exp.description}" (${fmt(exp.amount)})\n\n이 작업은 되돌릴 수 없습니다.`)) return;
        try {
            await api.delete(`/ar/expenses/${exp.id}`);
            toast.success('삭제됐습니다.');
            fetchDetail();
        } catch (e) { toast.error(e.response?.data?.message || '삭제 실패'); }
    };

    if (loading) return <div className="ara-loading">로딩 중...</div>;
    if (!data) return null;

    const { project, expenses, teamDepts = [], monthly = [], byCategory = [] } = data;
    const spent  = Number(project.spent_amount);
    const budget = Number(project.budget_amount);
    const pct    = budget > 0 ? Math.min(100, Math.round(spent / budget * 100)) : 0;
    const isOver = spent > budget;

    return (
        <div className="ara-detail">
            {editProject && (
                <EditProjectModal
                    project={{ ...project, teamDepts }}
                    departments={departments}
                    onClose={() => setEditProject(false)}
                    onSave={() => { setEditProject(false); fetchDetail(); }} />
            )}
            {editExpense && (
                <EditExpenseModal expense={editExpense} currency={project.currency}
                    onClose={() => setEditExpense(null)}
                    onSave={() => { setEditExpense(null); fetchDetail(); }} />
            )}

            <div className="ara-detail-header">
                <div className="ara-header-left">
                    <button className="ara-back-btn" onClick={onBack}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        목록으로
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span className="ara-code-badge">{project.ar_code}</span>
                            <span className={`ara-status-badge ${STATUS_CLS[project.status]}`}>{STATUS_LABEL[project.status]}</span>
                        </div>
                        <h2 className="ara-detail-title">{project.title}</h2>
                        <div className="ara-detail-meta">PM: {project.creator_name} · {fmtDate(project.created_at)}</div>
                    </div>
                </div>
                <div className="ara-header-right">
                    {expenses.length > 0 && (
                        <button className="ara-btn-csv" onClick={() => exportXLSX(project, expenses, monthly, byCategory)}>
                            Excel 내보내기
                        </button>
                    )}
                    <button className="ara-btn-edit" onClick={() => setEditProject(true)}>
                        <IconEdit size={14}/> 프로젝트 수정
                    </button>
                </div>
            </div>

            {/* 예산 요약 */}
            <div className="ara-summary-row">
                {[
                    { label: '총 예산',  val: fmt(budget, project.currency), cls: 'blue' },
                    { label: '총 지출',  val: fmt(spent,  project.currency), cls: 'orange' },
                    { label: isOver ? '초과 금액' : '잔여 예산', val: fmt(Math.abs(budget - spent), project.currency), cls: isOver ? 'red' : 'green' },
                    { label: '집행률',   val: `${pct}%`, cls: 'purple' },
                ].map(({ label, val, cls }) => (
                    <div key={label} className={`ara-sum-card ${cls}`}>
                        <div className="ara-sum-label">{label}</div>
                        <div className="ara-sum-value">{val}</div>
                    </div>
                ))}
            </div>

            {/* 열람 팀 */}
            {teamDepts.length > 0 && (
                <div className="ara-card">
                    <div className="ara-section-title">열람 허용 팀</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span className="ara-team-tag finance">재경팀 (자동)</span>
                        {teamDepts.map(d => <span key={d.id} className="ara-team-tag">{d.name}</span>)}
                    </div>
                </div>
            )}

            {/* 활동 히스토리 */}
            <div className="ara-card">
                <div className="ara-section-title ara-section-title-collapsible" onClick={() => { setShowLogs(p => !p); if (!showLogs && logs.length === 0) fetchLogs(); }}>
                    <span>활동 히스토리</span>
                    <span className={`ara-collapse-arrow ${showLogs ? 'open' : ''}`}>›</span>
                </div>
                {showLogs && (
                    logsLoading ? (
                        <div className="ara-empty">로딩 중...</div>
                    ) : logs.length === 0 ? (
                        <div className="ara-empty">기록이 없습니다.</div>
                    ) : (
                        <div className="ara-log-timeline">
                            {logs.map(log => (
                                <div key={log.id} className={`ara-log-item ${ACTION_CLS[log.action] || 'update'}`}>
                                    <div className="ara-log-dot" />
                                    <div className="ara-log-body">
                                        <div className="ara-log-header">
                                            <span className={`ara-log-badge ${ACTION_CLS[log.action] || 'update'}`}>
                                                {ACTION_LABEL[log.action] || log.action}
                                            </span>
                                            <span className="ara-log-user">{log.user_name}</span>
                                            {log.dept_name && <span className="ara-log-dept">{log.dept_name}</span>}
                                            <span className="ara-log-time">{fmtDatetime(log.created_at)}</span>
                                        </div>
                                        {log.detail && <div className="ara-log-detail">{log.detail}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* 지출 내역 */}
            <div className="ara-card">
                <div className="ara-section-title">지출 내역 ({expenses.length}건)</div>
                {expenses.length === 0 ? (
                    <div className="ara-empty">등록된 지출이 없습니다.</div>
                ) : (
                    <table className="ara-table">
                        <thead>
                            <tr>
                                <th>날짜</th>
                                <th>내용</th>
                                <th>카테고리</th>
                                <th>등록자</th>
                                <th style={{ textAlign: 'right' }}>금액</th>
                                <th style={{ width: 80 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map(exp => (
                                <tr key={exp.id}>
                                    <td className="ara-td-date">{fmtDate(exp.spent_at)}</td>
                                    <td>{exp.description}</td>
                                    <td><span className="ara-cat-badge">{exp.category || '기타'}</span></td>
                                    <td className="ara-td-user">{exp.user_name}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(exp.amount, project.currency)}</td>
                                    <td>
                                        <div className="ara-row-actions">
                                            <button className="ara-icon-btn edit" onClick={() => setEditExpense(exp)} title="수정">
                                                <IconEdit size={13}/>
                                            </button>
                                            <button className="ara-icon-btn del" onClick={() => handleDeleteExpense(exp)} title="삭제">
                                                <IconTrash size={13}/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, padding: '12px 14px' }}>합계</td>
                                <td style={{ textAlign: 'right', fontWeight: 800, padding: '12px 14px' }}>{fmt(spent, project.currency)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
        </div>
    );
}

// ── 메인 AR 관리 페이지 ────────────────────────
export default function ARAdmin() {
    const toast = useToast();
    const [projects, setProjects]   = useState([]);
    const [departments, setDepts]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [search, setSearch]       = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchAll = useCallback(async () => {
        try {
            const [pRes, dRes] = await Promise.all([
                api.get('/ar/projects'),
                api.get('/ar/departments'),
            ]);
            setProjects(pRes.data.data);
            setDepts(dRes.data.data);
        } catch { toast.error('불러오기 실패'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleDeleteProject = async (e, p) => {
        e.stopPropagation();
        if (!window.confirm(`프로젝트를 삭제하시겠습니까?\n\n"[${p.ar_code}] ${p.title}"\n\n지출 내역 전체가 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`)) return;
        try {
            await api.delete(`/ar/projects/${p.id}`);
            toast.success('삭제됐습니다.');
            fetchAll();
        } catch (e) { toast.error(e.response?.data?.message || '삭제 실패'); }
    };

    if (selectedId) {
        return <AdminProjectDetail
            projectId={selectedId}
            departments={departments}
            onBack={() => { setSelectedId(null); fetchAll(); }} />;
    }

    const filtered = projects.filter(p => {
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (search && !p.ar_code.includes(search) && !p.title.includes(search) && !(p.creator_name || '').includes(search)) return false;
        return true;
    });

    return (
        <div className="ara-page">
            <div className="ara-page-header">
                <div>
                    <h1 className="ara-page-title">AR 관리</h1>
                    <p className="ara-page-sub">모든 AR 프로젝트 및 지출 내역 관리</p>
                </div>
                <div className="ara-toolbar">
                    <input className="ara-search" placeholder="AR 코드 / 프로젝트명 / PM 검색"
                        value={search} onChange={e => setSearch(e.target.value)} />
                    <select className="ara-select-filter" value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}>
                        <option value="all">전체 상태</option>
                        <option value="active">진행중</option>
                        <option value="on_hold">보류</option>
                        <option value="closed">완료</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="ara-loading">로딩 중...</div>
            ) : (
                <div className="ara-card">
                    <table className="ara-table">
                        <thead>
                            <tr>
                                <th>AR 코드</th>
                                <th>프로젝트명</th>
                                <th>PM</th>
                                <th>상태</th>
                                <th style={{ textAlign: 'right' }}>예산</th>
                                <th style={{ textAlign: 'right' }}>지출</th>
                                <th style={{ textAlign: 'right' }}>집행률</th>
                                <th style={{ width: 80 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={8} className="ara-empty">프로젝트가 없습니다.</td></tr>
                            ) : filtered.map(p => {
                                const spent  = Number(p.spent_amount);
                                const budget = Number(p.budget_amount);
                                const pct    = budget > 0 ? Math.min(100, Math.round(spent / budget * 100)) : 0;
                                const isOver = spent > budget;
                                return (
                                    <tr key={p.id} className="ara-row" onClick={() => setSelectedId(p.id)}>
                                        <td><span className="ara-code-badge">{p.ar_code}</span></td>
                                        <td className="ara-td-title">{p.title}</td>
                                        <td className="ara-td-meta">{p.creator_name}</td>
                                        <td><span className={`ara-status-badge ${STATUS_CLS[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                                        <td style={{ textAlign: 'right' }}>{fmt(budget, p.currency)}</td>
                                        <td style={{ textAlign: 'right', color: isOver ? '#e53e3e' : undefined }}>{fmt(spent, p.currency)}</td>
                                        <td style={{ minWidth: 120 }}>
                                            <div className="ara-pct-wrap">
                                                <div className="ara-mini-bar">
                                                    <div className={`ara-mini-fill ${isOver ? 'over' : pct > 80 ? 'warn' : ''}`}
                                                        style={{ width: `${Math.min(pct, 100)}%` }} />
                                                </div>
                                                <span className={`ara-pct-label ${isOver ? 'over' : pct > 80 ? 'warn' : ''}`}>{pct}%</span>
                                            </div>
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div className="ara-row-actions">
                                                <button className="ara-icon-btn edit" onClick={() => setSelectedId(p.id)} title="상세/수정">
                                                    <IconEdit size={13}/>
                                                </button>
                                                <button className="ara-icon-btn del" onClick={(e) => handleDeleteProject(e, p)} title="삭제">
                                                    <IconTrash size={13}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
