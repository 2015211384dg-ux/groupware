// SettingsContext.js - 전역 Context는 기본값만
import React, { createContext, useState, useContext } from 'react';

const SettingsContext = createContext();

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within SettingsProvider');
    }
    return context;
};

export const SettingsProvider = ({ children }) => {
    const [siteSettings, setSiteSettings] = useState({
        site_name: '그룹웨어',
        site_description: '우리 회사 그룹웨어 시스템',
        max_upload_size: 10,
        session_timeout: 60,
        allow_registration: false,
        require_email_verification: true,
        maintenance_mode: false
    });

    console.log('✅ SettingsProvider 마운트 (기본값 사용)');

    // 다른 컴포넌트에서 설정을 업데이트할 수 있도록 함수 제공
    const updateSettings = (newSettings) => {
        setSiteSettings(prev => ({ ...prev, ...newSettings }));
        document.title = newSettings.site_name || prev.site_name;
    };

    return (
        <SettingsContext.Provider value={{ siteSettings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export default SettingsContext;