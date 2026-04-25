import React, { useState, useRef, useEffect } from 'react';
import './ProjectCreateModal.css';
import api from '../../services/api';
import { useToast } from '../common/Toast';
import { IconClose } from '../common/Icons';
import { ProjectIcon, ICON_KEYS } from './ProjectIcon';

const PRESET_COLORS = [
    '#667eea','#48bb78','#ed8936','#e53e3e','#9f7aea',
    '#38b2ac','#4299e1','#ed64a6','#2d3748','#dd6b20',
];

const TAB_OPTIONS = [
    { key: 'feed',     label: '피드' },
    { key: 'task',     label: '업무' },
    { key: 'gantt',    label: '간트차트' },
    { key: 'calendar', label: '캘린더' },
    { key: 'file',     label: '파일' },
];

export default function ProjectCreateModal({ onClose, onCreated }) {
    const toast = useToast();
    const [form, setForm] = useState({
        name: '',
        description: '',
        color: '#667eea',
        emoji: 'clipboard',
        is_public: false,
        require_approval: false,
        home_tab: 'task',
    });
    const [saving, setSaving]           = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const emojiRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (emojiRef.current && !emojiRef.current.contains(e.target)) {
                setShowEmojiPicker(false);
            }
        };
        if (showEmojiPicker) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showEmojiPicker]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async () => {
        if (!form.name.trim()) { toast.warning('프로젝트 이름을 입력해주세요.'); return; }
        setSaving(true);
        try {
            const res = await api.post('/projects', {
                ...form,
                active_tabs: ['feed','task','gantt','calendar','file'],
            });
            toast.success('프로젝트가 생성되었습니다.');
            onCreated(res.data.project);
        } catch (err) {
            toast.error(err.response?.data?.message || '생성에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="pcm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="pcm-box">
                <div className="pcm-header">
                    <h2 className="pcm-title">새 프로젝트 만들기</h2>
                    <button className="pcm-close" onClick={onClose}><IconClose size={16} /></button>
                </div>

                <div className="pcm-body">
                    {/* 이모지 + 색상 */}
                    <div className="pcm-field">
                        <label className="pcm-label">아이콘 & 색상</label>
                        <div className="pcm-emoji-color">
                            <div ref={emojiRef} style={{ position: 'relative' }}>
                                <button
                                    className="pcm-emoji-btn"
                                    style={{ background: form.color, borderColor: form.color }}
                                    onClick={() => setShowEmojiPicker(v => !v)}
                                >
                                    <ProjectIcon iconKey={form.emoji} size={22} color="#fff" strokeWidth={1.8} />
                                </button>
                                {showEmojiPicker && (
                                    <div className="pcm-emoji-picker">
                                        {ICON_KEYS.map(key => (
                                            <div
                                                key={key}
                                                className={`pcm-emoji-opt ${form.emoji === key ? 'selected' : ''}`}
                                                style={form.emoji === key ? { background: form.color } : {}}
                                                onClick={() => { set('emoji', key); setShowEmojiPicker(false); }}
                                                title={key}
                                            >
                                                <ProjectIcon
                                                    iconKey={key}
                                                    size={18}
                                                    color={form.emoji === key ? '#fff' : '#4a5568'}
                                                    strokeWidth={1.6}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="pcm-color-grid">
                                {PRESET_COLORS.map(c => (
                                    <div
                                        key={c}
                                        className={`pcm-color-dot ${form.color === c ? 'selected' : ''}`}
                                        style={{ background: c, '--c': c }}
                                        onClick={() => set('color', c)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 이름 */}
                    <div className="pcm-field">
                        <label className="pcm-label">프로젝트 이름 <span style={{ color: '#e53e3e' }}>*</span></label>
                        <input
                            className="pcm-input"
                            placeholder="프로젝트 이름을 입력하세요"
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            maxLength={100}
                            autoFocus
                        />
                    </div>

                    {/* 설명 */}
                    <div className="pcm-field">
                        <label className="pcm-label">설명 <span style={{ color: '#b0b5c4', fontWeight: 400 }}>(선택)</span></label>
                        <textarea
                            className="pcm-textarea"
                            placeholder="프로젝트에 대한 설명을 입력하세요"
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* 홈 탭 */}
                    <div className="pcm-field">
                        <label className="pcm-label">기본 탭</label>
                        <div className="pcm-tabs-grid">
                            {TAB_OPTIONS.map(t => (
                                <button
                                    key={t.key}
                                    className={`pcm-tab-btn ${form.home_tab === t.key ? 'selected' : ''}`}
                                    onClick={() => set('home_tab', t.key)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 공개 설정 */}
                    <div className="pcm-toggle-row">
                        <div>
                            <div className="pcm-toggle-label">회사 공개로 설정</div>
                            <div className="pcm-toggle-sub">전직원이 프로젝트를 찾아볼 수 있습니다.</div>
                        </div>
                        <label className="pcm-toggle">
                            <input
                                type="checkbox"
                                checked={form.is_public}
                                onChange={e => set('is_public', e.target.checked)}
                            />
                            <span className="pcm-toggle-slider" />
                        </label>
                    </div>

                    {/* 승인 설정 */}
                    {form.is_public && (
                        <div className="pcm-toggle-row">
                            <div>
                                <div className="pcm-toggle-label">관리자 승인 후 참여 가능</div>
                                <div className="pcm-toggle-sub">참여 요청 시 관리자가 승인해야 합니다.</div>
                            </div>
                            <label className="pcm-toggle">
                                <input
                                    type="checkbox"
                                    checked={form.require_approval}
                                    onChange={e => set('require_approval', e.target.checked)}
                                />
                                <span className="pcm-toggle-slider" />
                            </label>
                        </div>
                    )}

                    {/* 액션 */}
                    <div className="pcm-actions">
                        <button className="pcm-btn-cancel" onClick={onClose}>취소</button>
                        <button className="pcm-btn-submit" onClick={handleSubmit} disabled={saving}>
                            {saving ? '생성 중...' : '프로젝트 생성'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
