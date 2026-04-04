import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/authService';
import { useToast } from '../components/Toast';
import './PersonalContacts.css';

function PersonalContacts() {
    const toast = useToast();
    const [contacts, setContacts] = useState([]);
    const [filteredContacts, setFilteredContacts] = useState([]);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        company: '',
        department: '',
        position: '',
        phone: '',
        email: '',
        tags: '',
        memo: ''
    });

    useEffect(() => {
        fetchContacts();
    }, []);

    useEffect(() => {
        filterContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contacts, search]);

    // 모달 열릴 때 브라우저 뒤로가기로 닫기 (item 7)
    useEffect(() => {
        if (!showModal) return;
        window.history.pushState({ modal: true }, '');
        const onPop = () => setShowModal(false);
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [showModal]);

    const fetchContacts = async () => {
        try {
            const response = await api.get('/addressbook/personal');
            setContacts(response.data.data);
            setFilteredContacts(response.data.data);
        } catch (error) {
            console.error('개인 주소록 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterContacts = () => {
        if (!search) {
            setFilteredContacts(contacts);
            return;
        }

        const filtered = contacts.filter(contact =>
            contact.name.toLowerCase().includes(search.toLowerCase()) ||
            (contact.company && contact.company.toLowerCase().includes(search.toLowerCase())) ||
            (contact.phone && contact.phone.includes(search))
        );
        setFilteredContacts(filtered);
    };

    const handleOpenModal = (contact = null) => {
        if (contact) {
            setEditingContact(contact);
            setFormData({
                name: contact.name || '',
                company: contact.company || '',
                department: contact.department || '',
                position: contact.position || '',
                phone: contact.phone || '',
                email: contact.email || '',
                tags: contact.tags || '',
                memo: contact.memo || ''
            });
        } else {
            setEditingContact(null);
            setFormData({
                name: '',
                company: '',
                department: '',
                position: '',
                phone: '',
                email: '',
                tags: '',
                memo: ''
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = useCallback(() => {
        setShowModal(false);
        setEditingContact(null);
    }, []);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.warning('이름을 입력해주세요.');
            return;
        }

        try {
            if (editingContact) {
                await api.put(`/addressbook/personal/${editingContact.id}`, formData);
                toast.success('연락처가 수정되었습니다.');
            } else {
                await api.post('/addressbook/personal', formData);
                toast.success('연락처가 추가되었습니다.');
            }
            handleCloseModal();
            fetchContacts();
        } catch (error) {
            console.error('연락처 저장 실패:', error);
            toast.error('연락처를 저장하지 못했습니다.');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('연락처를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        try {
            await api.delete(`/addressbook/personal/${id}`);
            toast.success('연락처가 삭제되었습니다.');
            fetchContacts();
        } catch (error) {
            console.error('연락처 삭제 실패:', error);
            toast.error('연락처를 삭제하지 못했습니다.');
        }
    };

    const handleToggleFavorite = async (id) => {
        try {
            await api.put(`/addressbook/personal/${id}/favorite`);
            fetchContacts();
        } catch (error) {
            console.error('즐겨찾기 처리 실패:', error);
        }
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
        <div className="personal-contacts-page">
            <div className="contacts-header">
                <h1>개인 주소록</h1>
                <div className="header-actions">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="이름, 회사, 전화번호 검색"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button>🔍</button>
                    </div>
                    <button className="add-btn" onClick={() => handleOpenModal()}>
                        ➕ 연락처 추가
                    </button>
                </div>
            </div>

            <div className="contacts-container">
                <div className="contacts-stats">
                    <span>전체 {filteredContacts.length}명</span>
                    <span>즐겨찾기 {filteredContacts.filter(c => c.is_favorite).length}명</span>
                </div>

                <div className="contacts-grid">
                    {filteredContacts.map(contact => (
                        <div key={contact.id} className="contact-card">
                            <div className="card-header">
                                <button
                                    className={`favorite-btn ${contact.is_favorite ? 'active' : ''}`}
                                    onClick={() => handleToggleFavorite(contact.id)}
                                >
                                    {contact.is_favorite ? '⭐' : '☆'}
                                </button>
                                <div className="card-actions">
                                    <button onClick={() => handleOpenModal(contact)}>✏️</button>
                                    <button onClick={() => handleDelete(contact.id)}>🗑️</button>
                                </div>
                            </div>

                            <div className="card-body">
                                <div className="contact-avatar">
                                    {contact.name.charAt(0)}
                                </div>
                                <h3 className="contact-name">{contact.name}</h3>

                                {contact.company && (
                                    <p className="contact-company">
                                        🏢 {contact.company}
                                        {contact.department && ` / ${contact.department}`}
                                    </p>
                                )}

                                {contact.position && (
                                    <p className="contact-position">👤 {contact.position}</p>
                                )}

                                {contact.phone && (
                                    <p className="contact-info">📱 {contact.phone}</p>
                                )}

                                {contact.email && (
                                    <p className="contact-info">📧 {contact.email}</p>
                                )}

                                {contact.tags && (
                                    <div className="contact-tags">
                                        {contact.tags.split(',').map((tag, idx) => (
                                            <span key={idx} className="tag">{tag.trim()}</span>
                                        ))}
                                    </div>
                                )}

                                {contact.memo && (
                                    <p className="contact-memo">💬 {contact.memo}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {filteredContacts.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon">📇</div>
                        <p>{search ? '검색 결과가 없습니다.' : '등록된 연락처가 없습니다.'}</p>
                        {!search && (
                            <button className="empty-add-btn" onClick={() => handleOpenModal()}>
                                첫 연락처 추가하기
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* 모달 */}
            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingContact ? '연락처 수정' : '연락처 추가'}</h2>
                            <button className="close-btn" onClick={handleCloseModal}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="contact-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="required">이름</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="홍길동"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>회사</label>
                                    <input
                                        type="text"
                                        name="company"
                                        value={formData.company}
                                        onChange={handleChange}
                                        placeholder="ABC 회사"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>부서</label>
                                    <input
                                        type="text"
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        placeholder="영업팀"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>직책</label>
                                    <input
                                        type="text"
                                        name="position"
                                        value={formData.position}
                                        onChange={handleChange}
                                        placeholder="과장"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>전화번호</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="010-1234-5678"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>이메일</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="example@email.com"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>태그</label>
                                <input
                                    type="text"
                                    name="tags"
                                    value={formData.tags}
                                    onChange={handleChange}
                                    placeholder="거래처, 협력사 (쉼표로 구분)"
                                />
                            </div>

                            <div className="form-group">
                                <label>메모</label>
                                <textarea
                                    name="memo"
                                    value={formData.memo}
                                    onChange={handleChange}
                                    placeholder="추가 메모"
                                    rows="3"
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={handleCloseModal}>
                                    취소
                                </button>
                                <button type="submit" className="submit-btn">
                                    {editingContact ? '수정' : '추가'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PersonalContacts;
