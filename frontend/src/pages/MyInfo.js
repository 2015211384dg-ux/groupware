import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/authService';
import { useToast } from '../components/Toast';
import './MyInfo.css';
import { IconUser, IconEdit, IconCalendar } from '../components/Icons';
import UserAvatar from '../components/UserAvatar';

// ─── 서명 패드 모달 ───────────────────────
function SignaturePad({ currentSignature, onSave, onClose }) {
    const canvasRef   = useRef(null);
    const isDrawing   = useRef(false);
    const lastPos     = useRef(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [tab, setTab]         = useState('draw'); // 'draw' | 'preview'
    const toast = useToast();

    // 캔버스 초기화
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    useEffect(() => { initCanvas(); }, [initCanvas]);

    const getPos = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        if (e.touches) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top)  * scaleY,
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top)  * scaleY,
        };
    };

    const startDraw = (e) => {
        e.preventDefault();
        isDrawing.current = true;
        lastPos.current = getPos(e, canvasRef.current);
    };

    const draw = (e) => {
        e.preventDefault();
        if (!isDrawing.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const pos = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos.current = pos;
        setIsEmpty(false);
    };

    const stopDraw = () => { isDrawing.current = false; };

    const handleClear = () => {
        initCanvas();
        setIsEmpty(true);
    };

    const handleSave = async () => {
        if (isEmpty) { toast.warning('서명을 먼저 그려주세요.'); return; }
        const canvas = canvasRef.current;
        const dataURL = canvas.toDataURL('image/png');
        try {
            setSaving(true);
            await api.put('/users/me/signature', { signature_data: dataURL });
            onSave(dataURL);
        } catch (e) {
            toast.error('서명 저장 실패');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('서명을 삭제하시겠습니까?')) return;
        try {
            await api.delete('/users/me/signature');
            onSave(null);
        } catch (e) {
            toast.error('삭제 실패');
        }
    };

    return (
        <>
            <div className="sig-overlay" onClick={onClose} />
            <div className="sig-modal">
                <div className="sig-modal-header">
                    <h3>서명 등록</h3>
                    <button onClick={onClose}>✕</button>
                </div>

                <div className="sig-tabs">
                    <button className={tab === 'draw' ? 'active' : ''} onClick={() => setTab('draw')}>직접 서명</button>
                    {currentSignature && (
                        <button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>현재 서명</button>
                    )}
                </div>

                {tab === 'draw' ? (
                    <div className="sig-draw-area">
                        <p className="sig-guide">아래 영역에 마우스(또는 터치)로 서명해주세요.</p>
                        <div className="sig-canvas-wrap">
                            <canvas
                                ref={canvasRef}
                                width={440}
                                height={180}
                                className="sig-canvas"
                                onMouseDown={startDraw}
                                onMouseMove={draw}
                                onMouseUp={stopDraw}
                                onMouseLeave={stopDraw}
                                onTouchStart={startDraw}
                                onTouchMove={draw}
                                onTouchEnd={stopDraw}
                            />
                        </div>
                        <button className="sig-clear-btn" onClick={handleClear}>지우기</button>
                    </div>
                ) : (
                    <div className="sig-preview-area">
                        <img src={currentSignature} alt="현재 서명" className="sig-preview-img" />
                    </div>
                )}

                <div className="sig-modal-footer">
                    {currentSignature && (
                        <button className="sig-delete-btn" onClick={handleDelete}>서명 삭제</button>
                    )}
                    <div style={{ flex: 1 }} />
                    <button className="sig-cancel-btn" onClick={onClose}>취소</button>
                    {tab === 'draw' && (
                        <button className="sig-save-btn" onClick={handleSave} disabled={saving || isEmpty}>
                            {saving ? '저장 중...' : '저장'}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}

// ─── 메인 MyInfo ──────────────────────────
function MyInfo({ user }) {
    const toast = useToast();
    const [userInfo, setUserInfo]   = useState(null);
    const [loading, setLoading]     = useState(true);
    const [editMode, setEditMode]   = useState(false);
    const [saving, setSaving]       = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showSignaturePad, setShowSignaturePad]   = useState(false);

    const [formData, setFormData] = useState({ phone: '', mobile: '', email: '' });
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

    useEffect(() => { fetchUserInfo(); }, []);

    // 모달 열릴 때 브라우저 뒤로가기로 닫기
    const anyModal = showPasswordModal || showSignaturePad;
    useEffect(() => {
        if (!anyModal) return;
        window.history.pushState({ modal: true }, '');
        const onPop = () => {
            setShowPasswordModal(false);
            setShowSignaturePad(false);
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [anyModal]);

    const fetchUserInfo = async () => {
        try {
            const res = await api.get('/auth/me');
            setUserInfo(res.data.user);
            setFormData({
                phone:  res.data.user.phone  || '',
                mobile: res.data.user.mobile || '',
                email:  res.data.user.email  || ''
            });
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleProfileImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const form = new FormData();
        form.append('image', file);
        try {
            const res = await api.post('/users/me/profile-image', form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUserInfo(prev => ({ ...prev, profile_image: res.data.profile_image }));
            toast.success('프로필 사진이 변경되었습니다.');
        } catch {
            toast.error('프로필 사진 업로드에 실패했습니다.');
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await api.put('/users/me', formData);
            toast.success('정보가 수정되었습니다.');
            setEditMode(false);
            fetchUserInfo();
        } catch (e) {
            toast.error(e.response?.data?.message || '정보 수정에 실패했습니다.');
        } finally { setSaving(false); }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) { toast.warning('새 비밀번호가 일치하지 않습니다.'); return; }
        if (passwordData.newPassword.length < 6) { toast.warning('비밀번호는 6자 이상이어야 합니다.'); return; }
        try {
            setSaving(true);
            await api.put('/users/change-password', { currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword });
            toast.success('비밀번호가 변경되었습니다.');
            setShowPasswordModal(false);
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (e) {
            toast.error(e.response?.data?.message || '비밀번호 변경에 실패했습니다.');
        } finally { setSaving(false); }
    };

    const handleSignatureSaved = (dataURL) => {
        setUserInfo(prev => ({ ...prev, signature_data: dataURL }));
        setShowSignaturePad(false);
        if (dataURL) toast.success('서명이 저장되었습니다.');
        else toast.success('서명이 삭제되었습니다.');
    };

    if (loading) return <div className="page-loading"><div className="spinner"/><p>로딩 중...</p></div>;
    if (!userInfo) return <div className="error-state">정보를 불러올 수 없습니다.</div>;

    return (
        <div className="myinfo-page">
            <div className="page-header">
                <h1><IconUser size={20} style={{marginRight:8,verticalAlign:'middle'}}/> 내 정보</h1>
                <div className="header-actions">
                    {!editMode ? (
                        <>
                            <button className="btn-secondary" onClick={() => setShowPasswordModal(true)}>비밀번호 변경</button>
                            <button className="btn-primary" onClick={() => setEditMode(true)}><IconEdit size={14} style={{marginRight:5,verticalAlign:'middle'}}/> 정보 수정</button>
                        </>
                    ) : (
                        <>
                            <button className="btn-cancel" onClick={() => { setEditMode(false); setFormData({ phone: userInfo.phone||'', mobile: userInfo.mobile||'', email: userInfo.email||'' }); }}>취소</button>
                            <button className="btn-save" onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '💾 저장'}</button>
                        </>
                    )}
                </div>
            </div>

            <div className="info-container">
                {/* 프로필 카드 */}
                <div className="profile-card">
                    <div className="profile-avatar-wrap">
                        <UserAvatar name={userInfo.name} profileImage={userInfo.profile_image} size={90} />
                        <label className="profile-avatar-edit" title="사진 변경">
                            <IconEdit size={14} />
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfileImageChange} />
                        </label>
                    </div>
                    <h2 className="profile-name">{userInfo.name}</h2>
                    <p className="profile-email">{formData.email}</p>
                    {userInfo.position     && <p className="profile-position">{userInfo.position}</p>}
                    {userInfo.department_name && <p className="profile-department">{userInfo.department_name}</p>}
                </div>

                {/* 기본 정보 */}
                <div className="info-section">
                    <h3 className="section-title">기본 정보</h3>
                    <div className="info-grid">
                        {[
                            { label: '사번',  value: userInfo.employee_number },
                            { label: '이름',  value: userInfo.name },
                            { label: '부서',  value: userInfo.department_name },
                            { label: '직급',  value: userInfo.position },
                            { label: '직책',  value: userInfo.job_title },
                        ].map(({ label, value }) => (
                            <div className="info-item" key={label}>
                                <label>{label}</label>
                                <span>{value || '-'}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 연락처 */}
                <div className="info-section">
                    <h3 className="section-title">연락처 정보</h3>
                    <div className="info-grid">
                        {[
                            { label: '이메일', field: 'email', type: 'email', placeholder: '' },
                            { label: '전화번호', field: 'phone', type: 'tel', placeholder: '02-1234-5678' },
                            { label: '휴대폰', field: 'mobile', type: 'tel', placeholder: '010-1234-5678' },
                        ].map(({ label, field, type, placeholder }) => (
                            <div className="info-item" key={field}>
                                <label>{label}</label>
                                {editMode
                                    ? <input type={type} value={formData[field]} onChange={e => handleChange(field, e.target.value)} placeholder={placeholder} className="edit-input" />
                                    : <span>{formData[field] || '-'}</span>
                                }
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── 서명 섹션 ── */}
                <div className="info-section">
                    <div className="section-title-row">
                        <h3 className="section-title">결재 서명</h3>
                        <button className="sig-edit-btn" onClick={() => setShowSignaturePad(true)}>
                            {userInfo.signature_data ? '서명 변경' : '서명 등록'}
                        </button>
                    </div>

                    {userInfo.signature_data ? (
                        <div className="sig-display-wrap">
                            <div className="sig-display-box">
                                <img src={userInfo.signature_data} alt="내 서명" className="sig-display-img" />
                            </div>
                            <p className="sig-display-guide">결재 문서에 위 서명이 표시됩니다.</p>
                        </div>
                    ) : (
                        <div className="sig-empty-wrap" onClick={() => setShowSignaturePad(true)}>
                            
                            <span className="sig-empty-text">서명을 등록해주세요.</span>
                            <span className="sig-empty-sub">결재 승인/반려 시 서명이 표시됩니다.</span>
                        </div>
                    )}
                </div>

                {/* 계정 정보 */}
                <div className="info-section">
                    <h3 className="section-title">계정 정보</h3>
                    <div className="info-grid">
                        <div className="info-item"><label>사용자 ID</label><span>{userInfo.username}</span></div>
                        <div className="info-item"><label>권한</label>
                            <span className="role-badge">
                                {userInfo.role === 'SUPER_ADMIN' && '슈퍼관리자'}
                                {userInfo.role === 'ADMIN' && '관리자'}
                                {userInfo.role === 'HR_ADMIN' && 'HR관리자'}
                                {userInfo.role === 'USER' && '일반사용자'}
                                {userInfo.role === 'admin' && '관리자'}
                                {userInfo.role === 'user' && '일반사용자'}
                            </span>
                        </div>
                        <div className="info-item"><label>가입일</label><span>{userInfo.created_at ? new Date(userInfo.created_at).toLocaleDateString('ko-KR') : '-'}</span></div>
                    </div>
                </div>

                {/* 근태 관리 */}
                <div className="info-section">
                    <h3 className="section-title">근태 관리</h3>
                    <div className="external-links">
                        <a href="https://shiftee.io/ko/accounts/login" target="_blank" rel="noopener noreferrer" className="external-link-card">
                            <div className="link-icon"><IconCalendar size={22}/></div>
                            <div className="link-info"><h4>Shiftee 근태 관리</h4><p>출퇴근 기록, 연차 신청, 근무 일정 관리</p></div>
                            <div className="link-arrow">→</div>
                        </a>
                    </div>
                </div>
            </div>

            {/* 서명 패드 모달 */}
            {showSignaturePad && (
                <SignaturePad
                    currentSignature={userInfo.signature_data}
                    onSave={handleSignatureSaved}
                    onClose={() => setShowSignaturePad(false)}
                />
            )}

            {/* 비밀번호 변경 모달 */}
            {showPasswordModal && (
                <>
                    <div className="modal-overlay" onClick={() => setShowPasswordModal(false)} />
                    <div className="modal">
                        <div className="modal-header">
                            <h2>비밀번호 변경</h2>
                            <button className="close-btn" onClick={() => setShowPasswordModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handlePasswordSubmit} className="modal-body">
                            {[
                                { label: '현재 비밀번호', field: 'currentPassword' },
                                { label: '새 비밀번호',   field: 'newPassword', hint: '최소 6자 이상' },
                                { label: '새 비밀번호 확인', field: 'confirmPassword' },
                            ].map(({ label, field, hint }) => (
                                <div className="form-group" key={field}>
                                    <label>{label}</label>
                                    <input type="password" value={passwordData[field]}
                                        onChange={e => setPasswordData(prev => ({ ...prev, [field]: e.target.value }))}
                                        required minLength={field === 'newPassword' ? 6 : undefined} />
                                    {hint && <span className="help-text">{hint}</span>}
                                </div>
                            ))}
                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={() => setShowPasswordModal(false)}>취소</button>
                                <button type="submit" className="submit-btn" disabled={saving}>{saving ? '변경 중...' : '변경'}</button>
                            </div>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
}

export default MyInfo;
