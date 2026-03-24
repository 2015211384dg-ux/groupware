import React, { useState, useEffect, useRef } from 'react';
import api from '../services/authService';
import { useToast } from '../components/Toast';
import './Organization.css';
import { IconSearch, IconFolder, IconFolderOpen } from '../components/Icons';
import UserAvatar from '../components/UserAvatar';

// ============================================================
// localStorage 캐시 헬퍼
// ============================================================
const CACHE_KEY = (userId) => `org_tree_order_${userId}`;

const loadOrder = (userId) => {
    try {
        const raw = localStorage.getItem(CACHE_KEY(userId));
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
};

const saveOrder = (userId, orderMap) => {
    try {
        localStorage.setItem(CACHE_KEY(userId), JSON.stringify(orderMap));
    } catch {}
};

const applyOrder = (nodes, orderMap, parentKey = 'root') => {
    const order = orderMap?.[parentKey];
    let sorted = [...nodes];
    if (order) {
        sorted.sort((a, b) => {
            const ai = order.indexOf(a.id);
            const bi = order.indexOf(b.id);
            if (ai === -1 && bi === -1) return 0;
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        });
    }
    return sorted.map(n => ({
        ...n,
        children: applyOrder(n.children || [], orderMap, String(n.id))
    }));
};

const buildOrderMap = (nodes, map = {}, parentKey = 'root') => {
    map[parentKey] = nodes.filter(Boolean).map(n => n.id);
    nodes.filter(Boolean).forEach(n => buildOrderMap(n.children || [], map, String(n.id)));
    return map;
};

const injectParentKey = (nodes, parentKey = 'root') =>
    nodes.map(n => ({
        ...n,
        _parentKey: parentKey,
        children: injectParentKey(n.children || [], String(n.id))
    }));

// ============================================================
// 드래그 가능한 트리 아이템
// ============================================================
function DraggableTreeItem({ node, depth, selectedDept, onSelect, onReorder }) {
    const ref = useRef(null);
    const toast = useToast();
    const [dragOver, setDragOver] = useState(null);

    const handleDragStart = (e) => {
        e.stopPropagation();
        e.dataTransfer.setData('nodeId', String(node.id));
        e.dataTransfer.setData('parentKey', node._parentKey);
        e.dataTransfer.effectAllowed = 'move';
        ref.current?.classList.add('dragging');
    };

    const handleDragEnd = () => {
        ref.current?.classList.remove('dragging');
        setDragOver(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = ref.current.getBoundingClientRect();
        setDragOver(e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom');
    };

    const handleDragLeave = () => setDragOver(null);

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(null);
        const draggedId = parseInt(e.dataTransfer.getData('nodeId'));
        const draggedParentKey = e.dataTransfer.getData('parentKey');
        if (draggedId === node.id) return;
        if (draggedParentKey !== node._parentKey) {
            toast.warning('같은 레벨 내에서만 순서를 변경할 수 있습니다.');
            return;
        }
        onReorder(node._parentKey, draggedId, node.id, dragOver === 'top');
    };

    return (
        <div
            ref={ref}
            className={`tree-node drag-node ${dragOver ? `drag-over-${dragOver}` : ''}`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div
                className={`tree-item depth-${depth} ${selectedDept?.id === node.id ? 'selected' : ''}`}
                onClick={() => onSelect(node)}
            >
                <span className="drag-handle">⠿</span>
                <span className="tree-icon">
                    {node.children.length > 0
                        ? <IconFolder size={16} color="#f5a623" />
                        : <IconFolderOpen size={16} color="#f5a623" />}
                </span>
                <span className="tree-label">{node.name}</span>
                <span className="tree-count">{node.employee_count}</span>
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
function Organization() {
    const [departments, setDepartments] = useState([]);
    const [rawTree, setRawTree] = useState([]);
    const [tree, setTree] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [selectedDept, setSelectedDept] = useState(null);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setUserId(payload.userId);
            }
        } catch {}
        fetchOrganization();
    }, []);

    useEffect(() => {
        if (!rawTree.length) return;
        const orderMap = userId ? loadOrder(userId) : null;
        setTree(orderMap ? applyOrder(rawTree, orderMap) : rawTree);
    }, [userId, rawTree]);

    useEffect(() => {
        filterEmployees();
    }, [selectedDept, employees, search]);

    const fetchOrganization = async () => {
        try {
            const response = await api.get('/addressbook/organization');
            setDepartments(response.data.data.departments);
            setRawTree(injectParentKey(response.data.data.tree));
            setEmployees(response.data.data.employees);
            setFilteredEmployees(response.data.data.employees);
        } catch (error) {
            console.error('조직도 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReorder = (parentKey, draggedId, targetId, insertBefore) => {
        setTree(prev => {
            const reorderLevel = (nodes, pk) => {
                if (pk === parentKey) {
                    const dragged = nodes.find(n => n.id === draggedId);
                    if (!dragged) return nodes; // 방어: 못 찾으면 그대로
                    const rest = nodes.filter(n => n.id !== draggedId);
                    const targetIdx = rest.findIndex(n => n.id === targetId);
                    if (targetIdx === -1) return nodes; // 방어: 타겟 못 찾으면 그대로
                    if (insertBefore) rest.splice(targetIdx, 0, dragged);
                    else rest.splice(targetIdx + 1, 0, dragged);
                    return rest;
                }
                return nodes.map(n => ({
                    ...n,
                    children: reorderLevel(n.children || [], String(n.id))
                }));
            };
            const newTree = reorderLevel(prev, 'root');
            if (userId) saveOrder(userId, buildOrderMap(newTree));
            return newTree;
        });
    };

    const filterEmployees = () => {
        let filtered = employees;
        if (selectedDept) {
            filtered = filtered.filter(emp => emp.department_id === selectedDept.id);
        }
        if (search) {
            filtered = filtered.filter(emp =>
                emp.name.toLowerCase().includes(search.toLowerCase()) ||
                (emp.position && emp.position.includes(search)) ||
                (emp.email && emp.email.toLowerCase().includes(search.toLowerCase()))
            );
        }
        setFilteredEmployees(filtered);
    };

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>로딩 중...</p>
            </div>
        );
    }

    return (
        <div className="organization-page">
            <div className="org-header">
                <h1>주소록</h1>
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="이름, 부서, 직급 검색"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && filterEmployees()}
                    />
                    <button onClick={filterEmployees}>
                        <IconSearch size={16} />
                        <span>검색</span>
                    </button>
                </div>
            </div>

            <div className="org-content">
                <div className="org-sidebar">
                    <div className="org-tree-header">
                        <button
                            className={`tree-all-button ${!selectedDept ? 'selected' : ''}`}
                            onClick={() => setSelectedDept(null)}
                        >
                            전체보기
                        </button>
                    </div>
                    <div className="org-tree">
                        {tree.map((node, idx) => (
                            <div key={node.id} className={idx > 0 ? 'root-separator' : ''}>
                                <DraggableTreeItem
                                    node={node}
                                    depth={0}
                                    selectedDept={selectedDept}
                                    onSelect={setSelectedDept}
                                    onReorder={handleReorder}
                                />
                            </div>
                        ))}
                        
                    </div>
                </div>

                <div className="org-main">
                    <div className="org-table-header">
                        <h2>
                            {selectedDept ? selectedDept.name : '전체 직원'}
                            <span className="count-badge">{filteredEmployees.length}</span>
                        </h2>
                    </div>

                    <table className="org-table">
                        <thead>
                            <tr>
                                <th>이름</th>
                                <th>직책/직급</th>
                                <th>부서</th>
                                <th>이메일</th>
                                <th>휴대폰</th>
                                <th>내선</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map(emp => (
                                <tr key={emp.id}>
                                    <td>
                                        <div className="employee-name">
                                            <UserAvatar name={emp.name} profileImage={emp.profile_image} size={32} />
                                            <span>{emp.name}</span>
                                        </div>
                                    </td>
                                    <td>
                                        {emp.job_title && <span className="job-title">{emp.job_title}</span>}
                                        {emp.position && <span className="position"> / {emp.position}</span>}
                                    </td>
                                    <td>{emp.department_name || '-'}</td>
                                    <td className="email">{emp.email || '-'}</td>
                                    <td>{emp.mobile || '-'}</td>
                                    <td>{emp.extension || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredEmployees.length === 0 && (
                        <div className="empty-state">
                            <p>검색 결과가 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Organization;