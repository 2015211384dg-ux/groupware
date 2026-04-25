import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const SettingsContext = createContext();

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within SettingsProvider');
    }
    return context;
};

const DEFAULTS = {
    site_name: '그룹웨어',
    site_description: '우리 회사 그룹웨어 시스템',
    max_upload_size: 10,
    session_timeout: 60,
    allow_registration: false,
    require_email_verification: true,
    maintenance_mode: false
};

export const SettingsProvider = ({ children }) => {
    const [siteSettings, setSiteSettings] = useState(DEFAULTS);

    useEffect(() => {
        api.get('/settings/public').then(res => {
            if (res.data?.success && res.data.data) {
                const s = res.data.data;
                setSiteSettings(prev => ({ ...prev, ...s }));
                if (s.site_name) document.title = s.site_name;
            }
        }).catch(() => {});
    }, []);

    const updateSettings = (newSettings) => {
        setSiteSettings(prev => ({ ...prev, ...newSettings }));
        if (newSettings.site_name) document.title = newSettings.site_name;
    };

    return (
        <SettingsContext.Provider value={{ siteSettings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export default SettingsContext;