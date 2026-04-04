import React, { useState, useEffect } from 'react';
import './MaintenancePage.css';

export default function MaintenancePage({ message }) {
    const [dots, setDots] = useState('');

    useEffect(() => {
        const t = setInterval(() => {
            setDots(d => d.length >= 3 ? '' : d + '.');
        }, 600);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="maint-page">
            <div className="maint-card">
                <div className="maint-icon-wrap">
                    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                    </svg>
                </div>

                <div className="maint-badge">시스템 점검</div>

                <h1 className="maint-title">잠시 점검 중입니다</h1>

                <p className="maint-desc">
                    {message || '더 나은 서비스 제공을 위해 시스템 점검을 진행하고 있습니다.'}
                </p>

                <div className="maint-status">
                    <span className="maint-dot-anim" />
                    <span>점검 진행 중{dots}</span>
                </div>

                <div className="maint-divider" />

                <p className="maint-footer">
                    점검이 완료되면 자동으로 접속됩니다.<br />
                    불편을 드려 죄송합니다.
                </p>
            </div>
        </div>
    );
}
