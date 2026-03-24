import React, { useState, useEffect } from 'react';
import api from '../services/authService';
import './AddressBook.css';
import { IconSearch, IconUser } from '../components/Icons';
import UserAvatar from '../components/UserAvatar';

const ALPHA = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split('');

function getInitial(name = '') {
    const code = name.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return name.charAt(0).toUpperCase();
    const initials = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    return initials[Math.floor(code / 588)];
}

function AddressBook() {
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [search, setSearch] = useState('');
    const [filterDept, setFilterDept] = useState('all');
    const [sortBy, setSortBy] = useState('name'); // 'name' | 'dept'
    const [loading, setLoading] = useState(true);
    const [activeAlpha, setActiveAlpha] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/addressbook/organization');
            setEmployees(res.data.data.employees);
            setDepartments(res.data.data.departments);
        } catch (e) {
            console.error('주소록 조회 실패:', e);
        } finally {
            setLoading(false);
        }
    };

    const filtered = employees.filter(emp => {
        const matchSearch = !search ||
            emp.name?.includes(search) ||
            emp.email?.toLowerCase().includes(search.toLowerCase()) ||
            emp.mobile?.includes(search) ||
            emp.department_name?.includes(search) ||
            emp.position?.includes(search);
        const matchDept = filterDept === 'all' || String(emp.department_id) === filterDept;
        const matchAlpha = !activeAlpha || getInitial(emp.name) === activeAlpha;
        return matchSearch && matchDept && matchAlpha;
    });

    const sorted = [...filtered].sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'ko');
        return (a.department_name || '').localeCompare(b.department_name || '', 'ko') ||
               (a.name || '').localeCompare(b.name || '', 'ko');
    });

    if (loading) return (
        <div className="page-loading">
            <div className="spinner"></div>
            <p>로딩 중...</p>
        </div>
    );

    return (
        <div className="addressbook-page">
            {/* 헤더 */}
            <div className="ab-header">
                <div className="ab-header-left">
                    <h1><IconUser size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />전체 주소록</h1>
                    <span className="ab-total">{filtered.length}명</span>
                </div>
                <div className="ab-header-right">
                    <div className="ab-search">
                        <IconSearch size={15} />
                        <input
                            type="text"
                            placeholder="이름, 부서, 이메일, 연락처 검색"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setActiveAlpha(null); }}
                        />
                    </div>
                    <select value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                        <option value="all">전체 부서</option>
                        {departments.map(d => (
                            <option key={d.id} value={String(d.id)}>{d.name}</option>
                        ))}
                    </select>
                    <div className="ab-sort">
                        <button className={sortBy === 'name' ? 'active' : ''} onClick={() => setSortBy('name')}>이름순</button>
                        <button className={sortBy === 'dept' ? 'active' : ''} onClick={() => setSortBy('dept')}>부서순</button>
                    </div>
                </div>
            </div>

            {/* 초성 필터 */}
            <div className="ab-alpha-bar">
                <button
                    className={!activeAlpha ? 'active' : ''}
                    onClick={() => setActiveAlpha(null)}
                >전체</button>
                {ALPHA.map(ch => (
                    <button
                        key={ch}
                        className={activeAlpha === ch ? 'active' : ''}
                        onClick={() => setActiveAlpha(prev => prev === ch ? null : ch)}
                    >{ch}</button>
                ))}
            </div>

            {/* 카드 그리드 */}
            <div className="ab-content">
                {sorted.length === 0 ? (
                    <div className="ab-empty">
                        <IconUser size={40} />
                        <p>검색 결과가 없습니다.</p>
                    </div>
                ) : (
                    <div className="ab-grid">
                        {sorted.map(emp => (
                            <div key={emp.id} className="ab-card">
                                <div className="ab-card-avatar">
                                    <UserAvatar name={emp.name} profileImage={emp.profile_image} size={56} />
                                </div>
                                <div className="ab-card-info">
                                    <div className="ab-card-name">{emp.name}</div>
                                    <div className="ab-card-meta">
                                        {emp.department_name && <span className="ab-dept">{emp.department_name}</span>}
                                        {emp.position && <span className="ab-position">{emp.position}</span>}
                                    </div>
                                    <div className="ab-card-contacts">
                                        {emp.email && (
                                            <a href={`mailto:${emp.email}`} className="ab-contact-item">
                                                <span className="ab-contact-label">이메일</span>
                                                <span className="ab-contact-value">{emp.email}</span>
                                            </a>
                                        )}
                                        {emp.mobile && (
                                            <a href={`tel:${emp.mobile}`} className="ab-contact-item">
                                                <span className="ab-contact-label">휴대폰</span>
                                                <span className="ab-contact-value">{emp.mobile}</span>
                                            </a>
                                        )}
                                        {emp.extension && (
                                            <div className="ab-contact-item">
                                                <span className="ab-contact-label">내선</span>
                                                <span className="ab-contact-value">{emp.extension}</span>
                                            </div>
                                        )}
                                        {!emp.email && !emp.mobile && !emp.extension && (
                                            <span className="ab-no-contact">연락처 없음</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default AddressBook;
