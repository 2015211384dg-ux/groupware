import React, { useState } from 'react';
import './ProjectSettingsModal.css';
import api from '../../services/api';
import { useToast } from '../common/Toast';
import { useConfirm } from '../common/Confirm';
import { IconX } from '../common/Icons';
import { ProjectIcon, ICON_KEYS } from './ProjectIcon';

const PRESET_COLORS = [
    '#667eea','#48bb78','#ed8936','#e53e3e','#9f7aea',
    '#38b2ac','#4299e1','#ed64a6','#2d3748','#dd6b20',
];

const TAB_OPTIONS = [
    { key: 'task', label: '업무' }, { key: 'feed', label: '피드' },
    { key: 'file', label: '파일' }, { key: 'insight', label: '인사이트' },
];

export default function ProjectSettingsModal({ project, myRole, onClose, onUpdated, onDeleted }) {
    const toast   = useToast();
    const confirm = useConfirm();
    const [form, setForm] = useState({
        name:        project.name        || '',
        description: project.description || '',
        color:       project.color       || '#667eea',
        emoji:       project.emoji       || 'clipboard',
        is_public:   !!project.is_public,
        home_tab:    project.home_tab    || 'task',
    });
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [saving, setSaving]   = useState(false);
    const [deleting, setDeleting] = useState(false);
    const isOwner = myRole === 'owner';

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!form.name.trim()) { toast.warning('프로젝트 이름을 입력해주세요.'); return; }
        setSaving(true);
        try {
            await api.patch(`/projects/${project.id}`, form);
            toast.success('설정이 저장되었습니다.');
            onUpdated({ ...project, ...form });
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || '저장 실패');
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        const confirmed = await confirm(`"${project.name}" 프로젝트를 삭제할까요?\n\n모든 업무, 피드, 파일이 영구 삭제됩니다.`, { confirmText: '삭제', danger: true });
        if (!confirmed) return;
        setDeleting(true);
        try {
            await api.delete(`/projects/${project.id}`);
            toast.success('프로젝트가 삭제되었습니다.');
            onDeleted?.();
        } catch (err) {
            toast.error(err.response?.data?.message || '삭제 실패');
        } finally { setDeleting(false); }
    };

    return (
        <div className="psm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="psm-box">
                <div className="psm-header">
                    <span className="psm-title">프로젝트 설정</span>
                    <button className="psm-close" onClick={onClose}><IconX size={16} /></button>
                </div>

                <div className="psm-body">
                    {/* 아이콘 & 색상 */}
                    <div className="psm-field">
                        <label className="psm-label">아이콘 & 색상</label>
                        <div className="psm-icon-color-row">
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="psm-icon-btn"
                                    style={{ background: form.color }}
                                    onClick={() => setShowIconPicker(v => !v)}
                                >
                                    <ProjectIcon iconKey={form.emoji} size={22} color="#fff" strokeWidth={1.8} />
                                </button>
                                {showIconPicker && (
                                    <div className="psm-icon-picker">
                                        {ICON_KEYS.map(key => (
                                            <div
                                                key={key}
                                                className={`psm-icon-opt ${form.emoji === key ? 'selected' : ''}`}
                                                style={form.emoji === key ? { background: form.color } : {}}
                                                onClick={() => { set('emoji', key); setShowIconPicker(false); }}
                                            >
                                                <ProjectIcon
                                                    iconKey={key} size={18}
                                                    color={form.emoji === key ? '#fff' : '#4a5568'}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="psm-color-grid">
                                {PRESET_COLORS.map(c => (
                                    <div
                                        key={c}
                                        className={`psm-color-dot ${form.color === c ? 'selected' : ''}`}
                                        style={{ background: c, '--c': c }}
                                        onClick={() => set('color', c)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 이름 */}
                    <div className="psm-field">
                        <label className="psm-label">프로젝트 이름 <span style={{ color:'#e53e3e' }}>*</span></label>
                        <input
                            className="psm-input"
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            maxLength={100}
                        />
                    </div>

                    {/* 설명 */}
                    <div className="psm-field">
                        <label className="psm-label">설명</label>
                        <textarea
                            className="psm-textarea"
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* 기본 탭 */}
                    <div className="psm-field">
                        <label className="psm-label">기본 탭</label>
                        <div className="psm-tabs-grid">
                            {TAB_OPTIONS.map(t => (
                                <button
                                    key={t.key}
                                    className={`psm-tab-btn ${form.home_tab === t.key ? 'selected' : ''}`}
                                    onClick={() => set('home_tab', t.key)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 공개 설정 */}
                    <div className="psm-toggle-row">
                        <div>
                            <div className="psm-toggle-label">회사 공개</div>
                            <div className="psm-toggle-sub">전직원이 프로젝트를 볼 수 있습니다.</div>
                        </div>
                        <label className="psm-toggle">
                            <input type="checkbox" checked={form.is_public} onChange={e => set('is_public', e.target.checked)} />
                            <span className="psm-toggle-slider" />
                        </label>
                    </div>

                    {/* 저장 */}
                    <div className="psm-actions">
                        <button className="psm-btn-cancel" onClick={onClose}>취소</button>
                        <button className="psm-btn-save" onClick={handleSave} disabled={saving}>
                            {saving ? '저장 중...' : '저장'}
                        </button>
                    </div>

                    {/* 위험 구역 */}
                    {isOwner && (
                        <div className="psm-danger-zone">
                            <div className="psm-danger-label">위험 구역</div>
                            <div className="psm-danger-row">
                                <div>
                                    <div className="psm-danger-title">프로젝트 삭제</div>
                                    <div className="psm-danger-sub">모든 데이터가 영구 삭제됩니다.</div>
                                </div>
                                <button className="psm-btn-delete" onClick={handleDelete} disabled={deleting}>
                                    {deleting ? '삭제 중...' : '삭제'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
