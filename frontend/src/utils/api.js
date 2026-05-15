import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

/** Токен из памяти zustand (сразу после login), без ожидания записи persist в localStorage */
let getBearerToken = () => null;
export function setBearerTokenGetter(fn) {
  getBearerToken = typeof fn === 'function' ? fn : () => null;
}

api.interceptors.request.use(
  (config) => {
    const token = getBearerToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const currentPath = window.location.pathname;
    const isAuthPage =
      currentPath.includes('/login') ||
      currentPath.includes('/register') ||
      currentPath.includes('/forgot-password') ||
      currentPath.includes('/reset-password');
    const reqUrl = error.config?.url || '';
    // Проверка сессии (auth/me) и сам логин сами обрабатывают 401.
    const isSessionCheck = reqUrl.includes('/auth/me') || reqUrl.includes('/auth/login');

    if (error.response?.status === 401 && !isAuthPage && !isSessionCheck) {
      try {
        localStorage.removeItem('auth-storage');
      } catch (_) {}
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

