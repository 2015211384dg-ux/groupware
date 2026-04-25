import React, { useState, useEffect } from 'react';
import api from '../services/authService';
import UserModal from '../components/common/UserModal';
import './UserManagement.css';
import { IconSettings, IconSearch, IconPlus, IconEdit, IconUnlock, IconX } from '../components/common/Icons';
import UserAvatar from '../components/common/UserAvatar';

function UserManagement({ currentUser }) {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 20 });
    
    // 모달 관련
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, [pagination.page]);

    useEffect(() => {
        filterUsersList();
    }, [users, search, filterRole, filterStatus]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/users', {
                params: {
                    page: pagination.page,
                    limit: pagination.limit,
                    search
                }
            });
            setUsers(response.data.data.users);
            setPagination(prev => ({
                ...prev,
                total: response.data.data.pagination.total,
                totalPages: response.data.data.pagination.totalPages
            }));
        } catch (error) {
            console.error('사용자 목록 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterUsersList = () => {
        let filtered = users;

        if (search) {
            filtered = filtered.filter(user =>
                user.name?.toLowerCase().includes(search.toLowerCase()) ||
                user.username?.toLowerCase().includes(search.toLowerCase()) ||
                user.email?.toLowerCase().includes(search.toLowerCase())
            );
        }

        if (filterRole !== 'all') {
            filtered = filtered.filter(user => user.role === filterRole);
        }

        if (filterStatus !== 'all') {
            filtered = filtered.filter(user => 
                filterStatus === 'active' ? user.is_active : !user.is_active
            );
        }

        setFilteredUsers(filtered);
    };

    const getRoleName = (role) => {
        const roles = {
            'SUPER_ADMIN': '시스템 관리자 (IT)',
            'HR_ADMIN': '인사 담당자',
            'DEPT_ADMIN': '부서 관리자',
            'USER': '일반 사용자'
        };
        return roles[role] || role;
    };

    const isLocked = (user) => {
        return user.locked_until && new Date(user.locked_until) > new Date();
    };

    const handleDeactivate = async (user) => {
        if (!window.confirm(`${user.name} 계정을 비활성화하시겠습니까?\n비활성화된 계정은 로그인이 차단됩니다.`)) return;
        try {
            await api.patch(`/users/${user.id}/deactivate`);
            setUsers(prev => prev.map(u =>
                u.id === user.id ? { ...u, is_active: false } : u
            ));
            alert(`${user.name} 계정이 비활성화되었습니다.`);
        } catch (err) {
            alert(err.response?.data?.message || '비활성화에 실패했습니다.');
        }
    };

    const handleUnlock = async (user) => {
        if (!window.confirm(`${user.name} 계정의 잠금을 해제하시겠습니까?`)) return;
        try {
            await api.post(`/users/${user.id}/unlock`);
            // 즉시 로컬 상태 업데이트
            const now = new Date().toISOString();
            setUsers(prev => prev.map(u =>
                u.id === user.id ? { ...u, locked_until: null, login_fail_count: 0 } : u
            ));
            alert(`${user.name} 계정의 잠금이 해제되었습니다.`);
        } catch {
            alert('잠금 해제에 실패했습니다.');
        }
    };

    const getRoleBadgeColor = (role) => {
        const colors = {
            'SUPER_ADMIN': 'badge-red',
            'HR_ADMIN': 'badge-orange',
            'DEPT_ADMIN': 'badge-blue',
            'USER': 'badge-gray'
        };
        return colors[role] || 'badge-gray';
    };

    if (loading && users.length === 0) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>로딩 중...</p>
            </div>
        );
    }

    return (
        <div className="user-management-page">
                
            <div className="page-header">
                <div className="header-left">
                    <h1><IconSettings size={20} style={{marginRight:8,verticalAlign:'middle'}}/> 사용자 관리</h1>
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="이름, 아이디, 이메일 검색"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button><IconSearch size={16}/></button>
                    </div>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => {
                        setSelectedUser(null);
                        setIsModalOpen(true);
                    }}
                >
                    <IconPlus size={15} style={{marginRight:6,verticalAlign:'middle'}}/> 사용자 등록
                </button>
            </div>

            <div className="content-container">
                {/* 필터 */}
                <div className="filter-bar">
                    <div className="filter-group">
                        <label>권한</label>
                        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                            <option value="all">전체</option>
                            <option value="SUPER_ADMIN">시스템 관리자 (IT)</option>
                            <option value="HR_ADMIN">인사 담당자</option>
                            <option value="DEPT_ADMIN">부서 관리자</option>
                            <option value="USER">일반 사용자</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>상태</label>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="all">전체</option>
                            <option value="active">활성</option>
                            <option value="inactive">비활성</option>
                        </select>
                    </div>
                    <div className="stats">
                        <span>전체 {filteredUsers.length}명</span>
                    </div>
                </div>

                {/* 사용자 테이블 */}
                <div className="table-container">
                    <table className="users-table">
                        <thead>
                            <tr>
                                {/* <th style={{width: '80px'}}>사번</th> */}
                                <th style={{width: '130px'}}>이름</th>
                                <th style={{width: '100px'}}>아이디</th>
                                <th>이메일</th>
                                <th style={{width: '110px'}}>부서</th>
                                <th style={{width: '80px'}}>직급</th>
                                <th style={{width: '110px'}}>권한</th>
                                <th style={{width: '90px'}}>상태</th>
                                <th style={{width: '120px'}}>마지막 로그인</th>
                                <th style={{width: '72px', textAlign: 'center'}}>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr key={user.id}>
                                    {/* <td>{user.employee_number || '-'}</td> */}
                                    <td>
                                        <div className="user-cell">
                                            <UserAvatar name={user.name} profileImage={user.profile_image} size={34} />
                                            <span className="user-name">{user.name}</span>
                                        </div>
                                    </td>
                                    <td>{user.username}</td>
                                    <td className="email-cell">{user.email}</td>
                                    <td>{user.department_name || '-'}</td>
                                    <td>{user.position || '-'}</td>
                                    <td>
                                        <span className={`role-badge ${getRoleBadgeColor(user.role)}`}>
                                            {getRoleName(user.role)}
                                        </span>
                                    </td>
                                    <td>
                                        {isLocked(user) ? (
                                            <span className="status-badge status-locked">잠금</span>
                                        ) : (
                                            <span className={`status-badge ${user.is_active ? 'status-active' : 'status-inactive'}`}>
                                                {user.is_active ? '활성' : '비활성'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="date-cell">
                                        {user.last_login 
                                            ? new Date(user.last_login).toLocaleString('ko-KR', {
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                            : '-'
                                        }
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            {isLocked(user) && (
                                                <button
                                                    className="btn-icon btn-icon-unlock"
                                                    onClick={() => handleUnlock(user)}
                                                    title="잠금 해제"
                                                >
                                                    <IconUnlock size={15} />
                                                </button>
                                            )}
                                            <button
                                                className="btn-icon btn-icon-edit"
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    setIsModalOpen(true);
                                                }}
                                                title="수정"
                                            >
                                                <IconEdit size={15} />
                                            </button>
                                            {currentUser?.role === 'SUPER_ADMIN' && user.id !== currentUser.id && user.is_active && (
                                                <button
                                                    className="btn-icon btn-icon-deactivate"
                                                    onClick={() => handleDeactivate(user)}
                                                    title="비활성화"
                                                >
                                                    <IconX size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredUsers.length === 0 && (
                        <div className="empty-state">
                            <p>검색 결과가 없습니다.</p>
                        </div>
                    )}
                </div>

                {/* 페이지네이션 */}
                {pagination.totalPages > 1 && (
                    <div className="pagination">
                        <button
                            disabled={pagination.page === 1}
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        >
                            ←
                        </button>
                        <span className="page-info">
                            {pagination.page} / {pagination.totalPages}
                        </span>
                        <button
                            disabled={pagination.page === pagination.totalPages}
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        >
                            →
                        </button>
                    </div>
                )}
            </div>

            {/* 사용자 등록/수정 모달 */}
            <UserModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedUser(null);
                }}
                user={selectedUser}
                currentUser={currentUser}
                onSuccess={fetchUsers}
            />
        </div>
    );
}

export default UserManagement;
