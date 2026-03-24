import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/authService';

export default function MagicLogin() {
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        const params   = new URLSearchParams(window.location.search);
        const token    = params.get('token');
        const redirect = params.get('redirect') || '/';

        if (!token) { navigate('/login'); return; }

        api.post('/auth/magic-verify', { token })
            .then(() => { window.location.replace(redirect); })
            .catch(() => { setStatus('error'); setTimeout(() => navigate('/login'), 2000); });
    }, [navigate]);

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100vh', gap: 16,
            fontFamily: "'Malgun Gothic', sans-serif"
        }}>
            {status === 'loading' ? (
                <>
                    <div style={{
                        width: 40, height: 40,
                        border: '3px solid #e5e7eb',
                        borderTopColor: '#667eea',
                        borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite'
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <p style={{ color: '#888', fontSize: 14 }}>로그인 중...</p>
                </>
            ) : (
                <p style={{ color: '#ef4444', fontSize: 14 }}>링크가 만료됐습니다. 로그인 페이지로 이동합니다.</p>
            )}
        </div>
    );
}
