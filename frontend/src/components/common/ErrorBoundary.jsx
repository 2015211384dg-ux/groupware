import React from 'react';
import { reportClientError } from '../../utils/errorReporter';

class ErrorBoundary extends React.Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        reportClientError({
            message: error.message || 'React render error',
            stack: error.stack,
            page: window.location.pathname,
            action: info.componentStack?.split('\n').slice(1, 3).join(' ').trim(),
            errorType: 'REACT_ERROR',
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100vh',
                    fontFamily: 'inherit', background: '#f5f6fa',
                }}>
                    <div style={{ fontSize: 48, marginBottom: 16, color: '#d1d5db' }}>!</div>
                    <h2 style={{ color: '#374151', margin: '0 0 8px', fontSize: 20 }}>
                        화면을 불러오는 데 문제가 발생했습니다
                    </h2>
                    <p style={{ color: '#9ca3af', marginBottom: 28, fontSize: 14 }}>
                        잠시 후 다시 시도해주세요.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 24px', background: '#667eea', color: '#fff',
                            border: 'none', borderRadius: 8, cursor: 'pointer',
                            fontSize: 14, fontWeight: 600,
                        }}
                    >
                        새로고침
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
