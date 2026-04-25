import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MemberModal.css';
import api from '../../services/api';
import { useToast } from '../common/Toast';
import { useConfirm } from '../common/Confirm';
import { IconX, IconSearch, IconTrash } from '../common/Icons';

const ROLE_KO  = { owner: '소유자', manager: '관리자', member: '멤버', viewer: '뷰어' };
const ROLE_OPT = ['manager', 'member', 'viewer'];

export default function MemberModal({ projectId, myRole, onClose, onUpdated }) {
    const toast   = useToast();
    const confirm = useConfirm();
    const [activeTab, setActiveTab]  = useState('members'); // 'members' | 'requests'
    const [members, setMembers]      = useState([]);
    const [requests, setRequests]    = useState([]);
    const [query, setQuery]          = useState('');
    const [results, setResults]      = useState([]);
    const [searching, setSearching]  = useState(false);
    const [inviteRole, setInviteRole] = useState('member');
    const debounceRef = useRef(null);

    const isManager = ['owner', 'manager'].includes(myRole);

    const fetchMembers = useCallback(async () => {
        const res = await api.get(`/projects/${projectId}/members`);
        setMembers(res.data.members || []);
    }, [projectId]);

    const fetchRequests = useCallback(async () => {
        if (!isManager) return;
        try {
            const res = await api.get(`/projects/${projectId}/join-requests`);
            setRequests(res.data.requests || []);
        } catch { setRequests([]); }
    }, [projectId, isManager]);

    useEffect(() => { fetchMembers(); fetchRequests(); }, [fetchMembers, fetchRequests]);

    useEffect(() => {
        clearTimeout(debounceRef.current);
        if (!query.trim()) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await api.get(`/projects/${projectId}/members/search?q=${encodeURIComponent(query)}`);
                setResults(res.data.users || []);
            } catch { setResults([]); }
            finally { setSearching(false); }
        }, 300);
    }, [query, projectId]);

    const handleInvite = async (user) => {
        try {
            await api.post(`/projects/${projectId}/members`, { user_id: user.id, role: inviteRole });
            toast.success(`${user.name}님을 초대했습니다.`);
            setQuery('');
            setResults([]);
            fetchMembers();
            onUpdated?.();
        } catch (err) {
            toast.error(err.response?.data?.message || '초대 실패');
        }
    };

    const handleRoleChange = async (member, role) => {
        try {
            await api.patch(`/projects/${projectId}/members/${member.user_id}/role`, { role });
            setMembers(prev => prev.map(m => m.user_id === member.user_id ? { ...m, role } : m));
        } catch (err) {
            toast.error(err.response?.data?.message || '역할 변경 실패');
        }
    };

    const handleRequest = async (req, action) => {
        try {
            await api.patch(`/projects/${projectId}/join-requests/${req.id}`, { action });
            setRequests(prev => prev.filter(r => r.id !== req.id));
            if (action === 'approve') {
                toast.success(`${req.name}님의 참여를 승인했습니다.`);
                fetchMembers();
                onUpdated?.();
            } else {
                toast.info(`${req.name}님의 요청을 거절했습니다.`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || '처리 실패');
        }
    };

    const handleRemove = async (member) => {
        const ok = await confirm(`${member.name}님을 프로젝트에서 내보낼까요?`, { confirmText: '내보내기', danger: true });
        if (!ok) return;
        try {
            await api.delete(`/projects/${projectId}/members/${member.user_id}`);
            setMembers(prev => prev.filter(m => m.user_id !== member.user_id));
            onUpdated?.();
        } catch (err) {
            toast.error(err.response?.data?.message || '제거 실패');
        }
    };

    return (
        <div className="mm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="mm-box">
                <div className="mm-header">
                    <span className="mm-title">멤버 관리</span>
                    <button className="mm-close" onClick={onClose}><IconX size={16} /></button>
                </div>

                {/* 내부 탭 */}
                {isManager && (
                    <div className="mm-inner-tabs">
                        <button
                            className={`mm-inner-tab ${activeTab === 'members' ? 'active' : ''}`}
                            onClick={() => setActiveTab('members')}
                        >
                            멤버 {members.length}명
                        </button>
                        <button
                            className={`mm-inner-tab ${activeTab === 'requests' ? 'active' : ''}`}
                            onClick={() => setActiveTab('requests')}
                        >
                            참여 요청
                            {requests.length > 0 && (
                                <span className="mm-req-badge">{requests.length}</span>
                            )}
                        </button>
                    </div>
                )}

                {/* 검색 (멤버 탭에서만) */}
                {isManager && activeTab === 'members' && (
                    <div className="mm-invite-section">
                        <div className="mm-search-row">
                            <div className="mm-search-wrap">
                                <IconSearch size={14} />
                                <input
                                    className="mm-search-input"
                                    placeholder="이름, 이메일로 검색..."
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                />
                            </div>
                            <select
                                className="mm-role-select"
                                value={inviteRole}
                                onChange={e => setInviteRole(e.target.value)}
                            >
                                {ROLE_OPT.map(r => <option key={r} value={r}>{ROLE_KO[r]}</option>)}
                            </select>
                        </div>

                        {/* 검색 결과 */}
                        {(results.length > 0 || searching) && (
                            <div className="mm-search-results">
                                {searching && <div className="mm-searching">검색 중...</div>}
                                {results.map(u => (
                                    <div key={u.id} className="mm-result-item">
                                        <div className="mm-result-avatar">{u.name?.[0]}</div>
                                        <div className="mm-result-info">
                                            <span className="mm-result-name">{u.name}</span>
                                            <span className="mm-result-sub">{u.department_name} · {u.position}</span>
                                        </div>
                                        {u.is_member ? (
                                            <span className="mm-already">이미 멤버</span>
                                        ) : (
                                            <button className="mm-invite-btn" onClick={() => handleInvite(u)}>
                                                초대
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 참여 요청 탭 */}
                {activeTab === 'requests' && (
                    <div className="mm-member-list">
                        {requests.length === 0 ? (
                            <div className="mm-empty">대기 중인 참여 요청이 없습니다.</div>
                        ) : requests.map(r => (
                            <div key={r.id} className="mm-member-item">
                                <div className="mm-member-avatar">{r.name?.[0]}</div>
                                <div className="mm-member-info">
                                    <span className="mm-member-name">{r.name}</span>
                                    <span className="mm-member-sub">{r.department_name} · {r.position}</span>
                                </div>
                                <button className="mm-approve-btn" onClick={() => handleRequest(r, 'approve')}>승인</button>
                                <button className="mm-reject-btn" onClick={() => handleRequest(r, 'reject')}>거절</button>
                            </div>
                        ))}
                    </div>
                )}

                {/* 현재 멤버 목록 */}
                {(!isManager || activeTab === 'members') && (
                <div className="mm-member-list">
                    <div className="mm-section-label">멤버 {members.length}명</div>
                    {members.map(m => (
                        <div key={m.user_id} className="mm-member-item">
                            <div className="mm-member-avatar">{m.name?.[0]}</div>
                            <div className="mm-member-info">
                                <span className="mm-member-name">{m.name}</span>
                                <span className="mm-member-sub">{m.department_name || ''}</span>
                            </div>
                            {isManager && m.role !== 'owner' ? (
                                <select
                                    className="mm-member-role-select"
                                    value={m.role}
                                    onChange={e => handleRoleChange(m, e.target.value)}
                                >
                                    {ROLE_OPT.map(r => <option key={r} value={r}>{ROLE_KO[r]}</option>)}
                                </select>
                            ) : (
                                <span className={`mm-role-badge role-${m.role}`}>{ROLE_KO[m.role]}</span>
                            )}
                            {isManager && m.role !== 'owner' && (
                                <button className="mm-remove-btn" onClick={() => handleRemove(m)} title="내보내기">
                                    <IconTrash size={13} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                )}
            </div>
        </div>
    );
}
