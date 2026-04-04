import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/authService';
import { useSettings } from '../services/SettingsContext';
import { useToast } from '../components/Toast';
import { IconInfo, IconAlertTriangle, IconAlertCircle, IconCheckCircle, IconPlus, IconEdit, IconTrash, IconMegaphone } from '../components/Icons';
import './Settings.css';

const LOG_ICONS = {
    info:    <IconInfo size={16} />,
    warning: <IconAlertTriangle size={16} />,
    error:   <IconAlertCircle size={16} />,
    success: <IconCheckCircle size={16} />,
};
const LOG_TYPE_LABELS = { info: '정보', warning: '경고', error: '오류', success: '성공' };

function Settings() {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('general');
    const [settings, setSettings] = useState(null);
    const [logs, setLogs] = useState([]);
    const [logFilter, setLogFilter] = useState('');
    const [logSearch, setLogSearch] = useState('');
    const [logUserSearch, setLogUserSearch] = useState('');
    const [logUserInput, setLogUserInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const { updateSettings } = useSettings();

    // 팝업 공지 관리
    const [notices, setNotices] = useState([]);
    const [noticeLoading, setNoticeLoading] = useState(false);
    const [editingNotice, setEditingNotice] = useState(null); // null or notice obj
    const [showAddForm, setShowAddForm] = useState(false);
    const [noticeForm, setNoticeForm] = useState({ title: '', content: '' });

    useEffect(() => { fetchSettings(); }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/admin/settings');
            setSettings(res.data.data);
            updateSettings(res.data.data);
        } catch {
            toast.error('설정을 불러오는데 실패했습니다.');
        } finally {
            setInitialLoading(false);
        }
    };

    const fetchNotices = useCallback(async () => {
        try {
            setNoticeLoading(true);
            const res = await api.get('/admin/settings/notices');
            setNotices(res.data.data);
        } catch {
            toast.error('공지 목록 조회에 실패했습니다.');
        } finally {
            setNoticeLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'notice') fetchNotices();
    }, [activeTab, fetchNotices]);

    const handleAddNotice = async () => {
        if (!noticeForm.title.trim()) { toast.error('제목을 입력해주세요.'); return; }
        try {
            await api.post('/admin/settings/notices', noticeForm);
            toast.success('공지가 추가되었습니다.');
            setNoticeForm({ title: '', content: '' });
            setShowAddForm(false);
            fetchNotices();
        } catch { toast.error('공지 추가에 실패했습니다.'); }
    };

    const handleUpdateNotice = async (id, data) => {
        try {
            await api.put(`/admin/settings/notices/${id}`, data);
            if (data.title !== undefined) toast.success('공지가 수정되었습니다.');
            fetchNotices();
            setEditingNotice(null);
        } catch { toast.error('공지 수정에 실패했습니다.'); }
    };

    const handleDeleteNotice = async (id) => {
        if (!window.confirm('이 공지를 삭제하시겠습니까?')) return;
        try {
            await api.delete(`/admin/settings/notices/${id}`);
            toast.success('공지가 삭제되었습니다.');
            fetchNotices();
        } catch { toast.error('공지 삭제에 실패했습니다.'); }
    };

    const fetchLogs = useCallback(async (userOverride) => {
        const user = userOverride !== undefined ? userOverride : logUserSearch;
        if (!user) { setLogs([]); return; }
        try {
            setLoading(true);
            const res = await api.get('/admin/settings/logs', {
                params: { limit: 100, type: logFilter || undefined, search: logSearch || undefined, user }
            });
            setLogs(res.data.data);
        } catch {
            toast.error('로그 조회에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    }, [logFilter, logSearch, logUserSearch]);

    const handleUserSearch = () => {
        setLogUserSearch(logUserInput);
        fetchLogs(logUserInput);
    };

    useEffect(() => {
        if (activeTab === 'logs' && logUserSearch) fetchLogs();
    }, [activeTab, logFilter]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await api.post('/admin/settings', settings);
            toast.success('설정이 저장되었습니다.');
            updateSettings(settings);
        } catch {
            toast.error('설정을 저장하지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleDeleteLogs = async () => {
        if (!window.confirm(`${settings?.log_retention_days || 90}일 이전 로그를 삭제하시겠습니까?`)) return;
        try {
            const res = await api.delete(`/admin/settings/logs?days=${settings?.log_retention_days || 90}`);
            toast.success(res.data.message);
            fetchLogs();
        } catch {
            toast.error('로그 삭제에 실패했습니다.');
        }
    };

    if (initialLoading) {
        return <div className="loading-container"><div className="spinner" /><p>설정 로딩 중...</p></div>;
    }

    const tabs = [
        { key: 'general',  label: '일반 설정' },
        { key: 'security', label: '보안 설정' },
        { key: 'notice',   label: '공지 설정' },
        { key: 'logs',     label: '시스템 로그' },
    ];

    return (
        <div className="settings-page">
            <div className="settings-header">
                <h1>시스템 설정</h1>
                <p>그룹웨어 시스템의 전반적인 설정을 관리합니다.</p>
            </div>

            <div className="settings-tabs">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        className={`tab${activeTab === t.key ? ' active' : ''}`}
                        onClick={() => setActiveTab(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="settings-content">

                {/* ── 일반 설정 ── */}
                {activeTab === 'general' && (
                    <form onSubmit={handleSave} className="settings-form">
                        <div className="form-section">
                            <h3>사이트 정보</h3>
                            <div className="form-group">
                                <label>사이트 이름</label>
                                <input type="text" value={settings?.site_name || ''} onChange={e => handleChange('site_name', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>사이트 설명</label>
                                <textarea value={settings?.site_description || ''} onChange={e => handleChange('site_description', e.target.value)} rows="3" />
                            </div>
                        </div>
                        <div className="form-section">
                            <h3>시스템 설정</h3>
                            <div className="form-group">
                                <label>최대 업로드 크기 (MB)</label>
                                <input type="number" value={settings?.max_upload_size || 10} onChange={e => handleChange('max_upload_size', parseInt(e.target.value))} min="1" max="100" />
                            </div>
                            <div className="form-group">
                                <label>세션 타임아웃 (분)</label>
                                <input type="number" value={settings?.session_timeout || 60} onChange={e => handleChange('session_timeout', parseInt(e.target.value))} min="10" max="1440" />
                            </div>
                        </div>
                        <div className="form-section">
                            <h3>회원 설정</h3>
                            <label className="toggle-row">
                                <div className="toggle-row-text">
                                    <span className="toggle-label">회원가입 허용</span>
                                    <span className="toggle-desc">신규 사용자가 직접 가입할 수 있습니다.</span>
                                </div>
                                <input type="checkbox" className="toggle-checkbox" checked={settings?.allow_registration || false} onChange={e => handleChange('allow_registration', e.target.checked)} />
                            </label>
                            <label className="toggle-row">
                                <div className="toggle-row-text">
                                    <span className="toggle-label">이메일 인증 필수</span>
                                    <span className="toggle-desc">가입 후 이메일 인증을 완료해야 로그인할 수 있습니다.</span>
                                </div>
                                <input type="checkbox" className="toggle-checkbox" checked={settings?.require_email_verification || false} onChange={e => handleChange('require_email_verification', e.target.checked)} />
                            </label>
                        </div>
                        <div className="form-section">
                            <h3>유지보수 모드</h3>
                            <label className="toggle-row">
                                <div className="toggle-row-text">
                                    <span className="toggle-label">점검 모드 활성화</span>
                                    <span className="toggle-desc">활성화 시 관리자를 제외한 모든 사용자에게 점검 페이지가 표시됩니다.</span>
                                </div>
                                <input type="checkbox" className="toggle-checkbox" checked={settings?.maintenance_mode || false} onChange={e => handleChange('maintenance_mode', e.target.checked)} />
                            </label>
                            {settings?.maintenance_mode && (
                                <div className="form-group" style={{ marginTop: 12 }}>
                                    <label className="form-label">점검 안내 메시지 <span style={{ fontWeight: 400, color: '#aaa' }}>(선택)</span></label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={settings?.maintenance_message || ''}
                                        onChange={e => handleChange('maintenance_message', e.target.value)}
                                        placeholder="예) 오후 2시까지 점검이 진행됩니다."
                                        maxLength={200}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="btn-primary" disabled={loading}>{loading ? '저장 중...' : '설정 저장'}</button>
                        </div>
                    </form>
                )}

                {/* ── 보안 설정 ── */}
                {activeTab === 'security' && (
                    <form onSubmit={handleSave} className="settings-form">
                        <div className="form-section">
                            <h3>비밀번호 정책</h3>
                            <div className="form-group">
                                <label>비밀번호 최소 길이</label>
                                <input
                                    type="number"
                                    value={settings?.password_min_length ?? 8}
                                    onChange={e => handleChange('password_min_length', parseInt(e.target.value))}
                                    min="6" max="30"
                                />
                                <p className="help-text">신규 사용자 등록 및 비밀번호 변경 시 적용됩니다.</p>
                            </div>
                            <label className="toggle-row">
                                <div className="toggle-row-text">
                                    <span className="toggle-label">특수문자 포함 필수</span>
                                    <span className="toggle-desc">! @ # $ % 등 특수문자를 반드시 포함해야 합니다.</span>
                                </div>
                                <input
                                    type="checkbox"
                                    className="toggle-checkbox"
                                    checked={settings?.password_require_special || false}
                                    onChange={e => handleChange('password_require_special', e.target.checked)}
                                />
                            </label>
                        </div>
                        <div className="form-section">
                            <h3>로그인 보안</h3>
                            <div className="form-group">
                                <label>연속 실패 시 계정 잠금 횟수</label>
                                <input
                                    type="number"
                                    value={settings?.login_fail_lock_count ?? 5}
                                    onChange={e => handleChange('login_fail_lock_count', parseInt(e.target.value))}
                                    min="0" max="20"
                                />
                                <p className="help-text">0으로 설정하면 잠금 기능이 비활성화됩니다. 잠금 시 30분간 로그인이 차단됩니다.</p>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="btn-primary" disabled={loading}>{loading ? '저장 중...' : '설정 저장'}</button>
                        </div>
                    </form>
                )}

                {/* ── 공지 설정 ── */}
                {activeTab === 'notice' && (
                    <div className="notice-manager">
                        <div className="notice-manager-header">
                            <div>
                                <h3>팝업 공지 관리</h3>
                                <p className="section-desc">활성화된 공지는 로그인한 모든 사용자에게 팝업으로 표시됩니다.</p>
                            </div>
                            <button
                                className="btn-primary notice-add-btn"
                                onClick={() => { setShowAddForm(true); setEditingNotice(null); setNoticeForm({ title: '', content: '' }); }}
                            >
                                <IconPlus size={14} /> 공지 추가
                            </button>
                        </div>

                        {/* 추가 폼 */}
                        {showAddForm && (
                            <div className="notice-form-card">
                                <h4>새 공지 추가</h4>
                                <div className="form-group">
                                    <label>제목</label>
                                    <input
                                        type="text"
                                        value={noticeForm.title}
                                        onChange={e => setNoticeForm(p => ({ ...p, title: e.target.value }))}
                                        placeholder="공지 제목"
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label>내용</label>
                                    <textarea
                                        rows="5"
                                        value={noticeForm.content}
                                        onChange={e => setNoticeForm(p => ({ ...p, content: e.target.value }))}
                                        placeholder="공지 내용"
                                    />
                                </div>
                                <div className="notice-form-actions">
                                    <button className="btn-secondary" onClick={() => setShowAddForm(false)}>취소</button>
                                    <button className="btn-primary" onClick={handleAddNotice}>추가</button>
                                </div>
                            </div>
                        )}

                        {/* 공지 목록 */}
                        {noticeLoading ? (
                            <div className="loading-container"><div className="spinner" /></div>
                        ) : notices.length === 0 ? (
                            <div className="empty-logs">
                                <IconMegaphone size={32} style={{ color: '#d1d5db', marginBottom: 8 }} />
                                <p>등록된 팝업 공지가 없습니다.</p>
                            </div>
                        ) : (
                            <div className="notice-list">
                                {notices.map(notice => (
                                    <div key={notice.id} className={`notice-item${notice.is_active ? ' active' : ' inactive'}`}>
                                        {editingNotice?.id === notice.id ? (
                                            /* 인라인 편집 */
                                            <div className="notice-edit-form">
                                                <div className="form-group">
                                                    <label>제목</label>
                                                    <input
                                                        type="text"
                                                        value={editingNotice.title}
                                                        onChange={e => setEditingNotice(p => ({ ...p, title: e.target.value }))}
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>내용</label>
                                                    <textarea
                                                        rows="4"
                                                        value={editingNotice.content}
                                                        onChange={e => setEditingNotice(p => ({ ...p, content: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="notice-form-actions">
                                                    <button className="btn-secondary" onClick={() => setEditingNotice(null)}>취소</button>
                                                    <button className="btn-primary" onClick={() => handleUpdateNotice(notice.id, { title: editingNotice.title, content: editingNotice.content })}>저장</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="notice-item-left">
                                                    <span className={`notice-status-dot${notice.is_active ? ' on' : ''}`} />
                                                    <div className="notice-item-text">
                                                        <strong>{notice.title}</strong>
                                                        <span className="notice-item-preview">{notice.content?.slice(0, 60)}{notice.content?.length > 60 ? '...' : ''}</span>
                                                        <span className="notice-item-date">{new Date(notice.created_at).toLocaleDateString('ko-KR')}</span>
                                                    </div>
                                                </div>
                                                <div className="notice-item-actions">
                                                    <label className="notice-toggle" title={notice.is_active ? '비활성화' : '활성화'}>
                                                        <input
                                                            type="checkbox"
                                                            checked={notice.is_active}
                                                            onChange={e => handleUpdateNotice(notice.id, { is_active: e.target.checked })}
                                                        />
                                                        <span className="notice-toggle-slider" />
                                                    </label>
                                                    <button className="icon-btn" title="편집" onClick={() => setEditingNotice({ ...notice })}>
                                                        <IconEdit size={15} />
                                                    </button>
                                                    <button className="icon-btn danger" title="삭제" onClick={() => handleDeleteNotice(notice.id)}>
                                                        <IconTrash size={15} />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── 시스템 로그 ── */}
                {activeTab === 'logs' && (
                    <div className="logs-section">
                        <div className="logs-user-search">
                            <label>사용자 검색</label>
                            <div className="logs-user-search-row">
                                <input
                                    type="text"
                                    placeholder="이름으로 검색 (예: 홍길동)"
                                    value={logUserInput}
                                    onChange={e => setLogUserInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleUserSearch()}
                                />
                                <button className="btn-primary" onClick={handleUserSearch} disabled={loading}>검색</button>
                            </div>
                        </div>

                        <div className="logs-toolbar">
                            <div className="logs-filters">
                                <select value={logFilter} onChange={e => setLogFilter(e.target.value)}>
                                    <option value="">전체 유형</option>
                                    <option value="info">정보</option>
                                    <option value="success">성공</option>
                                    <option value="warning">경고</option>
                                    <option value="error">오류</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="메시지 검색..."
                                    value={logSearch}
                                    onChange={e => setLogSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && fetchLogs()}
                                />
                            </div>
                            <div className="logs-actions">
                                <button className="refresh-btn" onClick={() => fetchLogs()} disabled={loading || !logUserSearch}>새로고침</button>
                                <button className="export-btn" onClick={handleDeleteLogs}>오래된 로그 삭제</button>
                            </div>
                        </div>

                        <div className="log-retention-info">
                            <label>로그 보관 기간 (일)</label>
                            <input
                                type="number"
                                value={settings?.log_retention_days ?? 90}
                                onChange={e => handleChange('log_retention_days', parseInt(e.target.value))}
                                min="0" max="3650"
                                style={{ width: 100, marginLeft: 8, marginRight: 8 }}
                            />
                            <span className="help-text">0 = 영구 보관 / 서버가 매일 자동 정리합니다</span>
                            <button className="btn-primary" style={{ marginLeft: 12, padding: '6px 16px', fontSize: 13 }}
                                onClick={handleSave} disabled={loading}>저장</button>
                        </div>

                        {loading ? (
                            <div className="loading-container"><div className="spinner" /></div>
                        ) : !logUserSearch ? (
                            <div className="empty-logs"><p>사용자 이름을 검색하면 해당 사용자의 로그를 표시합니다.</p></div>
                        ) : logs.length > 0 ? (
                            <div className="logs-list">
                                {logs.map(log => (
                                    <div key={log.id} className={`log-item ${log.log_type}`}>
                                        <span className="log-icon">{LOG_ICONS[log.log_type] || <IconInfo size={16} />}</span>
                                        <div className="log-content">
                                            <p className="log-message">{log.message}</p>
                                            <span className="log-time">
                                                {new Date(log.created_at).toLocaleString('ko-KR')}
                                                {log.user_name && ` · ${log.user_name}`}
                                                {log.ip_address && ` · ${log.ip_address}`}
                                            </span>
                                        </div>
                                        <span className={`log-badge log-badge-${log.log_type}`}>
                                            {LOG_TYPE_LABELS[log.log_type]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-logs"><p>"{logUserSearch}" 사용자의 로그가 없습니다.</p></div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Settings;
