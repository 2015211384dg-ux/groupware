import React, { useState, useEffect } from 'react';
import api from '../services/authService';
import './MySettings.css';
import { useToast } from '../components/Toast';
import { IconSettings, IconBell, IconGlobe, IconLock, IconSave } from '../components/Icons';
function MySettings() {
    const toast = useToast();
    const [settings, setSettings] = useState({
        // 알림 설정
        email_notifications: true,
        desktop_notifications: true,
        post_notifications: true,
        comment_notifications: true,
        
        // 테마 설정
        theme: 'light', // light, dark, auto
        
        // 언어 설정
        language: 'ko', // ko, en
        
        // 기타
        show_birthday: true,
        show_profile: true
    });
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/users/my-settings');
            if (response.data.data) {
                setSettings(prev => ({ ...prev, ...response.data.data }));
            }
        } catch (error) {
            console.error('설정 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await api.put('/users/my-settings', settings);
            toast.success('설정이 저장되었습니다.');
        } catch (error) {
            console.error('설정 저장 실패:', error);
            toast.error('설정 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>로딩 중...</p>
            </div>
        );
    }

    return (
        <div className="my-settings-page">
            <div className="page-header">
                <h1><IconSettings size={26} style={{verticalAlign:'middle', marginRight:8}} />내 설정</h1>
                <p>개인 알림 및 환경 설정을 관리합니다</p>
            </div>

            <div className="settings-container">
                {/* 알림 설정 */}
                <div className="settings-section">
                    <h2><IconBell size={18} style={{verticalAlign:'middle', marginRight:6}} />알림 설정</h2>
                    <p className="section-description">
                        받고 싶은 알림을 선택하세요
                    </p>
                    
                    <div className="setting-item">
                        <div className="setting-info">
                            <label>이메일 알림</label>
                            <span className="setting-description">
                                중요한 알림을 이메일로 받습니다
                            </span>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.email_notifications}
                                onChange={(e) => handleChange('email_notifications', e.target.checked)}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <label>데스크톱 알림</label>
                            <span className="setting-description">
                                브라우저 푸시 알림을 받습니다
                            </span>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.desktop_notifications}
                                onChange={(e) => handleChange('desktop_notifications', e.target.checked)}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <label>게시글 알림</label>
                            <span className="setting-description">
                                새 게시글이 올라오면 알림을 받습니다
                            </span>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.post_notifications}
                                onChange={(e) => handleChange('post_notifications', e.target.checked)}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <label>댓글 알림</label>
                            <span className="setting-description">
                                내 글에 댓글이 달리면 알림을 받습니다
                            </span>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.comment_notifications}
                                onChange={(e) => handleChange('comment_notifications', e.target.checked)}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                </div>

                {/* 언어 설정 */}
                <div className="settings-section">
                    <h2><IconGlobe size={18} style={{verticalAlign:'middle', marginRight:6}} />언어 설정</h2>
                    <p className="section-description">
                        사용할 언어를 선택하세요
                    </p>
                    
                    <div className="language-options">
                        <label className="radio-option">
                            <input
                                type="radio"
                                name="language"
                                value="ko"
                                checked={settings.language === 'ko'}
                                onChange={(e) => handleChange('language', e.target.value)}
                            />
                            <span>한국어</span>
                        </label>
                        <label className="radio-option">
                            <input
                                type="radio"
                                name="language"
                                value="en"
                                checked={settings.language === 'en'}
                                onChange={(e) => handleChange('language', e.target.value)}
                            />
                            <span>English</span>
                        </label>
                    </div>
                </div>

                {/* 프라이버시 설정 */}
                <div className="settings-section">
                    <h2><IconLock size={18} style={{verticalAlign:'middle', marginRight:6}} />프라이버시 설정</h2>
                    <p className="section-description">
                        공개 정보를 관리합니다
                    </p>
                    
                    <div className="setting-item">
                        <div className="setting-info">
                            <label>생일 공개</label>
                            <span className="setting-description">
                                다른 사람에게 내 생일을 공개합니다
                            </span>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.show_birthday}
                                onChange={(e) => handleChange('show_birthday', e.target.checked)}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <label>프로필 공개</label>
                            <span className="setting-description">
                                주소록에서 내 프로필을 공개합니다
                            </span>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settings.show_profile}
                                onChange={(e) => handleChange('show_profile', e.target.checked)}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                </div>

                {/* 저장 버튼 */}
                <div className="settings-footer">
                    <button 
                        className="save-button"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? '저장 중...' : <><IconSave size={16} style={{verticalAlign:'middle', marginRight:6}} />설정 저장</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default MySettings;
