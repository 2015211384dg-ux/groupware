import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ||
                `http://${window.location.hostname}:5001/api/v1`;

// Axios 인스턴스 생성
const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true  // httpOnly 쿠키 자동 전송
});

// 토큰 갱신 중복 방지
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
    failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve());
    failedQueue = [];
};

// 응답 인터셉터: 401 → 토큰 갱신 후 재시도
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        const is401 = error.response?.status === 401;
        const isRefreshUrl = originalRequest.url.includes('/auth/refresh');
        const isLoginUrl   = originalRequest.url.includes('/auth/login');

        if (is401 && !originalRequest._retry && !isRefreshUrl && !isLoginUrl) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(() => api(originalRequest))
                  .catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                await api.post('/auth/refresh');
                processQueue(null);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError);
                // 이미 로그인 페이지면 redirect 생략 (무한 루프 방지)
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

// 인증 서비스
export const authService = {
    // 로그인 (토큰은 서버가 쿠키로 설정)
    login: async (username, password) => {
        try {
            const response = await api.post('/auth/login', { username, password });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: '로그인에 실패했습니다.' };
        }
    },

    // 로그아웃
    logout: async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        }
    },

    // 현재 사용자 정보 조회
    getCurrentUser: async () => {
        try {
            const response = await api.get('/auth/me');
            return response.data.user;
        } catch (error) {
            throw error;
        }
    },

    // 비밀번호 변경
    changePassword: async (currentPassword, newPassword) => {
        try {
            const response = await api.put('/auth/change-password', { currentPassword, newPassword });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: '비밀번호 변경에 실패했습니다.' };
        }
    }
};

export default api;
