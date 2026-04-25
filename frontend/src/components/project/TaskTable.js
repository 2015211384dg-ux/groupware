import React, { useState, useRef, useEffect, useCallback } from 'react';
import './TaskTable.css';
import api from '../../services/api';
import { useToast } from '../common/Toast';
import { useConfirm } from '../common/Confirm';

// ── 아이콘 ──
const Ic = ({ d, size=14, sw=1.6 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        {Array.isArray(d) ? d.map((p,i)=><path key={i} d={p}/>) : <path d={d}/>}
    </svg>
);
const IcPlus     = p => <Ic {...p} d={["M12 5v14","M5 12h14"]} />;
const IcChevron  = p => <Ic {...p} d="M6 9l6 6 6-6" />;
const IcX        = p => <Ic {...p} d={["M18 6L6 18","M6 6l12 12"]} />;
const IcTrash    = p => <Ic {...p} d={["M3 6h18","M8 6V4h8v2","M19 6l-1 14H6L5 6"]} />;

const STATUS_OPTIONS = [
    { value:'todo',        label:'할 일',   color:'#94a3b8' },
    { value:'in_progress', label:'진행 중', color:'#667eea' },
    { value:'done',        label:'완료',    color:'#10b981' },
    { value:'on_hold',     label:'보류',    color:'#f59e0b' },
];
const PRIORITY_OPTIONS = [
    { value:'urgent', label:'긴급', color:'#ef4444' },
    { value:'high',   label:'높음', color:'#f97316' },
    { value:'normal', label:'보통', color:'#667eea' },
    { value:'low',    label:'낮음', color:'#94a3b8' },
];
const FIELD_TYPES = [
    { value:'text',     label:'텍스트' },
    { value:'number',   label:'숫자' },
    { value:'date',     label:'날짜' },
    { value:'checkbox', label:'체크박스' },
];

function StatusBadge({ value, onChange, readonly }) {
    const [open, setOpen] = useState(false);
    const opt = STATUS_OPTIONS.find(o => o.value === value) || STATUS_OPTIONS[0];
    if (readonly) return (
        <span className="tt-status-badge" style={{ background: opt.color + '1a', color: opt.color }}>
            <span className="tt-status-dot" style={{ background: opt.color }} />{opt.label}
        </span>
    );
    return (
        <div className="tt-status-wrap" onClick={e => e.stopPropagation()}>
            <span className="tt-status-badge" style={{ background: opt.color + '1a', color: opt.color }}
                  onClick={() => setOpen(o => !o)}>
                <span className="tt-status-dot" style={{ background: opt.color }} />{opt.label}
            </span>
            {open && (
                <div className="tt-dropdown">
                    {STATUS_OPTIONS.map(o => (
                        <div key={o.value} className="tt-dropdown-item"
                             onClick={() => { onChange(o.value); setOpen(false); }}>
                            <span className="tt-status-dot" style={{ background: o.color }} />{o.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PriorityBadge({ value, onChange, readonly }) {
    const [open, setOpen] = useState(false);
    const opt = PRIORITY_OPTIONS.find(o => o.value === value) || PRIORITY_OPTIONS[2];
    if (readonly) return <span className="tt-priority" style={{ color: opt.color }}>{opt.label}</span>;
    return (
        <div className="tt-status-wrap" onClick={e => e.stopPropagation()}>
            <span className="tt-priority" style={{ color: opt.color, cursor:'pointer' }}
                  onClick={() => setOpen(o => !o)}>{opt.label}</span>
            {open && (
                <div className="tt-dropdown">
                    {PRIORITY_OPTIONS.map(o => (
                        <div key={o.value} className="tt-dropdown-item"
                             onClick={() => { onChange(o.value); setOpen(false); }}>
                            <span style={{ color: o.color, fontWeight:600 }}>{o.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// 커스텀 값 셀
function CustomCell({ colId, fieldType, value, taskId, projectId, onSaved }) {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value ?? '');
    const toast = useToast();

    const save = async (v) => {
        if (v === (value ?? '')) { setEditing(false); return; }
        try {
            await api.patch(`/projects/${projectId}/tasks/${taskId}/custom-values`, {
                column_id: colId, value: v
            });
            onSaved(colId, v);
        } catch { toast.error('저장 실패'); }
        setEditing(false);
    };

    if (fieldType === 'checkbox') {
        const checked = val === 'true' || val === '1';
        return (
            <div className="tt-cell-center" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={checked}
                    onChange={async (e) => {
                        const nv = e.target.checked ? 'true' : 'false';
                        setVal(nv);
                        await api.patch(`/projects/${projectId}/tasks/${taskId}/custom-values`,
                            { column_id: colId, value: nv }).catch(() => {});
                        onSaved(colId, nv);
                    }} />
            </div>
        );
    }

    if (!editing) {
        return (
            <div className="tt-cell-custom" onClick={e => { e.stopPropagation(); setEditing(true); }}>
                {val || <span className="tt-cell-empty">—</span>}
            </div>
        );
    }

    return (
        <div onClick={e => e.stopPropagation()}>
            <input
                className="tt-cell-input"
                type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
                value={val}
                autoFocus
                onChange={e => setVal(e.target.value)}
                onBlur={() => save(val)}
                onKeyDown={e => { if (e.key === 'Enter') save(val); if (e.key === 'Escape') setEditing(false); }}
            />
        </div>
    );
}

// 컬럼 추가 팝업
function AddColumnPopup({ projectId, onAdded, onClose }) {
    const toast = useToast();
    const [name, setName] = useState('');
    const [type, setType] = useState('text');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef(null);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleAdd = async () => {
        if (!name.trim()) { toast.warning('항목명을 입력해주세요.'); return; }
        setSaving(true);
        try {
            const res = await api.post(`/projects/${projectId}/custom-columns`, {
                name: name.trim(), field_type: type
            });
            onAdded(res.data.column);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || '추가 실패');
        } finally { setSaving(false); }
    };

    return (
        <div className="tt-col-popup" onClick={e => e.stopPropagation()}>
            <div className="tt-col-popup-title">항목 추가</div>
            <div className="tt-col-popup-field">
                <label>항목명</label>
                <input ref={inputRef} className="tt-col-popup-input" placeholder="이름 입력 (옵션)"
                    value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onClose(); }}
                    maxLength={50} />
            </div>
            <div className="tt-col-popup-field">
                <label>유형</label>
                <select className="tt-col-popup-select" value={type} onChange={e => setType(e.target.value)}>
                    {FIELD_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
            </div>
            <div className="tt-col-popup-btns">
                <button className="tt-popup-cancel" onClick={onClose}>취소</button>
                <button className="tt-popup-confirm" onClick={handleAdd} disabled={saving}>확인</button>
            </div>
        </div>
    );
}

// 인라인 업무 추가 폼
function InlineAddTask({ groupId, projectId, onAdded, onCancel }) {
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const toast = useToast();
    const ref = useRef(null);
    useEffect(() => { ref.current?.focus(); }, []);

    const submit = async () => {
        if (!title.trim()) { onCancel(); return; }
        setSaving(true);
        try {
            const res = await api.post(`/projects/${projectId}/tasks`, { title: title.trim(), group_id: groupId });
            onAdded(res.data.task);
            setTitle('');
        } catch { toast.error('업무 추가 실패'); } finally { setSaving(false); }
    };

    return (
        <tr className="tt-row tt-row-add">
            <td className="tt-cell tt-cell-name tt-cell-add" colSpan={100}>
                <span className="tt-add-check-icon" />
                <input ref={ref} className="tt-add-input" placeholder="업무 제목 입력 후 Enter"
                    value={title} onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
                    disabled={saving} />
                <button className="tt-add-cancel" onClick={onCancel}><IcX size={12} /></button>
            </td>
        </tr>
    );
}

// ── 업무 행 ──
function TaskRow({ task, projectId, members, myRole, customColumns, onStatusChange, onTaskClick, onTaskUpdated }) {
    const toast = useToast();
    const canWrite = ['owner','manager','member'].includes(myRole);
    const [customVals, setCustomVals] = useState(task.custom_values || {});

    const handleStatusChange = async (status) => {
        try {
            await api.patch(`/projects/${projectId}/tasks/${task.id}/status`, { status });
            onStatusChange(task.id, status);
        } catch { toast.error('상태 변경 실패'); }
    };

    const handlePriorityChange = async (priority) => {
        try {
            await api.patch(`/projects/${projectId}/tasks/${task.id}`, { ...task, priority });
            onTaskUpdated({ ...task, priority });
        } catch { toast.error('우선순위 변경 실패'); }
    };

    const today = new Date(); today.setHours(0,0,0,0);
    const due = task.due_date ? new Date(task.due_date) : null;
    if (due) due.setHours(0,0,0,0);
    const isOverdue = due && due < today && task.status !== 'done';
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit' }).replace(/\.$/, '') : '—';

    return (
        <tr className={`tt-row ${task.status === 'done' ? 'tt-row-done' : ''}`}
            onClick={() => onTaskClick(task)}>
            {/* 업무명 */}
            <td className="tt-cell tt-cell-name">
                <div className="tt-name-wrap">
                    <div className={`tt-check ${task.status === 'done' ? 'checked' : ''}`}
                         onClick={e => { e.stopPropagation(); handleStatusChange(task.status === 'done' ? 'todo' : 'done'); }}>
                        {task.status === 'done' && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span className="tt-task-title">{task.title}</span>
                    {task.comment_count > 0 && (
                        <span className="tt-comment-badge">{task.comment_count}</span>
                    )}
                </div>
            </td>
            {/* 상태 */}
            <td className="tt-cell tt-cell-status" onClick={e => e.stopPropagation()}>
                <StatusBadge value={task.status} onChange={handleStatusChange} readonly={!canWrite} />
            </td>
            {/* 담당자 */}
            <td className="tt-cell">
                <div className="tt-assignees">
                    {task.assignees?.slice(0, 3).map(a => (
                        <div key={a.user_id} className="tt-assignee-avatar" title={a.name}>{a.name?.[0]}</div>
                    ))}
                    {(task.assignees?.length || 0) > 3 && (
                        <div className="tt-assignee-avatar tt-assignee-more">+{task.assignees.length - 3}</div>
                    )}
                </div>
            </td>
            {/* 시작일 */}
            <td className="tt-cell tt-cell-date">{fmtDate(task.start_date)}</td>
            {/* 마감일 */}
            <td className={`tt-cell tt-cell-date ${isOverdue ? 'tt-overdue' : ''}`}>
                {fmtDate(task.due_date)}
            </td>
            {/* 우선순위 */}
            <td className="tt-cell" onClick={e => e.stopPropagation()}>
                <PriorityBadge value={task.priority} onChange={handlePriorityChange} readonly={!canWrite} />
            </td>
            {/* 진척도 */}
            <td className="tt-cell">
                <div className="tt-progress-wrap">
                    <div className="tt-progress-bar">
                        <div className="tt-progress-fill" style={{ width: `${task.progress}%` }} />
                    </div>
                    <span className="tt-progress-txt">{task.progress}%</span>
                </div>
            </td>
            {/* 커스텀 컬럼 */}
            {customColumns.map(col => (
                <td key={col.id} className="tt-cell" onClick={e => e.stopPropagation()}>
                    {canWrite ? (
                        <CustomCell
                            colId={col.id} fieldType={col.field_type}
                            value={customVals[col.id]}
                            taskId={task.id} projectId={projectId}
                            onSaved={(cid, v) => setCustomVals(prev => ({ ...prev, [cid]: v }))}
                        />
                    ) : (
                        <span className="tt-cell-custom">{customVals[col.id] || '—'}</span>
                    )}
                </td>
            ))}
        </tr>
    );
}

// ── 그룹 섹션 ──
function TaskGroupSection({ group, tasks, projectId, members, myRole, customColumns,
                             onStatusChange, onTaskClick, onTaskUpdated, onTaskAdded, onGroupDeleted }) {
    const toast    = useToast();
    const confirm  = useConfirm();
    const [collapsed,  setCollapsed]  = useState(false);
    const [showAdd,    setShowAdd]    = useState(false);
    const [showMenu,   setShowMenu]   = useState(false);
    const menuRef  = useRef(null);
    const isManager = ['owner','manager'].includes(myRole);
    const canWrite  = ['owner','manager','member'].includes(myRole);

    // 바깥 클릭 메뉴 닫기
    useEffect(() => {
        if (!showMenu) return;
        const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showMenu]);

    const handleDelete = async () => {
        setShowMenu(false);
        const ok = await confirm(
            `"${group.name}" 그룹을 삭제할까요?\n안의 업무는 그룹 미지정으로 이동됩니다.`,
            { confirmText: '삭제', danger: true }
        );
        if (!ok) return;
        try {
            await api.delete(`/projects/${projectId}/task-groups/${group.id}`);
            toast.success('그룹이 삭제되었습니다.');
            onGroupDeleted(group.id);
        } catch { toast.error('그룹 삭제 실패'); }
    };

    return (
        <>
            {/* 그룹 헤더 행 */}
            <tr className="tt-group-row">
                <td className="tt-group-header" colSpan={7 + customColumns.length + 1}>
                    <div className="tt-group-head-inner">
                        <button className="tt-group-toggle" onClick={() => setCollapsed(c => !c)}>
                            <IcChevron size={13} style={{ transform: collapsed ? 'rotate(-90deg)' : '', transition:'transform .2s' }} />
                        </button>
                        <span className="tt-group-dot" style={{ background: group.color || '#667eea' }} />
                        <span className="tt-group-name">{group.name}</span>
                        <span className="tt-group-count">({tasks.length})</span>

                        {/* ⋯ 메뉴 (관리자, 그룹 미지정 제외) */}
                        {isManager && group.id !== null && (
                            <div className="tt-group-menu-wrap" ref={menuRef}>
                                <button
                                    className="tt-group-more-btn"
                                    onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
                                    title="더보기"
                                >
                                    ···
                                </button>
                                {showMenu && (
                                    <div className="tt-group-dropdown">
                                        <button className="tt-group-dropdown-item danger" onClick={handleDelete}>
                                            <IcTrash size={13} /> 그룹 삭제
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </td>
            </tr>

            {/* 업무 행들 */}
            {!collapsed && (
                <>
                    {tasks.map(task => (
                        <TaskRow key={task.id} task={task} projectId={projectId}
                            members={members} myRole={myRole} customColumns={customColumns}
                            onStatusChange={onStatusChange} onTaskClick={onTaskClick}
                            onTaskUpdated={onTaskUpdated} />
                    ))}
                    {showAdd && (
                        <InlineAddTask groupId={group.id ?? null} projectId={projectId}
                            onAdded={t => { onTaskAdded(t); setShowAdd(false); }}
                            onCancel={() => setShowAdd(false)} />
                    )}
                    {canWrite && !showAdd && (
                        <tr className="tt-add-row">
                            <td colSpan={7 + customColumns.length + 1}>
                                <button className="tt-add-task-btn" onClick={() => setShowAdd(true)}>
                                    <IcPlus size={12} /> 새 업무 추가
                                </button>
                            </td>
                        </tr>
                    )}
                </>
            )}
        </>
    );
}

// ── 메인 TaskTable ──
export default function TaskTable({ project, groups, tasks, members, myRole,
                                    onTaskAdded, onTaskClick, onStatusChange, onGroupAdded, onGroupDeleted, onTaskUpdated }) {
    const toast   = useToast();
    const confirm = useConfirm();
    const [customColumns, setCustomColumns] = useState([]);
    const [showAddCol, setShowAddCol]       = useState(false);
    const [filterStatus, setFilterStatus]   = useState('');
    const [search, setSearch]               = useState('');
    const addColRef = useRef(null);
    const isManager = ['owner','manager'].includes(myRole);

    const fetchColumns = useCallback(async () => {
        try {
            const res = await api.get(`/projects/${project.id}/custom-columns`);
            setCustomColumns(res.data.columns || []);
        } catch {}
    }, [project.id]);

    useEffect(() => { fetchColumns(); }, [fetchColumns]);

    // 바깥 클릭으로 팝업 닫기
    useEffect(() => {
        if (!showAddCol) return;
        const handler = (e) => { if (addColRef.current && !addColRef.current.contains(e.target)) setShowAddCol(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showAddCol]);

    const handleDeleteColumn = async (colId, e) => {
        e.stopPropagation();
        const ok = await confirm('이 항목을 삭제할까요?', { confirmText: '삭제', danger: true });
        if (!ok) return;
        try {
            await api.delete(`/projects/${project.id}/custom-columns/${colId}`);
            setCustomColumns(prev => prev.filter(c => c.id !== colId));
        } catch { toast.error('삭제 실패'); }
    };

    const handleAddGroup = async () => {
        const name = await confirm('그룹 이름을 입력하세요', {
            type: 'input',
            placeholder: '그룹 이름',
            confirmText: '추가',
        });
        if (!name) return;
        try {
            const res = await api.post(`/projects/${project.id}/task-groups`, { name });
            onGroupAdded(res.data.group);
            toast.success('그룹이 추가되었습니다.');
        } catch { toast.error('그룹 추가 실패'); }
    };

    const filterTask = t => {
        if (filterStatus && t.status !== filterStatus) return false;
        if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    };

    const getGroupTasks = (groupId) =>
        tasks.filter(t => (groupId === null ? !t.group_id : t.group_id === groupId)).filter(filterTask);

    const allGroups = [
        ...groups,
        { id: null, name: '그룹 미지정', color: '#94a3b8' }
    ].filter(g => {
        const gt = getGroupTasks(g.id);
        return g.id !== null || gt.length > 0 || (!filterStatus && !search);
    });

    return (
        <div className="tt-wrap">
            {/* 툴바 */}
            <div className="tt-toolbar">
                <select className="tt-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">전체 상태</option>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input className="tt-search" placeholder="업무 검색..." value={search} onChange={e => setSearch(e.target.value)} />
                <div style={{ flex: 1 }} />
                {isManager && (
                    <button className="tt-add-group-btn" onClick={handleAddGroup}>
                        <IcPlus size={13} /> 그룹 추가
                    </button>
                )}
            </div>

            {/* 테이블 */}
            <div className="tt-table-wrap">
                <table className="tt-table">
                    <thead>
                        <tr className="tt-header-row">
                            <th className="tt-th tt-th-name">업무명</th>
                            <th className="tt-th">상태</th>
                            <th className="tt-th">담당자</th>
                            <th className="tt-th">시작일</th>
                            <th className="tt-th">마감일</th>
                            <th className="tt-th">우선순위</th>
                            <th className="tt-th">진척도</th>
                            {customColumns.map(col => (
                                <th key={col.id} className="tt-th tt-th-custom">
                                    <span>{col.name}</span>
                                    {isManager && (
                                        <button className="tt-col-del" onClick={e => handleDeleteColumn(col.id, e)}>
                                            <IcX size={10} />
                                        </button>
                                    )}
                                </th>
                            ))}
                            {/* + 컬럼 추가 버튼 */}
                            {isManager && (
                                <th className="tt-th tt-th-add" ref={addColRef} style={{ position:'relative' }}>
                                    <button className="tt-add-col-btn" onClick={() => setShowAddCol(o => !o)}>
                                        <IcPlus size={14} />
                                    </button>
                                    {showAddCol && (
                                        <AddColumnPopup
                                            projectId={project.id}
                                            onAdded={col => setCustomColumns(prev => [...prev, col])}
                                            onClose={() => setShowAddCol(false)}
                                        />
                                    )}
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {allGroups.map(group => (
                            <TaskGroupSection
                                key={group.id ?? 'ungrouped'}
                                group={group}
                                tasks={getGroupTasks(group.id)}
                                projectId={project.id}
                                members={members}
                                myRole={myRole}
                                customColumns={customColumns}
                                onStatusChange={onStatusChange}
                                onTaskClick={onTaskClick}
                                onTaskUpdated={onTaskUpdated}
                                onTaskAdded={onTaskAdded}
                                onGroupDeleted={onGroupDeleted}
                            />
                        ))}
                    </tbody>
                </table>

                {tasks.length === 0 && !filterStatus && !search && (
                    <div className="tt-empty">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                            <path d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            <path d="M9 12h6M9 16h4"/>
                        </svg>
                        <p>업무가 없습니다. 그룹 아래 '새 업무 추가'를 눌러 시작해보세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
