import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/authService';
import './ApprovalAdmin.css';
import { useToast } from '../components/Toast';

// ============================================
// 서브 컴포넌트들
// ============================================

// 카테고리 관리
function CategoryManager() {
    const toast = useToast();
    const [categories, setCategories] = useState([]);
    const [editing, setEditing] = useState(null);
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchCategories(); }, []);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/approval/admin/categories');
            setCategories(res.data.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleAdd = async () => {
        if (!newName.trim()) return;
        try {
            await api.post('/approval/admin/categories', { name: newName });
            setNewName('');
            fetchCategories();
        } catch (e) { toast.error('추가 실패'); }
    };

    const handleUpdate = async (id) => {
        if (!editing.name.trim()) return;
        try {
            await api.put(`/approval/admin/categories/${id}`, { name: editing.name });
            setEditing(null);
            fetchCategories();
        } catch (e) { toast.error('수정 실패'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        try {
            await api.delete(`/approval/admin/categories/${id}`);
            fetchCategories();
        } catch (e) { toast.error(e.response?.data?.message || '삭제 실패'); }
    };

    const handleReorder = async (id, direction) => {
        const idx = categories.findIndex(c => c.id === id);
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === categories.length - 1) return;
        const newCats = [...categories];
        const swap = direction === 'up' ? idx - 1 : idx + 1;
        [newCats[idx], newCats[swap]] = [newCats[swap], newCats[idx]];
        setCategories(newCats);
        try {
            await api.put('/approval/admin/categories/reorder', {
                order: newCats.map((c, i) => ({ id: c.id, order_no: i + 1 }))
            });
        } catch (e) { fetchCategories(); }
    };

    if (loading) return <div className="aa-loading">로딩 중...</div>;

    return (
        <div className="aa-section">
            <div className="aa-section-header">
                <h2>카테고리 관리</h2>
                <p>서식을 분류하는 카테고리를 관리합니다.</p>
            </div>

            <div className="aa-add-row">
                <input
                    type="text"
                    placeholder="새 카테고리명 입력"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <button className="aa-btn-primary" onClick={handleAdd}>추가</button>
            </div>

            <div className="aa-table-wrap">
                <table className="aa-table">
                    <thead>
                        <tr>
                            <th style={{width:60}}>순서</th>
                            <th>카테고리명</th>
                            <th style={{width:100}}>서식 수</th>
                            <th style={{width:80}}>상태</th>
                            <th style={{width:160}}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((cat, idx) => (
                            <tr key={cat.id}>
                                <td>
                                    <div className="aa-order-btns">
                                        <button onClick={() => handleReorder(cat.id, 'up')} disabled={idx === 0}>▲</button>
                                        <button onClick={() => handleReorder(cat.id, 'down')} disabled={idx === categories.length - 1}>▼</button>
                                    </div>
                                </td>
                                <td>
                                    {editing?.id === cat.id ? (
                                        <input
                                            className="aa-inline-input"
                                            value={editing.name}
                                            onChange={e => setEditing({ ...editing, name: e.target.value })}
                                            onKeyDown={e => e.key === 'Enter' && handleUpdate(cat.id)}
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="aa-cat-name">{cat.name}</span>
                                    )}
                                </td>
                                <td className="aa-center">{cat.template_count || 0}개</td>
                                <td className="aa-center">
                                    <span className={`aa-badge ${cat.is_active ? 'active' : 'inactive'}`}>
                                        {cat.is_active ? '활성' : '비활성'}
                                    </span>
                                </td>
                                <td>
                                    <div className="aa-action-btns">
                                        {editing?.id === cat.id ? (
                                            <>
                                                <button className="aa-btn-sm save" onClick={() => handleUpdate(cat.id)}>저장</button>
                                                <button className="aa-btn-sm cancel" onClick={() => setEditing(null)}>취소</button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="aa-btn-sm edit" onClick={() => setEditing({ id: cat.id, name: cat.name })}>수정</button>
                                                <button className="aa-btn-sm delete" onClick={() => handleDelete(cat.id)}>삭제</button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {categories.length === 0 && (
                            <tr><td colSpan={5} className="aa-empty">카테고리가 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ============================================
// 서식 관리 - 네이버웍스 스타일 (4단계 탭)
// ============================================

// ─── Step 1: 기본 설정 ─────────────────────
function TemplateStep1({ form, setForm, categories }) {
    return (
        <div className="tm-step-content">
            <div className="tm-section">
                <div className="tm-form-row">
                    <label className="tm-label">카테고리 <span className="tm-required">*</span></label>
                    <select
                        className="tm-select"
                        value={form.category_id}
                        onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    >
                        <option value="">선택</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="tm-form-row">
                    <label className="tm-label">서식명 <span className="tm-required">*</span></label>
                    <div className="tm-input-wrap">
                        <input
                            className="tm-input"
                            type="text"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="서식명을 입력하세요"
                        />
                    </div>
                </div>
                <div className="tm-form-row">
                    <label className="tm-label">서식 하단 설명 영역</label>
                    <div className="tm-desc-area">
                        <label className="tm-checkbox-label">
                            <input
                                type="checkbox"
                                checked={form.has_description}
                                onChange={e => setForm(f => ({ ...f, has_description: e.target.checked }))}
                            />
                            기본으로 제공될 서식 하단 설명 작성
                        </label>
                        {form.has_description && (
                            <textarea
                                className="tm-textarea"
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="서식 하단에 표시될 설명을 입력하세요"
                                rows={6}
                            />
                        )}
                    </div>
                </div>
                <div className="tm-form-row">
                    <label className="tm-label">결재 규정</label>
                    <textarea
                        className="tm-textarea"
                        value={form.regulation || ''}
                        onChange={e => setForm(f => ({ ...f, regulation: e.target.value }))}
                        placeholder={"예) 본 서식은 팀장 이상 결재가 필요합니다.\n- 10만원 미만: 팀장 전결\n- 10만원 이상: 본부장 결재"}
                        rows={6}
                    />
                </div>
            </div>

            {/* 결재 명칭 */}
            <div className="tm-section">
                <div className="tm-section-title">결재 명칭</div>
                <div className="tm-form-row">
                    <label className="tm-label">결재 구분</label>
                    <div className="tm-radio-group">
                        {[
                            { key: 'approval_name', options: ['결재','일반 결재','동의','일반','승인'], label: '결재' },
                            { key: 'ref_name', options: ['참조','참조 결재','자동 동의','통보','검토'], label: '참조' },
                            { key: 'agree_name', options: ['합의','합의 결재','협조'], label: '합의' },
                            { key: 'parallel_name', options: ['병렬 결재','병렬 동의','병렬 일반'], label: '병렬 결재' },
                            { key: 'parallel_agree_name', options: ['병렬 합의','병렬 협조'], label: '병렬 합의' },
                        ].map(row => (
                            <div key={row.key} className="tm-approval-row">
                                <span className="tm-approval-label">{row.label}</span>
                                <div className="tm-radios">
                                    {row.options.map(opt => (
                                        <label key={opt} className="tm-radio-label">
                                            <input
                                                type="radio"
                                                name={row.key}
                                                value={opt}
                                                checked={(form[row.key] || row.options[0]) === opt}
                                                onChange={() => setForm(f => ({ ...f, [row.key]: opt }))}
                                            />
                                            {opt}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 폼 필드 */}
            <div className="tm-section">
                <div className="tm-section-title">폼 필드 구성</div>
                <FieldBuilder form={form} setForm={setForm} />
            </div>
        </div>
    );
}

// 폼 필드 빌더
function FieldBuilder({ form, setForm }) {
    const toast = useToast();
    const [newField, setNewField] = useState({ key: '', label: '', type: 'text', required: false });
    const fieldTypeLabel = { text: '텍스트', textarea: '장문', number: '숫자', date: '날짜', time: '시간', select: '선택' };

    const addField = () => {
        if (!newField.key || !newField.label) { toast.warning('키와 라벨을 입력해주세요.'); return; }
        setForm(f => ({ ...f, form_fields: [...f.form_fields, { ...newField }] }));
        setNewField({ key: '', label: '', type: 'text', required: false });
    };

    const removeField = (idx) => {
        setForm(f => ({ ...f, form_fields: f.form_fields.filter((_, i) => i !== idx) }));
    };

    return (
        <div className="tm-field-builder">
            <div className="tm-field-list">
                {form.form_fields.map((field, idx) => (
                    <div key={idx} className="tm-field-item">
                        <span className="tm-field-label">{field.label}</span>
                        <span className="tm-field-key">({field.key})</span>
                        <span className="tm-field-type-badge">{fieldTypeLabel[field.type] || field.type}</span>
                        {field.required && <span className="tm-field-required">필수</span>}
                        <button className="tm-field-del" onClick={() => removeField(idx)}>✕</button>
                    </div>
                ))}
                {form.form_fields.length === 0 && (
                    <div className="tm-field-empty">추가된 필드가 없습니다.</div>
                )}
            </div>
            <div className="tm-field-add-row">
                <input type="text" placeholder="키 (영문, 예: reason)" value={newField.key}
                    onChange={e => setNewField(f => ({ ...f, key: e.target.value }))} className="tm-input sm" />
                <input type="text" placeholder="라벨 (예: 신청 사유)" value={newField.label}
                    onChange={e => setNewField(f => ({ ...f, label: e.target.value }))} className="tm-input sm" />
                <select value={newField.type} onChange={e => setNewField(f => ({ ...f, type: e.target.value }))} className="tm-select sm">
                    <option value="text">텍스트</option>
                    <option value="textarea">장문</option>
                    <option value="number">숫자</option>
                    <option value="date">날짜</option>
                    <option value="time">시간</option>
                    <option value="select">선택</option>
                </select>
                <label className="tm-checkbox-label">
                    <input type="checkbox" checked={newField.required}
                        onChange={e => setNewField(f => ({ ...f, required: e.target.checked }))} />
                    필수
                </label>
                <button className="tm-btn-add" onClick={addField}>+ 추가</button>
            </div>
        </div>
    );
}

// ─── 결재선 편집 모달 ─────────────────────────
function ApprovalLineEditModal({ line, users, departments, onClose, onSave }) {
    // line = { id, label, approvers: [{user_id, role, dept_id, type}] }
    const ROLES = [
        { value: 'approver', label: '결재' },
        { value: 'agree', label: '합의' },
        { value: 'ref', label: '참조' },
    ];
    const [label, setLabel] = useState(line?.label || '기본');
    const [approvers, setApprovers] = useState(line?.approvers || []);
    const [userQuery, setUserQuery] = useState('');
    const [userDropOpen, setUserDropOpen] = useState(false);
    const [pendingRole, setPendingRole] = useState('approver');
    const [pendingType, setPendingType] = useState('user'); // 'user' | 'dept_head'

    const filteredUsers = users.filter(u =>
        !userQuery ||
        u.name.includes(userQuery) ||
        (u.department_name || '').includes(userQuery)
    );

    const addApprover = (u) => {
        if (approvers.find(a => a.user_id === u.id)) return;
        setApprovers(prev => [...prev, {
            user_id: u.id,
            name: u.name,
            dept: u.department_name || '',
            role: pendingRole,
            type: pendingType,
        }]);
        setUserQuery('');
        setUserDropOpen(false);
    };

    const addDeptHead = () => {
        setApprovers(prev => [...prev, {
            user_id: null,
            name: '부서장',
            dept: '',
            role: pendingRole,
            type: 'dept_head',
            auto: true,
        }]);
    };

    const removeApprover = (idx) => setApprovers(prev => prev.filter((_, i) => i !== idx));

    const moveApprover = (idx, dir) => {
        const arr = [...approvers];
        const swap = idx + dir;
        if (swap < 0 || swap >= arr.length) return;
        [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
        setApprovers(arr);
    };

    const roleLabel = { approver: '결재', agree: '합의', ref: '참조' };
    const roleColor = { approver: '#667eea', agree: '#f5a623', ref: '#4ecdc4' };

    return (
        <>
            <div className="aline-overlay" onClick={onClose} />
            <div className="aline-modal">
                <div className="aline-header">
                    <span className="aline-title">결재선 설정</span>
                    <button className="exc-close-btn" onClick={onClose}>✕</button>
                </div>
                <div className="aline-body">
                    {/* 결재선 이름 */}
                    <div className="aline-row">
                        <label className="aline-label">결재선 이름</label>
                        <input className="tm-input" style={{width:200}} value={label}
                            onChange={e => setLabel(e.target.value)} placeholder="예: 기본, 팀장 결재" />
                    </div>

                    {/* 결재자 유형 선택 */}
                    <div className="aline-row">
                        <label className="aline-label">결재 구분</label>
                        <div className="tm-radios">
                            {ROLES.map(r => (
                                <label key={r.value} className="tm-radio-label">
                                    <input type="radio" name="aline_role" value={r.value}
                                        checked={pendingRole === r.value}
                                        onChange={() => setPendingRole(r.value)} />
                                    {r.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 결재자 추가 */}
                    <div className="aline-row">
                        <label className="aline-label">결재자 추가</label>
                        <div className="aline-add-area">
                            <div className="exc-user-search" style={{flex:1}}>
                                <input className="exc-search-input" type="text"
                                    placeholder="사원명 또는 부서명 검색"
                                    value={userQuery}
                                    onChange={e => { setUserQuery(e.target.value); setUserDropOpen(true); }}
                                    onFocus={() => setUserDropOpen(true)}
                                    onBlur={() => setTimeout(() => setUserDropOpen(false), 150)} />
                                <span className="exc-search-icon">🔍</span>
                                {userDropOpen && (
                                    <div className="exc-dropdown">
                                        {filteredUsers.slice(0, 8).map(u => (
                                            <div key={u.id} className="exc-dropdown-item"
                                                onMouseDown={() => addApprover(u)}>
                                                <span className="exc-user-avatar sm">{u.name.charAt(0)}</span>
                                                <span className="exc-user-name">{u.name}</span>
                                                <span className="exc-user-dept">{u.department_name || '-'}</span>
                                            </div>
                                        ))}
                                        {filteredUsers.length === 0 && (
                                            <div className="exc-dropdown-empty">검색 결과 없음</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button className="aline-btn-dept" onClick={addDeptHead}>+ 부서장 자동</button>
                        </div>
                    </div>

                    {/* 결재선 목록 */}
                    <div className="aline-list-wrap">
                        <div className="aline-list-head">
                            <span style={{width:40}}>순서</span>
                            <span style={{flex:1}}>결재자</span>
                            <span style={{width:60}}>구분</span>
                            <span style={{width:80}}>이동</span>
                            <span style={{width:40}}>삭제</span>
                        </div>
                        {approvers.length === 0 ? (
                            <div className="aline-empty">결재자가 없습니다.</div>
                        ) : approvers.map((a, idx) => (
                            <div key={idx} className="aline-list-row">
                                <span className="aline-order">{idx + 1}</span>
                                <div className="exc-user-cell" style={{flex:1}}>
                                    <span className="exc-user-avatar sm"
                                        style={{background: a.auto ? '#4ecdc4' : 'linear-gradient(135deg,#667eea,#764ba2)'}}>
                                        {a.auto ? '부' : a.name.charAt(0)}
                                    </span>
                                    <span className="exc-user-name">{a.name}</span>
                                    {a.dept && <span className="exc-user-dept">{a.dept}</span>}
                                </div>
                                <span className="aline-role-badge"
                                    style={{background: (roleColor[a.role] || '#999') + '22', color: roleColor[a.role] || '#999'}}>
                                    {roleLabel[a.role] || a.role}
                                </span>
                                <div className="aline-move-btns">
                                    <button onClick={() => moveApprover(idx, -1)} disabled={idx === 0}>▲</button>
                                    <button onClick={() => moveApprover(idx, 1)} disabled={idx === approvers.length - 1}>▼</button>
                                </div>
                                <button className="tm-field-del" onClick={() => removeApprover(idx)}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="aline-footer">
                    <button className="exc-btn-cancel" onClick={onClose}>취소</button>
                    <button className="exc-btn-save" onClick={() => onSave({ label, approvers })}>저장</button>
                </div>
            </div>
        </>
    );
}

// ─── Step 2: 결재선 설정 ───────────────────
function TemplateStep2({ form, setForm }) {
    const toast = useToast();
    const [editingLine, setEditingLine] = useState(null); // null | { idx, line }
    const [users, setUsers] = useState([]);

    useEffect(() => {
        api.get('/users').then(res => setUsers(res.data.data.users || [])).catch(() => {});
    }, []);

    const approvalLines = form.approval_lines || [{ id: 'default', label: '기본', approvers: [] }];

    const openEdit = (idx) => setEditingLine({ idx, line: approvalLines[idx] });

    const handleLineSave = ({ label, approvers }) => {
        const lines = [...approvalLines];
        lines[editingLine.idx] = { ...lines[editingLine.idx], label, approvers };
        setForm(f => ({ ...f, approval_lines: lines }));
        setEditingLine(null);
    };

    const addLine = (type) => {
        const id = `line_${Date.now()}`;
        const lines = [...approvalLines, { id, label: type === 'conditional' ? '조건부' : '결재선 ' + approvalLines.length, approvers: [], conditional: type === 'conditional' }];
        setForm(f => ({ ...f, approval_lines: lines }));
    };

    const removeLine = (idx) => {
        if (approvalLines.length <= 1) { toast.warning('최소 1개의 결재선이 필요합니다.'); return; }
        const lines = approvalLines.filter((_, i) => i !== idx);
        setForm(f => ({ ...f, approval_lines: lines }));
    };

    const roleColor = { approver: '#667eea', agree: '#f5a623', ref: '#4ecdc4' };
    const roleLabel = { approver: '결재', agree: '합의', ref: '참조' };

    return (
        <div className="tm-step-content">
            <div className="tm-section">
                <div className="tm-section-title">결재선 설정</div>
                <div className="tm-form-row">
                    <label className="tm-label">결재선 필수 여부</label>
                    <label className="tm-checkbox-label">
                        <input type="checkbox"
                            checked={form.approval_line_required || false}
                            onChange={e => setForm(f => ({ ...f, approval_line_required: e.target.checked }))}
                        /> 필수
                    </label>
                </div>
                <div className="tm-form-row">
                    <label className="tm-label">관리자가 결재선 설정</label>
                    <div className="tm-toggle-wrap">
                        <button
                            className={`tm-toggle ${form.admin_approval_line ? 'on' : ''}`}
                            onClick={() => setForm(f => ({ ...f, admin_approval_line: !f.admin_approval_line }))}
                        >
                            <span className="tm-toggle-knob" />
                        </button>
                    </div>
                </div>

                {/* ▼ 관리자 결재선 설정 ON 시 */}
                {form.admin_approval_line && (
                    <div className="aline-editor-area">
                        <div className="tm-form-row">
                            <label className="tm-label">기본 결재선</label>
                            <div className="tm-toggle-wrap">
                                <button
                                    className={`tm-toggle ${form.default_line_enabled !== false ? 'on' : ''}`}
                                    onClick={() => setForm(f => ({ ...f, default_line_enabled: !(f.default_line_enabled !== false) }))}
                                >
                                    <span className="tm-toggle-knob" />
                                </button>
                            </div>
                        </div>
                        <div className="tm-form-row">
                            <label className="tm-label">조건별 결재선</label>
                            <div className="tm-toggle-wrap">
                                <button
                                    className={`tm-toggle ${form.conditional_line_enabled ? 'on' : ''}`}
                                    onClick={() => setForm(f => ({ ...f, conditional_line_enabled: !f.conditional_line_enabled }))}
                                >
                                    <span className="tm-toggle-knob" />
                                </button>
                            </div>
                        </div>

                        {/* 결재선 추가 버튼 */}
                        <div className="aline-add-btns">
                            <button className="aline-tab-btn active" onClick={() => addLine('default')}>기본 결재선 추가</button>
                            <button className={`aline-tab-btn ${form.conditional_line_enabled ? '' : 'disabled'}`}
                                disabled={!form.conditional_line_enabled}
                                onClick={() => addLine('conditional')}>조건별 결재선 추가</button>
                        </div>

                        {/* 결재선 목록 테이블 */}
                        <div className="aline-lines-table">
                            <div className="aline-lines-head">
                                <span style={{width:100}}>적용 순서</span>
                                <span style={{flex:1}}>결재선</span>
                                <span style={{width:60}}>수정</span>
                                <span style={{width:60}}>삭제</span>
                            </div>
                            {approvalLines.map((line, idx) => (
                                <div key={line.id || idx} className="aline-lines-row">
                                    <span className="aline-line-label">{line.label || '기본'}</span>
                                    <div className="aline-approvers-preview" style={{flex:1}}>
                                        {line.approvers.length === 0 ? (
                                            <span className="aline-no-approver">결재자가 없습니다.</span>
                                        ) : line.approvers.map((a, ai) => (
                                            <span key={ai} className="aline-approver-chip">
                                                <span className="aline-chip-dot"
                                                    style={{background: roleColor[a.role] || '#999'}} />
                                                {a.name}
                                                <span className="aline-chip-role"
                                                    style={{color: roleColor[a.role] || '#999'}}>
                                                    {roleLabel[a.role] || ''}
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                    <button className="aline-edit-btn" onClick={() => openEdit(idx)}>수정</button>
                                    <button className="aline-del-btn" onClick={() => removeLine(idx)}>삭제</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="tm-form-row">
                    <label className="tm-label">결재선 변경 허용</label>
                    <div className="tm-radios">
                        <label className="tm-radio-label">
                            <input type="radio" name="line_change" value="allow"
                                checked={form.approval_line_changeable !== false}
                                onChange={() => setForm(f => ({ ...f, approval_line_changeable: true }))} />
                            허용
                        </label>
                        <label className="tm-radio-label">
                            <input type="radio" name="line_change" value="deny"
                                checked={form.approval_line_changeable === false}
                                onChange={() => setForm(f => ({ ...f, approval_line_changeable: false }))} />
                            허용 안 함
                        </label>
                    </div>
                </div>
                <div className="tm-form-row">
                    <label className="tm-label">추가 설정</label>
                    <label className="tm-checkbox-label">
                        <input type="checkbox"
                            checked={form.skip_no_superior || false}
                            onChange={e => setForm(f => ({ ...f, skip_no_superior: e.target.checked }))}
                        /> 상위 부서장이 없는 경우 생략
                    </label>
                </div>
            </div>

            <div className="tm-section">
                <div className="tm-section-title">전결 관리</div>
                <div className="tm-form-row">
                    <label className="tm-label">전결 사용 여부</label>
                    <div className="tm-radios">
                        <label className="tm-radio-label">
                            <input type="radio" name="predecision" value="use"
                                checked={form.predecision_enabled || false}
                                onChange={() => setForm(f => ({ ...f, predecision_enabled: true }))} />
                            사용
                        </label>
                        <label className="tm-radio-label">
                            <input type="radio" name="predecision" value="nouse"
                                checked={!form.predecision_enabled}
                                onChange={() => setForm(f => ({ ...f, predecision_enabled: false }))} />
                            사용 안함
                        </label>
                    </div>
                </div>
            </div>

            {/* 결재선 편집 모달 */}
            {editingLine && (
                <ApprovalLineEditModal
                    line={editingLine.line}
                    users={users}
                    onClose={() => setEditingLine(null)}
                    onSave={handleLineSave}
                />
            )}
        </div>
    );
}

// ─── Step 3: 수신·공유 설정 ────────────────
function TemplateStep3({ form, setForm }) {
    const [newReceiver, setNewReceiver] = useState('');
    const [newShare, setNewShare] = useState('');

    const addReceiver = () => {
        if (!newReceiver.trim()) return;
        setForm(f => ({ ...f, receivers: [...(f.receivers || []), newReceiver.trim()] }));
        setNewReceiver('');
    };

    const addShare = () => {
        if (!newShare.trim()) return;
        setForm(f => ({ ...f, share_targets: [...(f.share_targets || []), newShare.trim()] }));
        setNewShare('');
    };

    return (
        <div className="tm-step-content">
            <div className="tm-section">
                <div className="tm-section-title">수신 관리</div>
                <div className="tm-form-row">
                    <label className="tm-label">수신 사용 여부</label>
                    <div className="tm-radios">
                        {['사용','사용 안함'].map(v => (
                            <label key={v} className="tm-radio-label">
                                <input type="radio" name="recv_use" value={v}
                                    checked={v === '사용' ? form.receiver_enabled !== false : form.receiver_enabled === false}
                                    onChange={() => setForm(f => ({ ...f, receiver_enabled: v === '사용' }))} />
                                {v}
                            </label>
                        ))}
                    </div>
                </div>
                <div className="tm-form-row">
                    <label className="tm-label">수신 시점</label>
                    <div className="tm-radios">
                        {['문서 작성 시점부터 수신','완료된 후 수신'].map(v => (
                            <label key={v} className="tm-radio-label">
                                <input type="radio" name="recv_timing" value={v}
                                    checked={(form.receiver_timing || '문서 작성 시점부터 수신') === v}
                                    onChange={() => setForm(f => ({ ...f, receiver_timing: v }))} />
                                {v}
                            </label>
                        ))}
                    </div>
                </div>
                <div className="tm-form-row">
                    <label className="tm-label">수신 대상</label>
                    <div className="tm-target-area">
                        <button className="tm-btn-secondary" onClick={addReceiver}>수신 대상 추가</button>
                        {(form.receivers || []).length > 0 && (
                            <div className="tm-target-table">
                                <div className="tm-target-head"><span>대상</span><span>삭제</span></div>
                                {(form.receivers || []).map((r, i) => (
                                    <div key={i} className="tm-target-row">
                                        <span>{r}</span>
                                        <button onClick={() => setForm(f => ({ ...f, receivers: f.receivers.filter((_, j) => j !== i) }))}>🗑</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="tm-form-row">
                    <label className="tm-label">수신 대상 변경 허용</label>
                    <div className="tm-radios">
                        {['허용','허용 안 함'].map(v => (
                            <label key={v} className="tm-radio-label">
                                <input type="radio" name="recv_change" value={v}
                                    checked={v === '허용' ? form.receiver_changeable !== false : form.receiver_changeable === false}
                                    onChange={() => setForm(f => ({ ...f, receiver_changeable: v === '허용' }))} />
                                {v}
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            <div className="tm-section">
                <div className="tm-section-title">공유 관리</div>
                <div className="tm-form-row">
                    <label className="tm-label">공유 범위</label>
                    <div className="tm-radios">
                        {['전체 공유','일부 공유'].map(v => (
                            <label key={v} className="tm-radio-label">
                                <input type="radio" name="share_range" value={v}
                                    checked={(form.share_range || '일부 공유') === v}
                                    onChange={() => setForm(f => ({ ...f, share_range: v }))} />
                                {v}
                            </label>
                        ))}
                    </div>
                </div>
                <div className="tm-form-row">
                    <label className="tm-label">공유 시점</label>
                    <div className="tm-radios">
                        {['문서 작성 시점부터 공유','완료된 후 공유'].map(v => (
                            <label key={v} className="tm-radio-label">
                                <input type="radio" name="share_timing" value={v}
                                    checked={(form.share_timing || '완료된 후 공유') === v}
                                    onChange={() => setForm(f => ({ ...f, share_timing: v }))} />
                                {v}
                            </label>
                        ))}
                    </div>
                </div>
                <div className="tm-form-row">
                    <label className="tm-label">공유 대상</label>
                    <div className="tm-target-area">
                        <button className="tm-btn-secondary" onClick={addShare}>공유 대상 추가</button>
                        {(form.share_targets || []).length > 0 && (
                            <div className="tm-target-table">
                                <div className="tm-target-head"><span>대상</span><span>삭제</span></div>
                                {(form.share_targets || []).map((s, i) => (
                                    <div key={i} className="tm-target-row">
                                        <span>{s}</span>
                                        <button onClick={() => setForm(f => ({ ...f, share_targets: f.share_targets.filter((_, j) => j !== i) }))}>🗑</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="tm-form-row">
                    <label className="tm-label">공유 대상 변경 허용</label>
                    <div className="tm-radios">
                        {['허용','허용 안 함'].map(v => (
                            <label key={v} className="tm-radio-label">
                                <input type="radio" name="share_change" value={v}
                                    checked={v === '허용' ? form.share_changeable !== false : form.share_changeable === false}
                                    onChange={() => setForm(f => ({ ...f, share_changeable: v === '허용' }))} />
                                {v}
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Step 4: 권한 설정 ─────────────────────
function TemplateStep4({ form, setForm }) {
    const [newViewTarget, setNewViewTarget] = useState('');

    return (
        <div className="tm-step-content">
            <div className="tm-section">
                <div className="tm-form-row">
                    <label className="tm-label">작성 권한</label>
                    <span className="tm-text-muted">서비스 권한자</span>
                </div>
                <div className="tm-form-row">
                    <label className="tm-label">열람 권한</label>
                    <div className="tm-target-area">
                        <button className="tm-btn-secondary" onClick={() => {
                            const val = prompt('열람 권한 대상을 입력하세요');
                            if (val) setForm(f => ({ ...f, view_targets: [...(f.view_targets || []), val.trim()] }));
                        }}>열람 권한 추가</button>
                        {(form.view_targets || []).length > 0 && (
                            <div className="tm-target-table">
                                <div className="tm-target-head"><span>대상</span><span>삭제</span></div>
                                {(form.view_targets || []).map((v, i) => (
                                    <div key={i} className="tm-target-row">
                                        <span>{v}</span>
                                        <button onClick={() => setForm(f => ({ ...f, view_targets: f.view_targets.filter((_, j) => j !== i) }))}>🗑</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── 서식 편집 페이지 (4단계 탭) ──────────
function TemplateEditor({ template, categories, onBack, onSave }) {
    const toast = useToast();
    const STEPS = ['기본 설정', '결재선 설정']; // 수신·공유·권한 설정은 추후 구현
    const [step, setStep] = useState(0);
    const [form, setForm] = useState(() => {
        const sp = (v, fb = []) => {
            if (!v) return fb;
            if (typeof v === 'object') return v;
            try { return JSON.parse(v); } catch { return fb; }
        };
        if (template) {
            return {
                name: template.name,
                category_id: template.category_id,
                description: template.description || '',
                has_description: !!(template.description),
                regulation: template.regulation || '',
                has_regulation: !!(template.regulation),
                form_fields: sp(template.form_fields),
                is_active: template.is_active !== false,
                approval_name: template.approval_name || '결재',
                ref_name: template.ref_name || '참조',
                agree_name: template.agree_name || '합의',
                parallel_name: template.parallel_name || '병렬 결재',
                parallel_agree_name: template.parallel_agree_name || '병렬 합의',
                approval_line_required: !!template.approval_line_required,
                admin_approval_line: !!template.admin_approval_line,
                approval_line_changeable: template.approval_line_changeable !== false,
                skip_no_superior: !!template.skip_no_superior,
                predecision_enabled: !!template.predecision_enabled,
                default_line_enabled: template.default_line_enabled !== false,
                conditional_line_enabled: !!template.conditional_line_enabled,
                approval_lines: sp(template.approval_lines),
                editable_in_progress: !!template.editable_in_progress,
                receiver_enabled: template.receiver_enabled !== false,
                receiver_timing: template.receiver_timing || '문서 작성 시점부터 수신',
                receivers: sp(template.receivers),
                receiver_changeable: template.receiver_changeable !== false,
                share_range: template.share_range || '일부 공유',
                share_timing: template.share_timing || '완료된 후 공유',
                share_targets: sp(template.share_targets),
                share_changeable: template.share_changeable !== false,
                view_targets: sp(template.view_targets),
            };
        }
        return {
            name: '', category_id: categories[0]?.id || '', description: '', has_description: false,
            form_fields: [], is_active: true,
            regulation: '', has_regulation: false,
            approval_name: '결재', ref_name: '참조', agree_name: '합의',
            parallel_name: '병렬 결재', parallel_agree_name: '병렬 합의',
            approval_line_required: false, admin_approval_line: false,
            approval_line_changeable: true, skip_no_superior: false, predecision_enabled: false,
            default_line_enabled: true, conditional_line_enabled: false,
            approval_lines: [], editable_in_progress: false,
            receiver_enabled: true, receiver_timing: '문서 작성 시점부터 수신',
            receivers: [], receiver_changeable: true,
            share_range: '일부 공유', share_timing: '완료된 후 공유',
            share_targets: [], share_changeable: true, view_targets: [],
        };
    });

    const handleSave = () => {
        if (!form.name.trim() || !form.category_id) {
            toast.warning('서식명과 카테고리는 필수입니다.');
            setStep(0);
            return;
        }
        onSave(form);
    };

    return (
        <div className="tm-editor-page">
            {/* 상단 헤더 */}
            <div className="tm-editor-header">
                <button className="tm-back-btn" onClick={onBack}>← </button>
                <h2 className="tm-editor-title">{form.name || '새 서식'}</h2>
            </div>

            {/* 4단계 탭 */}
            <div className="tm-tabs">
                {STEPS.map((s, i) => (
                    <button
                        key={i}
                        className={`tm-tab ${step === i ? 'active' : ''} ${i < step ? 'done' : ''}`}
                        onClick={() => setStep(i)}
                    >
                        <span className="tm-tab-num">{i + 1}</span>
                        <span className="tm-tab-label">{s}</span>
                    </button>
                ))}
            </div>

            {/* 단계별 콘텐츠 */}
            <div className="tm-editor-body">
                {step === 0 && <TemplateStep1 form={form} setForm={setForm} categories={categories} />}
                {step === 1 && <TemplateStep2 form={form} setForm={setForm} />}
                {/* step 2: 수신·공유 설정 - 추후 구현 */}
                {/* step 3: 권한 설정 - 추후 구현 */}
            </div>

            {/* 하단 버튼 */}
            <div className="tm-editor-footer">
                <button className="tm-btn-cancel" onClick={onBack}>취소</button>
                <button className="tm-btn-primary" onClick={handleSave}>저장</button>
            </div>
        </div>
    );
}

// ─── 서식 관리 메인 (목록) ─────────────────
function TemplateManager() {
    const toast = useToast();
    const [templates, setTemplates] = useState([]);
    const [categories, setCategories] = useState([]);
    const [filterCat, setFilterCat] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const PER_PAGE = 10;

    // 'list' | 'edit' | 'new'
    const [view, setView] = useState('list');
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [previewTemplate, setPreviewTemplate] = useState(null);

    useEffect(() => {
        fetchTemplates();
        fetchCategories();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/approval/admin/templates');
            setTemplates(res.data.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/approval/admin/categories');
            setCategories(res.data.data);
        } catch (e) { console.error(e); }
    };

    const handleSave = async (form) => {
        try {
            const safeJson = (v) => {
                if (!v) return '[]';
                if (typeof v === 'string') return v;
                return JSON.stringify(v);
            };
            const payload = {
                ...form,
                form_fields:    safeJson(form.form_fields),
                approval_lines: safeJson(form.approval_lines),
                receivers:      safeJson(form.receivers),
                share_targets:  safeJson(form.share_targets),
                view_targets:   safeJson(form.view_targets),
            };
            if (editingTemplate) {
                await api.put(`/approval/admin/templates/${editingTemplate.id}`, payload);
            } else {
                await api.post('/approval/admin/templates', payload);
            }
            toast.success('저장되었습니다.');
            setView('list');
            fetchTemplates();
        } catch (e) { toast.error(e.response?.data?.message || '저장 실패'); }
    };

    const handleToggleActive = async (tmpl, e) => {
        e.stopPropagation();
        try {
            await api.put(`/approval/admin/templates/${tmpl.id}`, { is_active: !tmpl.is_active });
            fetchTemplates();
        } catch (e) { toast.error('변경 실패'); }
    };

    const handleToggleEditable = async (tmpl, e) => {
        e.stopPropagation();
        try {
            await api.put(`/approval/admin/templates/${tmpl.id}`, { editable_in_progress: !tmpl.editable_in_progress });
            fetchTemplates();
        } catch (e) { toast.error('변경 실패'); }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        try {
            await api.delete(`/approval/admin/templates/${id}`);
            fetchTemplates();
        } catch (e) { toast.error(e.response?.data?.message || '삭제 실패'); }
    };

    const filtered = templates.filter(t =>
        (!filterCat || String(t.category_id) === String(filterCat)) &&
        (!search || t.name.includes(search))
    );
    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    // ─ 미리보기 모달 ─
    const PreviewModal = previewTemplate ? (() => {
        const tmpl = previewTemplate;
        const fields = (() => { try { return JSON.parse(tmpl.form_fields || '[]'); } catch { return []; } })();
        return (
            <div className="tm-preview-overlay" onClick={() => setPreviewTemplate(null)}>
                <div className="tm-preview-modal" onClick={e => e.stopPropagation()}>
                    <div className="tm-preview-header">
                        <div>
                            <div className="tm-preview-category">{tmpl.category_name}</div>
                            <div className="tm-preview-title">{tmpl.name}</div>
                        </div>
                        <button className="tm-preview-close" onClick={() => setPreviewTemplate(null)}>✕</button>
                    </div>
                    <div className="tm-preview-body">
                        {tmpl.regulation && (
                            <div className="tm-preview-regulation">
                                <div className="tm-preview-reg-header">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    결재 규정
                                </div>
                                <pre className="tm-preview-reg-body">{tmpl.regulation}</pre>
                            </div>
                        )}
                        <div className="tm-preview-field-group">
                            <div className="tm-preview-field-row">
                                <label className="tm-preview-label">제목 <span style={{color:'#e53e3e'}}>*</span></label>
                                <div className="tm-preview-input-mock">제목을 입력하세요.</div>
                            </div>
                            {fields.map((f, i) => (
                                <div key={i} className="tm-preview-field-row">
                                    <label className="tm-preview-label">{f.label} {f.required && <span style={{color:'#e53e3e'}}>*</span>}</label>
                                    {f.type === 'textarea' ? (
                                        <div className="tm-preview-textarea-mock">{f.label}</div>
                                    ) : f.type === 'select' ? (
                                        <div className="tm-preview-select-mock">{(f.options||[])[0] || '선택'} ▾</div>
                                    ) : (
                                        <div className="tm-preview-input-mock">{f.label}</div>
                                    )}
                                </div>
                            ))}
                            <div className="tm-preview-field-row">
                                <label className="tm-preview-label">내용</label>
                                <div className="tm-preview-editor-mock">내용을 입력하세요.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    })() : null;

    // ─ 에디터 뷰 ─
    if (view !== 'list') {
        return (
            <TemplateEditor
                template={editingTemplate}
                categories={categories}
                onBack={() => { setView('list'); setEditingTemplate(null); }}
                onSave={handleSave}
            />
        );
    }

    // ─ 목록 뷰 ─
    if (loading) return <div className="aa-loading">로딩 중...</div>;

    return (
        <div className="aa-section tm-list-section">
            {/* 검색 필터 바 */}
            <div className="tm-filter-bar">
                <div className="tm-filter-left">
                    <label className="tm-filter-label">카테고리</label>
                    <select className="tm-filter-select" value={filterCat}
                        onChange={e => { setFilterCat(e.target.value); setPage(1); }}>
                        <option value="">전체</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <label className="tm-filter-label">서식명</label>
                    <input className="tm-filter-input" type="text" placeholder="서식명 검색"
                        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                    <button className="tm-btn-search">검색</button>
                </div>
            </div>

            {/* 목록 툴바 */}
            <div className="tm-list-toolbar">
                <button className="tm-btn-create" onClick={() => { setEditingTemplate(null); setView('new'); }}>
                    서식 만들기
                </button>
                <span className="tm-list-info">전체 {filtered.length} / {PER_PAGE}개씩 보기</span>
            </div>

            {/* 테이블 */}
            <div className="tm-table-wrap">
                <table className="tm-table">
                    <thead>
                        <tr>
                            <th>카테고리</th>
                            <th>서식명 ↕</th>
                            <th style={{width:140}}>사용 여부</th>
                            <th style={{width:160}}>진행 문서 수정</th>
                            <th style={{width:80}}>미리 보기</th>
                            <th style={{width:60}}>삭제</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(tmpl => (
                            <tr key={tmpl.id} className="tm-row" onClick={() => { setEditingTemplate(tmpl); setView('edit'); }}>
                                <td>{tmpl.category_name}</td>
                                <td className="tm-name-cell">
                                    <button className="tm-name-link"
                                        onClick={e => { e.stopPropagation(); setEditingTemplate(tmpl); setView('edit'); }}>
                                        {tmpl.name}
                                    </button>
                                </td>
                                <td onClick={e => e.stopPropagation()}>
                                    <select className="tm-status-select"
                                        value={tmpl.is_active ? '사용' : '사용 안 함'}
                                        onChange={e => handleToggleActive(tmpl, e)}>
                                        <option>사용</option>
                                        <option>사용 안 함</option>
                                    </select>
                                </td>
                                <td onClick={e => e.stopPropagation()}>
                                    <select className="tm-status-select"
                                        value={tmpl.editable_in_progress ? '사용' : '사용 안 함'}
                                        onChange={e => handleToggleEditable(tmpl, e)}>
                                        <option>사용</option>
                                        <option>사용 안 함</option>
                                    </select>
                                </td>
                                <td className="tm-center" onClick={e => e.stopPropagation()}>
                                    {tmpl.is_active && (
                                        <button className="tm-icon-btn" title="미리보기"
                                            onClick={() => setPreviewTemplate(tmpl)}>👁</button>
                                    )}
                                </td>
                                <td className="tm-center" onClick={e => e.stopPropagation()}>
                                    <button className="tm-icon-btn delete" title="삭제"
                                        onClick={e => handleDelete(tmpl.id, e)}>🗑</button>
                                </td>
                            </tr>
                        ))}
                        {paged.length === 0 && (
                            <tr><td colSpan={6} className="aa-empty">서식이 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
                <div className="tm-pagination">
                    <button disabled={page === 1} onClick={() => setPage(1)}>«</button>
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                    {[...Array(totalPages)].map((_, i) => (
                        <button key={i} className={page === i + 1 ? 'active' : ''}
                            onClick={() => setPage(i + 1)}>{i + 1}</button>
                    ))}
                    <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                    <button disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
                </div>
            )}

            {/* 미리보기 모달 */}
            {previewTemplate && (() => {
                const tmpl = previewTemplate;
                const fields = (() => { try { return JSON.parse(tmpl.form_fields || '[]'); } catch { return []; } })();
                return (
                    <div className="tm-preview-overlay" onClick={() => setPreviewTemplate(null)}>
                        <div className="tm-preview-modal" onClick={e => e.stopPropagation()}>
                            <div className="tm-preview-header">
                                <div>
                                    <div className="tm-preview-category">{tmpl.category_name}</div>
                                    <div className="tm-preview-title">{tmpl.name}</div>
                                </div>
                                <button className="tm-preview-close" onClick={() => setPreviewTemplate(null)}>✕</button>
                            </div>
                            <div className="tm-preview-body">
                                {tmpl.regulation && (
                                    <div className="tm-preview-regulation">
                                        <div className="tm-preview-reg-header">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                            결재 규정
                                        </div>
                                        <pre className="tm-preview-reg-body">{tmpl.regulation}</pre>
                                    </div>
                                )}
                                <div className="tm-preview-field-group">
                                    <div className="tm-preview-field-row">
                                        <label className="tm-preview-label">제목 <span style={{color:'#e53e3e'}}>*</span></label>
                                        <div className="tm-preview-input-mock">제목을 입력하세요.</div>
                                    </div>
                                    {fields.map((f, i) => (
                                        <div key={i} className="tm-preview-field-row">
                                            <label className="tm-preview-label">{f.label}{f.required && <span style={{color:'#e53e3e'}}> *</span>}</label>
                                            {f.type === 'textarea' ? (
                                                <textarea className="tm-preview-textarea-mock" disabled placeholder={f.label} rows={3} />
                                            ) : f.type === 'select' ? (
                                                <select className="tm-preview-select-mock">
                                                    {(f.options||[]).map((opt, oi) => <option key={oi}>{opt}</option>)}
                                                </select>
                                            ) : f.type === 'number' ? (
                                                <input className="tm-preview-input-mock" type="number" disabled placeholder={f.label} />
                                            ) : f.type === 'date' ? (
                                                <input className="tm-preview-input-mock" type="date" disabled />
                                            ) : f.type === 'time' ? (
                                                <input className="tm-preview-input-mock" type="time" disabled />
                                            ) : (
                                                <input className="tm-preview-input-mock" type="text" disabled placeholder={f.label} />
                                            )}
                                        </div>
                                    ))}
                                    <div className="tm-preview-field-row">
                                        <label className="tm-preview-label">내용</label>
                                        <div className="tm-preview-editor-mock">내용을 입력하세요.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}


// 문서함 관리 (관리자용)
function DocumentManager() {
    const toast = useToast();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({});

    const fetchDocuments = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/approval/admin/documents', {
                params: { status: statusFilter, search, page, limit: 20 }
            });
            setDocuments(res.data.data.documents);
            setPagination(res.data.data.pagination);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [statusFilter, search, page]);

    useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

    const handleCancel = async (id) => {
        if (!window.confirm('삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        try {
            await api.put(`/approval/admin/documents/${id}/cancel`);
            fetchDocuments();
        } catch (e) { toast.error(e.response?.data?.message || '취소 실패'); }
    };

    const statusLabel = {
        DRAFT: { text: '임시저장', cls: 'draft' },
        PENDING: { text: '대기', cls: 'pending' },
        IN_PROGRESS: { text: '진행중', cls: 'progress' },
        APPROVED: { text: '완료', cls: 'approved' },
        REJECTED: { text: '반려', cls: 'rejected' },
        CANCELLED: { text: '취소', cls: 'cancelled' },
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('ko-KR') : '-';

    return (
        <div className="aa-section">
            <div className="aa-section-header">
                <h2>결재 문서 관리</h2>
                <p>전체 결재 문서를 조회하고 관리합니다.</p>
            </div>

            <div className="aa-toolbar">
                <div className="aa-toolbar-left">
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                        <option value="">전체 상태</option>
                        <option value="PENDING">대기</option>
                        <option value="IN_PROGRESS">진행중</option>
                        <option value="APPROVED">완료</option>
                        <option value="REJECTED">반려</option>
                        <option value="CANCELLED">취소</option>
                    </select>
                    <input
                        type="text"
                        placeholder="제목 / 기안자 검색"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                <span className="aa-total-count">총 {pagination.total || 0}건</span>
            </div>

            <div className="aa-table-wrap">
                <table className="aa-table">
                    <thead>
                        <tr>
                            <th style={{width:150}}>문서번호</th>
                            <th>제목</th>
                            <th style={{width:110}}>서식</th>
                            <th style={{width:130}}>기안자</th>
                            <th style={{width:80}}>상태</th>
                            <th style={{width:90}}>상신일</th>
                            <th style={{width:90}}>완료일</th>
                            <th style={{width:70}}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="aa-empty">로딩 중...</td></tr>
                        ) : documents.map(doc => {
                            const st = statusLabel[doc.status] || { text: doc.status, cls: '' };
                            return (
                                <tr key={doc.id}>
                                    <td className="aa-doc-number">{doc.doc_number || '-'}</td>
                                    <td className="aa-doc-title">{doc.title}</td>
                                    <td>
                                        <span className="aa-cat-badge">{doc.template_name || '자유'}</span>
                                    </td>
                                    <td style={{whiteSpace:'nowrap'}}>{doc.drafter_name} <small style={{color:'#999'}}>{doc.drafter_dept}</small></td>
                                    <td className="aa-center">
                                        <span className={`aa-status-badge ${st.cls}`}>{st.text}</span>
                                    </td>
                                    <td className="aa-center">{formatDate(doc.submitted_at)}</td>
                                    <td className="aa-center">{formatDate(doc.completed_at)}</td>
                                    <td>
                                        {['PENDING','IN_PROGRESS'].includes(doc.status) && (
                                            <button className="aa-btn-sm delete" onClick={() => handleCancel(doc.id)}>취소</button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && documents.length === 0 && (
                            <tr><td colSpan={8} className="aa-empty">문서가 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
                <div className="tm-pagination">
                    <button disabled={page === 1} onClick={() => setPage(1)}>«</button>
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                    {(() => {
                        const total = pagination.totalPages;
                        const start = Math.max(1, Math.min(page - 2, total - 4));
                        const end = Math.min(total, start + 4);
                        return [...Array(end - start + 1)].map((_, i) => {
                            const p = start + i;
                            return <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>;
                        });
                    })()}
                    <button disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                    <button disabled={page === pagination.totalPages} onClick={() => setPage(pagination.totalPages)}>»</button>
                </div>
            )}
        </div>
    );
}

// ─── 사원 검색 인풋 컴포넌트 ─────────────────
function UserSearchInput({ users, value, onChange, placeholder, excludeId }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);

    const selected = users.find(u => String(u.id) === String(value));
    const filtered = users.filter(u =>
        String(u.id) !== String(excludeId) &&
        (!query || u.name.includes(query) || (u.department_name || '').includes(query))
    );

    const handleSelect = (u) => {
        onChange(u.id);
        setQuery('');
        setOpen(false);
    };

    const handleClear = () => {
        onChange('');
        setQuery('');
    };

    return (
        <div className="exc-user-input-wrap">
            {selected ? (
                <div className="exc-user-selected">
                    <span className="exc-user-avatar">{selected.name.charAt(0)}</span>
                    <span className="exc-user-name">{selected.name}</span>
                    <span className="exc-user-dept">{selected.department_name || ''}</span>
                    <button className="exc-user-clear" onClick={handleClear}>✕</button>
                </div>
            ) : (
                <div className="exc-user-search">
                    <input
                        className="exc-search-input"
                        type="text"
                        placeholder={placeholder}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setOpen(true); }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setTimeout(() => setOpen(false), 150)}
                    />
                    <span className="exc-search-icon">🔍</span>
                    {open && (
                        <div className="exc-dropdown">
                            {filtered.length === 0 ? (
                                <div className="exc-dropdown-empty">검색 결과가 없습니다</div>
                            ) : filtered.slice(0, 8).map(u => (
                                <div key={u.id} className="exc-dropdown-item" onMouseDown={() => handleSelect(u)}>
                                    <span className="exc-user-avatar sm">{u.name.charAt(0)}</span>
                                    <span className="exc-user-name">{u.name}</span>
                                    <span className="exc-user-dept">{u.department_name || '-'}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── 결재선 예외 추가 모달 ────────────────────
function ExceptionModal({ categories, templates, users, departments, onClose, onSave }) {
    const toast = useToast();
    const EMPTY_FORM = {
        template_scope: 'all',      // 'all' | 'specific'
        category_id: '',
        template_id: '',
        template_sub: 'all',        // 하위 전체
        dept_scope: 'all',          // 'all' | 'specific'
        dept_id: '',
        from_user_id: '',
        exception_type: 'change',   // 'skip' | 'change' | 'ref'
        to_user_id: '',
    };
    const [form, setForm] = useState(EMPTY_FORM);
    const [expanded, setExpanded] = useState(false);

    const filteredTemplates = templates.filter(t =>
        !form.category_id || String(t.category_id) === String(form.category_id)
    );

    const canSave = form.from_user_id &&
        (form.exception_type === 'skip' || form.to_user_id);

    const handleSave = () => {
        if (!canSave) {
            toast.warning(form.exception_type === 'skip'
                ? '원결재자를 선택해주세요.'
                : '원결재자와 변경 결재자를 선택해주세요.');
            return;
        }
        onSave(form);
    };

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    return (
        <>
            <div className="exc-overlay" onClick={onClose} />
            <div className={`exc-modal ${expanded ? 'expanded' : ''}`}>
                {/* 헤더 */}
                <div className="exc-modal-header">
                    <span className="exc-modal-title">결재선 예외 추가</span>
                    <div className="exc-header-actions">
                        <button className="exc-expand-btn" onClick={() => setExpanded(v => !v)}>
                            {expanded ? '기본 보기' : '크게 보기'}
                        </button>
                        <button className="exc-close-btn" onClick={onClose}>✕</button>
                    </div>
                </div>

                {/* 바디 */}
                <div className="exc-modal-body">

                    {/* 서식 */}
                    <div className="exc-row">
                        <label className="exc-label">서식</label>
                        <div className="exc-field-group">
                            <div className="exc-radios">
                                <label className="exc-radio-label">
                                    <input type="radio" name="tmpl_scope" value="all"
                                        checked={form.template_scope === 'all'}
                                        onChange={() => set('template_scope', 'all')} />
                                    전체 서식
                                </label>
                                <label className="exc-radio-label">
                                    <input type="radio" name="tmpl_scope" value="specific"
                                        checked={form.template_scope === 'specific'}
                                        onChange={() => set('template_scope', 'specific')} />
                                    서식 지정
                                </label>
                            </div>
                            {form.template_scope === 'specific' && (
                                <div className="exc-selects-row">
                                    <select className="exc-select"
                                        value={form.category_id}
                                        onChange={e => { set('category_id', e.target.value); set('template_id', ''); }}>
                                        <option value="">카테고리 선택</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <select className="exc-select"
                                        value={form.template_id}
                                        onChange={e => set('template_id', e.target.value)}>
                                        <option value="">서식 선택</option>
                                        {filteredTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    <select className="exc-select sm"
                                        value={form.template_sub}
                                        onChange={e => set('template_sub', e.target.value)}>
                                        <option value="all">전체</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 기안 부서 */}
                    <div className="exc-row">
                        <label className="exc-label">기안 부서</label>
                        <div className="exc-field-group">
                            <div className="exc-radios">
                                <label className="exc-radio-label">
                                    <input type="radio" name="dept_scope" value="all"
                                        checked={form.dept_scope === 'all'}
                                        onChange={() => set('dept_scope', 'all')} />
                                    전체 부서
                                </label>
                                <label className="exc-radio-label">
                                    <input type="radio" name="dept_scope" value="specific"
                                        checked={form.dept_scope === 'specific'}
                                        onChange={() => set('dept_scope', 'specific')} />
                                    부서 지정
                                </label>
                            </div>
                            {form.dept_scope === 'specific' && (
                                <select className="exc-select"
                                    value={form.dept_id}
                                    onChange={e => set('dept_id', e.target.value)}>
                                    <option value="">부서 선택</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* 원결재자 */}
                    <div className="exc-row">
                        <label className="exc-label">원결재자 <span className="exc-required">*</span></label>
                        <UserSearchInput
                            users={users}
                            value={form.from_user_id}
                            onChange={v => set('from_user_id', v)}
                            placeholder="사원명 입력"
                            excludeId={form.to_user_id}
                        />
                    </div>

                    {/* 예외 처리 구분 */}
                    <div className="exc-row">
                        <label className="exc-label">예외 처리 구분</label>
                        <div className="exc-radios">
                            {[
                                { value: 'skip', label: '결재자 생략' },
                                { value: 'change', label: '결재자 변경' },
                                { value: 'ref', label: '참조' },
                            ].map(opt => (
                                <label key={opt.value} className="exc-radio-label">
                                    <input type="radio" name="exc_type" value={opt.value}
                                        checked={form.exception_type === opt.value}
                                        onChange={() => set('exception_type', opt.value)} />
                                    {opt.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 변경 결재자 (생략 선택 시 숨김) */}
                    {form.exception_type !== 'skip' && (
                        <div className="exc-row">
                            <label className="exc-label">
                                {form.exception_type === 'ref' ? '참조자' : '변경 결재자'}
                                <span className="exc-required">*</span>
                            </label>
                            <UserSearchInput
                                users={users}
                                value={form.to_user_id}
                                onChange={v => set('to_user_id', v)}
                                placeholder="사원명 입력"
                                excludeId={form.from_user_id}
                            />
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="exc-modal-footer">
                    <button className="exc-btn-cancel" onClick={onClose}>취소</button>
                    <button className="exc-btn-save" onClick={handleSave} disabled={!canSave}>저장</button>
                </div>
            </div>
        </>
    );
}

// ─── 결재선 예외 관리 메인 ────────────────────
function ApprovalLineException() {
    const toast = useToast();
    const [exceptions, setExceptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [users, setUsers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        fetchExceptions();
        fetchUsers();
        fetchCategories();
        fetchTemplates();
        fetchDepartments();
    }, []);

    const fetchExceptions = async () => {
        try {
            const res = await api.get('/approval/admin/line-exceptions');
            setExceptions(res.data.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data.data.users || []);
        } catch (e) { console.error(e); }
    };

    const fetchCategories = async () => {
        try {
            const res = await api.get('/approval/admin/categories');
            setCategories(res.data.data);
        } catch (e) { console.error(e); }
    };

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/approval/admin/templates');
            setTemplates(res.data.data);
        } catch (e) { console.error(e); }
    };

    const fetchDepartments = async () => {
        try {
            const res = await api.get('/departments');
            setDepartments(res.data.data.departments || []);
        } catch (e) { console.error(e); }
    };

    const handleSave = async (form) => {
        try {
            await api.post('/approval/admin/line-exceptions', {
                from_user_id: form.from_user_id,
                to_user_id: form.exception_type !== 'skip' ? form.to_user_id : null,
                exception_type: form.exception_type,
                template_scope: form.template_scope,
                template_id: form.template_scope === 'specific' ? form.template_id : null,
                dept_scope: form.dept_scope,
                dept_id: form.dept_scope === 'specific' ? form.dept_id : null,
            });
            setShowModal(false);
            fetchExceptions();
        } catch (e) { toast.error(e.response?.data?.message || '저장 실패'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        try {
            await api.delete(`/approval/admin/line-exceptions/${id}`);
            fetchExceptions();
        } catch (e) { toast.error('삭제 실패'); }
    };

    const excTypeLabel = { skip: '결재자 생략', change: '결재자 변경', ref: '참조' };

    if (loading) return <div className="aa-loading">로딩 중...</div>;

    return (
        <div className="aa-section">
            <div className="aa-section-header">
                <h2>결재선 예외 관리</h2>
                <p>특정 결재자를 생략하거나 다른 결재자로 변경하는 예외 규칙을 설정합니다.</p>
            </div>

            <div className="aa-toolbar">
                <div className="aa-toolbar-left" />
                <button className="aa-btn-primary" onClick={() => setShowModal(true)}>+ 예외 추가</button>
            </div>

            <div className="aa-table-wrap">
                <table className="aa-table">
                    <thead>
                        <tr>
                            <th>서식</th>
                            <th>기안 부서</th>
                            <th>원결재자</th>
                            <th style={{width:110}}>예외 구분</th>
                            <th>변경/참조 대상</th>
                            <th style={{width:110}}>등록일</th>
                            <th style={{width:70}}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {exceptions.map(ex => (
                            <tr key={ex.id}>
                                <td>{ex.template_scope === 'all' ? <span className="exc-badge-all">전체 서식</span> : (ex.template_name || '-')}</td>
                                <td>{ex.dept_scope === 'all' ? <span className="exc-badge-all">전체 부서</span> : (ex.dept_name || '-')}</td>
                                <td>
                                    <div className="exc-user-cell">
                                        <span className="exc-user-avatar sm">{(ex.from_name || '?').charAt(0)}</span>
                                        <span>{ex.from_name}</span>
                                        <small className="exc-dept-small">{ex.from_dept}</small>
                                    </div>
                                </td>
                                <td>
                                    <span className={`exc-type-badge ${ex.exception_type || 'change'}`}>
                                        {excTypeLabel[ex.exception_type] || '결재자 변경'}
                                    </span>
                                </td>
                                <td>
                                    {ex.to_name ? (
                                        <div className="exc-user-cell">
                                            <span className="exc-user-avatar sm">{ex.to_name.charAt(0)}</span>
                                            <span>{ex.to_name}</span>
                                            <small className="exc-dept-small">{ex.to_dept}</small>
                                        </div>
                                    ) : '-'}
                                </td>
                                <td className="aa-center">{new Date(ex.created_at).toLocaleDateString('ko-KR')}</td>
                                <td>
                                    <button className="aa-btn-sm delete" onClick={() => handleDelete(ex.id)}>삭제</button>
                                </td>
                            </tr>
                        ))}
                        {exceptions.length === 0 && (
                            <tr><td colSpan={7} className="aa-empty">등록된 예외 설정이 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <ExceptionModal
                    categories={categories}
                    templates={templates}
                    users={users}
                    departments={departments}
                    onClose={() => setShowModal(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}

// ============================================
// 메인 ApprovalAdmin 컴포넌트
// ============================================
const MENU = [
    {
        group: '문서함',
        items: [
            { key: 'documents',  label: '결재 문서 관리' },
        ]
    },
    {
        group: '서식',
        items: [
            { key: 'templates',  label: '서식 관리' },
            { key: 'exceptions', label: '결재선 예외 관리' },
            { key: 'categories', label: '카테고리 관리' },
        ]
    },
];

function ApprovalAdmin() {
    const [activeMenu, setActiveMenu] = useState('documents');

    const renderContent = () => {
        switch (activeMenu) {
            case 'documents':  return <DocumentManager />;
            case 'templates':  return <TemplateManager />;
            case 'exceptions': return <ApprovalLineException />;
            case 'categories': return <CategoryManager />;
            default:           return <DocumentManager />;
        }
    };

    return (
        <div className="approval-admin-page">
            {/* 좌측 사이드바 */}
            <aside className="aa-sidebar">
                <div className="aa-sidebar-header">
                    <span className="aa-sidebar-icon">✅</span>
                    <span className="aa-sidebar-title">결재 관리</span>
                </div>
                <nav className="aa-nav">
                    {MENU.map(group => (
                        <div key={group.group} className="aa-nav-group">
                            <div className="aa-nav-group-title">{group.group}</div>
                            {group.items.map(item => (
                                <button
                                    key={item.key}
                                    className={`aa-nav-item ${activeMenu === item.key ? 'active' : ''}`}
                                    onClick={() => setActiveMenu(item.key)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>
            </aside>

            {/* 우측 콘텐츠 */}
            <main className="aa-content">
                {renderContent()}
            </main>
        </div>
    );
}

export default ApprovalAdmin;