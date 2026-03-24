import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import api from '../services/authService';
import { IconLock, IconCheckCircle } from './Icons';
import './ForcePasswordChange.css';

function ForcePasswordChange({ onSuccess }) {
    const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [policy, setPolicy] = useState({ password_min_length: 8, password_require_special: false });

    useEffect(() => {
        api.get('/settings/public').then(res => {
            const { password_min_length, password_require_special } = res.data.data;
            setPolicy({ password_min_length, password_require_special });
        }).catch(() => {});
    }, []);

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setError('');
    };

    const validate = () => {
        if (form.newPassword !== form.confirmPassword) {
            return '새 비밀번호가 일치하지 않습니다.';
        }
        if (form.newPassword.length < policy.password_min_length) {
            return `비밀번호는 최소 ${policy.password_min_length}자 이상이어야 합니다.`;
        }
        if (policy.password_require_special && !/[!@#$%^&*(),.?":{}|<>]/.test(form.newPassword)) {
            return '비밀번호에 특수문자를 포함해야 합니다.';
        }
        if (form.newPassword === form.currentPassword) {
            return '현재 비밀번호와 동일한 비밀번호로 변경할 수 없습니다.';
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }
        try {
            setLoading(true);
            await authService.changePassword(form.currentPassword, form.newPassword);
            setSuccess(true);
            setTimeout(() => onSuccess(), 1500);
        } catch (err) {
            setError(err.message || '비밀번호 변경에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="force-pw-overlay">
                <div className="force-pw-modal force-pw-success">
                    <div className="force-pw-icon success"><IconCheckCircle size={48} /></div>
                    <h2>비밀번호가 변경되었습니다</h2>
                    <p>새 비밀번호로 로그인되었습니다.<br />잠시 후 이동합니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="force-pw-overlay">
            <div className="force-pw-modal">
                <div className="force-pw-header">
                    <div className="force-pw-icon"><IconLock size={48} /></div>
                    <h2>비밀번호 변경 필요</h2>
                    <p>임시 비밀번호로 로그인되었습니다.<br />보안을 위해 새 비밀번호를 설정해주세요.</p>
                </div>

                <div className="force-pw-policy">
                    <p className="force-pw-policy-title">비밀번호 정책</p>
                    <ul>
                        <li className={form.newPassword.length >= policy.password_min_length && form.newPassword ? 'met' : ''}>
                            최소 {policy.password_min_length}자 이상
                        </li>
                        {policy.password_require_special && (
                            <li className={/[!@#$%^&*(),.?":{}|<>]/.test(form.newPassword) ? 'met' : ''}>
                                특수문자 포함 (!@#$% 등)
                            </li>
                        )}
                        <li className={form.newPassword && form.newPassword !== form.currentPassword ? 'met' : ''}>
                            현재 비밀번호와 다른 비밀번호
                        </li>
                    </ul>
                </div>

                <form onSubmit={handleSubmit} className="force-pw-form">
                    <div className="force-pw-field">
                        <label>임시 비밀번호 (현재)</label>
                        <input
                            type="password"
                            name="currentPassword"
                            value={form.currentPassword}
                            onChange={handleChange}
                            placeholder="임시 비밀번호 입력"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="force-pw-field">
                        <label>새 비밀번호</label>
                        <input
                            type="password"
                            name="newPassword"
                            value={form.newPassword}
                            onChange={handleChange}
                            placeholder={`새 비밀번호 입력 (${policy.password_min_length}자 이상${policy.password_require_special ? ', 특수문자 포함' : ''})`}
                            required
                        />
                    </div>
                    <div className="force-pw-field">
                        <label>새 비밀번호 확인</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={form.confirmPassword}
                            onChange={handleChange}
                            placeholder="새 비밀번호 다시 입력"
                            required
                        />
                    </div>
                    {error && <p className="force-pw-error">{error}</p>}
                    <button type="submit" className="force-pw-btn" disabled={loading}>
                        {loading ? '변경 중...' : '비밀번호 변경하기'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ForcePasswordChange;
