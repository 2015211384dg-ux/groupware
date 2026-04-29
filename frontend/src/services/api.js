import axios from 'axios';
import { reportClientError } from '../utils/errorReporter';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
    failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve());
    failedQueue = [];
};

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
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // 5xx 서버 오류 — 로그 엔드포인트 자체는 제외(무한 루프 방지)
        const status = error.response?.status;
        const url = error.config?.url || '';
        if (status >= 500 && !url.includes('/logs/client-error')) {
            reportClientError({
                message: `서버 오류 ${status}: ${error.config?.method?.toUpperCase()} ${url}`,
                page: window.location.pathname,
                action: `${error.config?.method?.toUpperCase()} ${url}`,
                errorType: 'API_ERROR',
            });
        }

        return Promise.reject(error);
    }
);

export default api;
