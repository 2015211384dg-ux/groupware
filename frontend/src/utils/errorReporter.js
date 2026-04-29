const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// 동일 에러 5초 내 중복 전송 방지
let _lastKey = '';
let _lastTime = 0;

export function reportClientError({ message, stack, page, action, errorType = 'JS_ERROR' }) {
    const key = `${errorType}:${message}`;
    const now = Date.now();
    if (key === _lastKey && now - _lastTime < 5000) return;
    _lastKey = key;
    _lastTime = now;

    fetch(`${API_BASE}/logs/client-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            message,
            stack,
            page: page || window.location.pathname,
            action,
            errorType,
        }),
        keepalive: true,
    }).catch(() => {});
}

// App 초기화 시 1회 호출 — 전역 JS 에러 캐치
export function setupGlobalErrorHandlers() {
    window.addEventListener('error', (e) => {
        // 리소스 로드 실패(img, script 등)는 무시
        if (!(e.error instanceof Error)) return;
        reportClientError({
            message: e.message || 'Unknown error',
            stack: e.error?.stack,
            page: window.location.pathname,
            errorType: 'UNHANDLED_ERROR',
        });
    });

    window.addEventListener('unhandledrejection', (e) => {
        const msg = e.reason?.message || String(e.reason) || 'Unhandled Promise Rejection';
        // axios 401/토큰 만료는 정상 흐름 — 로그 제외
        if (msg.includes('401') || msg.includes('TokenExpired') || msg.includes('Not authenticated')) return;
        reportClientError({
            message: msg,
            stack: e.reason?.stack,
            page: window.location.pathname,
            errorType: 'UNHANDLED_REJECTION',
        });
    });
}
