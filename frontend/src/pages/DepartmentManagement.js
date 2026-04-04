import React, { useState, useEffect, useRef } from 'react';
import api from '../services/authService';
import './DepartmentManagement.css';
import { IconSettings, IconEdit, IconPlus, IconTrash } from '../components/Icons';
import { useToast } from '../components/Toast';

// 부서 소속 직원 목록 컴포넌트
function DepartmentEmployees({ departmentId }) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEmployees();
    }, [departmentId]);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/addressbook/department/${departmentId}`);
            const data = response.data.data;
            setEmployees(Array.isArray(data) ? data : (data?.employees || []));
        } catch (error) {
            console.error('직원 목록 조회 실패:', error);
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="employees-section">
                <h4>소속 직원</h4>
                <div className="loading-text">로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="employees-section">
            <h4>소속 직원 ({employees.length}명)</h4>
            {employees.length > 0 ? (
                <div className="employees-list">
                    {employees.map(emp => (
                        <div key={emp.id} className="employee-card">
                            <div className="employee-avatar">
                                {emp.name?.charAt(0) || 'U'}
                            </div>
                            <div className="employee-info">
                                <div className="employee-name">
                                    {emp.name}
                                    {emp.position && (
                                        <span className="employee-position">{emp.position}</span>
                                    )}
                                </div>
                                <div className="employee-contact">
                                    {emp.email && (
                                        <span className="contact-item">📧 {emp.email}</span>
                                    )}
                                    {emp.mobile && (
                                        <span className="contact-item">📱 {emp.mobile}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-employees">
                    <p>소속된 직원이 없습니다</p>
                </div>
            )}
        </div>
    );
}

// ============================================================
// 드래그 가능한 트리 아이템
// ============================================================
function DraggableTreeItem({ node, depth, selectedDept, onSelect, onEdit, onAddChild, onDelete, onReorder }) {
    const toast = useToast();
    const dragRef = useRef(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [dragPos, setDragPos] = useState(null); // 'top' | 'bottom'

    const handleDragStart = (e) => {
        e.stopPropagation();
        e.dataTransfer.setData('nodeId', String(node.id));
        e.dataTransfer.setData('parentId', String(node.parent_id ?? ''));
        e.dataTransfer.effectAllowed = 'move';
        dragRef.current?.classList.add('dragging');
    };

    const handleDragEnd = () => {
        dragRef.current?.classList.remove('dragging');
        setIsDragOver(false);
        setDragPos(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = dragRef.current.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        setDragPos(e.clientY < midY ? 'top' : 'bottom');
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
        setDragPos(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        setDragPos(null);
        const draggedId = parseInt(e.dataTransfer.getData('nodeId'));
        const rawParentId = e.dataTransfer.getData('parentId');
        if (draggedId === node.id) return;
        // null/undefined/빈문자 모두 같은 값으로 정규화
        const norm = (v) => (!v || v === 'null' || v === 'undefined') ? '' : String(v);
        const sameParent = norm(rawParentId) === norm(node.parent_id);
        if (!sameParent) {
            toast.warning('같은 상위 부서 내에서만 순서를 변경할 수 있습니다.');
            return;
        }
        onReorder(draggedId, node.id, dragPos === 'top');
    };

    return (
        <div
            ref={dragRef}
            className={`tree-node-wrap ${isDragOver ? `drag-over drag-over-${dragPos}` : ''}`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ paddingLeft: `${depth * 20}px` }}
        >
            <div
                className={`tree-item ${selectedDept?.id === node.id ? 'active' : ''}`}
                onClick={() => onSelect(node)}
            >
                <span className="drag-handle" title="드래그하여 순서 변경">⠿</span>
                <span className="tree-icon">
                    {node.children.length > 0 ? '📁' : '📂'}
                </span>
                <span className="tree-label">{node.name}</span>
                <span className="tree-count">({node.employee_count || 0}명)</span>
                <div className="tree-actions">
                    <button onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} title="하위 부서 추가">
                        <IconPlus size={12}/>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(node); }} title="수정">
                        <IconEdit size={12}/>
                    </button>
                    <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(node); }} title="삭제">
                        <IconTrash size={12}/>
                    </button>
                </div>
            </div>
            {node.children.length > 0 && (
                <div className="tree-children">
                    {node.children.map(child => (
                        <DraggableTreeItem
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            selectedDept={selectedDept}
                            onSelect={onSelect}
                            onEdit={onEdit}
                            onAddChild={onAddChild}
                            onDelete={onDelete}
                            onReorder={onReorder}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================
// 메인 컴포넌트
// ============================================================
function DepartmentManagement() {
    const toast = useToast();
    const [departments, setDepartments] = useState([]);
    const [tree, setTree] = useState([]);
    const [selectedDept, setSelectedDept] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingDept, setEditingDept] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({ name: '', code: '', parent_id: null, description: '' });

    useEffect(() => { fetchDepartments(); }, []);

    const fetchDepartments = async () => {
        try {
            const response = await api.get('/departments');
            setDepartments(response.data.data.departments);
            setTree(response.data.data.tree);
        } catch (error) {
            console.error('부서 목록 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    // 같은 부모 내에서 순서 변경 후 order_no 일괄 저장
    const handleReorder = async (draggedId, targetId, insertBefore) => {
        // 드래그된 노드의 부모 찾기
        const dragged = departments.find(d => d.id === draggedId);
        if (!dragged) return;

        // null/undefined 모두 같은 값으로 정규화해서 비교
        const normalize = (v) => (v === null || v === undefined || v === 0 || v === '') ? null : Number(v);
        const draggedParent = normalize(dragged.parent_id);

        // 같은 부모의 siblings를 현재 order_no 순으로 정렬
        const siblings = departments
            .filter(d => normalize(d.parent_id) === draggedParent && d.id !== draggedId)
            .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0));

        const targetIdx = siblings.findIndex(d => d.id === targetId);
        if (insertBefore) {
            siblings.splice(targetIdx, 0, dragged);
        } else {
            siblings.splice(targetIdx + 1, 0, dragged);
        }

        // 새 order_no 계산 (10단위)
        const updates = siblings.map((d, i) => ({ id: d.id, order_no: (i + 1) * 10 }));

        setSaving(true);
        try {
            await api.put('/departments/reorder', { orders: updates });
            await fetchDepartments();
        } catch (error) {
            console.error('순서 저장 실패:', error);
            toast.error('순서를 저장하지 못했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenModal = (dept = null, parentId = null) => {
        if (dept) {
            setEditingDept(dept);
            setFormData({ name: dept.name, code: dept.code || '', parent_id: dept.parent_id, description: dept.description || '' });
        } else {
            setEditingDept(null);
            setFormData({ name: '', code: '', parent_id: parentId, description: '' });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => { setShowModal(false); setEditingDept(null); };

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) { toast.warning('부서명을 입력해주세요.'); return; }
        try {
            if (editingDept) {
                await api.put(`/departments/${editingDept.id}`, formData);
            } else {
                await api.post('/departments', formData);
            }
            handleCloseModal();
            fetchDepartments();
        } catch (error) {
            toast.error(error.response?.data?.message || '부서를 저장하지 못했습니다.');
        }
    };

    const handleDelete = async (dept) => {
        const hasChildren = departments.some(d => d.parent_id === dept.id);
        if (hasChildren) { toast.warning('하위 부서가 있는 부서는 삭제할 수 없습니다.'); return; }
        if (dept.employee_count > 0) { toast.warning(`이 부서에 ${dept.employee_count}명의 직원이 소속되어 있습니다.`); return; }
        if (!window.confirm('삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        try {
            await api.delete(`/departments/${dept.id}`);
            if (selectedDept?.id === dept.id) setSelectedDept(null);
            fetchDepartments();
        } catch (error) {
            toast.error(error.response?.data?.message || '부서를 삭제하지 못했습니다.');
        }
    };

    if (loading) {
        return <div className="page-loading"><div className="spinner"></div><p>로딩 중...</p></div>;
    }

    return (
        <div className="dept-management-page">
            <div className="page-header">
                <h1><IconSettings size={20} style={{marginRight:8,verticalAlign:'middle'}}/> 부서 관리</h1>
                <div style={{display:'flex', alignItems:'center', gap:12}}>
                    {saving && <span className="saving-indicator">저장 중...</span>}
                    <button className="add-btn" onClick={() => handleOpenModal()}>
                        <IconPlus size={14} style={{marginRight:5,verticalAlign:'middle'}}/> 최상위 부서 추가
                    </button>
                </div>
            </div>

            <div className="content-wrapper">
                <div className="dept-tree-panel">
                    <h3>조직도 ({departments.length}개 부서)</h3>
                    <p className="drag-hint">⠿ 드래그하여 같은 레벨 내 순서 변경</p>
                    <div className="dept-tree">
                        {tree.map((node, idx) => (
                            <div key={node.id} className={idx > 0 ? 'root-separator' : ''}>
                                <DraggableTreeItem
                                    node={node}
                                    depth={0}
                                    selectedDept={selectedDept}
                                    onSelect={setSelectedDept}
                                    onEdit={handleOpenModal}
                                    onAddChild={(parentId) => handleOpenModal(null, parentId)}
                                    onDelete={handleDelete}
                                    onReorder={handleReorder}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="dept-detail-panel">
                    {selectedDept ? (
                        <>
                            <div className="detail-header">
                                <h3>{selectedDept.name}</h3>
                                <div className="detail-actions">
                                    <button onClick={() => handleOpenModal(null, selectedDept.id)}>
                                        <IconPlus size={12} style={{marginRight:3,verticalAlign:'middle'}}/> 하위 부서
                                    </button>
                                    <button onClick={() => handleOpenModal(selectedDept)}>
                                        <IconEdit size={12} style={{marginRight:3,verticalAlign:'middle'}}/> 수정
                                    </button>
                                    <button className="delete-btn" onClick={() => handleDelete(selectedDept)}>
                                        <IconTrash size={12} style={{marginRight:3,verticalAlign:'middle'}}/> 삭제
                                    </button>
                                </div>
                            </div>
                            <div className="detail-body">
                                <div className="info-section">
                                    <h4>부서 정보</h4>
                                    <div className="info-row"><label>부서코드</label><span>{selectedDept.code || '-'}</span></div>
                                    <div className="info-row">
                                        <label>상위부서</label>
                                        <span>{departments.find(d => d.id === selectedDept.parent_id)?.name || '없음'}</span>
                                    </div>
                                    <div className="info-row"><label>직원 수</label><span>{selectedDept.employee_count || 0}명</span></div>
                                    <div className="info-row"><label>설명</label><span>{selectedDept.description || '-'}</span></div>
                                    <div className="info-row">
                                        <label>생성일</label>
                                        <span>{new Date(selectedDept.created_at).toLocaleDateString('ko-KR')}</span>
                                    </div>
                                </div>
                                <DepartmentEmployees departmentId={selectedDept.id} />
                            </div>
                        </>
                    ) : (
                        <div className="empty-detail"><p>부서를 선택해주세요</p></div>
                    )}
                </div>
            </div>

            {showModal && (
                <>
                    <div className="modal-overlay" onClick={handleCloseModal}></div>
                    <div className="modal">
                        <div className="modal-header">
                            <h2>{editingDept ? '부서 수정' : '부서 추가'}</h2>
                            <button className="close-btn" onClick={handleCloseModal}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-body">
                            <div className="form-group">
                                <label>부서명 *</label>
                                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="예) IT팀" required />
                            </div>
                            <div className="form-group">
                                <label>부서코드</label>
                                <input type="text" name="code" value={formData.code} onChange={handleChange} placeholder="예) IT-001" />
                            </div>
                            <div className="form-group">
                                <label>상위부서</label>
                                <select name="parent_id" value={formData.parent_id || ''} onChange={handleChange}>
                                    <option value="">없음 (최상위)</option>
                                    {departments.filter(d => !editingDept || d.id !== editingDept.id).map(dept => (
                                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>설명</label>
                                <textarea name="description" value={formData.description} onChange={handleChange} placeholder="부서에 대한 설명" rows="3" />
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={handleCloseModal} className="cancel-btn">취소</button>
                                <button type="submit" className="submit-btn">{editingDept ? '수정' : '추가'}</button>
                            </div>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
}

export default DepartmentManagement;
