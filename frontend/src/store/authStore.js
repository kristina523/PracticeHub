import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      role: null, // 'admin', 'teacher', 'student'

      login: async (username, password, role = null) => {
        try {
          const response = await api.post('/auth/login', { username, password, role });
          const { token, user } = response.data;
          
          console.log('Login response:', { token: !!token, user, role: user?.role });
          
          set({ 
            token, 
            user, 
            role: user?.role || null,
            isAuthenticated: true 
          });
          
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          console.log('Auth state after login:', { 
            isAuthenticated: true, 
            role: user?.role,
            userId: user?.id 
          });
          
          return { success: true };
        } catch (error) {
          console.error('Login error:', error);
          console.error('Error details:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
          });
          return {
            success: false,
            message: error.response?.data?.message || error.response?.data?.error || 'Ошибка при входе'
          };
        }
      },

      registerTeacher: async (username, email, password, firstName, lastName, middleName, phone) => {
        try {
          const response = await api.post('/auth/register/teacher', {
            username,
            email,
            password,
            firstName,
            lastName,
            middleName,
            phone
          });
          
          return { success: true, data: response.data };
        } catch (error) {
          // Обработка ошибок валидации
          if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
            const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
            return {
              success: false,
              message: errorMessages || 'Ошибка валидации'
            };
          }
          
          return {
            success: false,
            message: error.response?.data?.message || error.message || 'Ошибка при регистрации'
          };
        }
      },

      registerAdmin: async (username, email, password) => {
        try {
          const response = await api.post('/auth/register/admin', {
            username,
            email,
            password
          });
          
          return { success: true, data: response.data };
        } catch (error) {
          // Обработка ошибок валидации
          if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
            const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
            return {
              success: false,
              message: errorMessages || 'Ошибка валидации'
            };
          }
          
          return {
            success: false,
            message: error.response?.data?.message || error.message || 'Ошибка при регистрации'
          };
        }
      },

      registerStudent: async (username, email, password, studentId) => {
        try {
          console.log('registerStudent вызван с:', { username, email, hasPassword: !!password, studentId });
          
          const response = await api.post('/auth/register/student', {
            username,
            email,
            password,
            studentId
          });
          
          console.log('registerStudent успешно:', response.data);
          return { success: true, data: response.data };
        } catch (error) {
          console.error('registerStudent ошибка:', error);
          console.error('Детали ошибки:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
          });
          
          // Обработка ошибок валидации
          if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
            const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
            return {
              success: false,
              message: errorMessages || 'Ошибка валидации'
            };
          }
          
          return {
            success: false,
            message: error.response?.data?.message || error.message || 'Ошибка при регистрации'
          };
        }
      },

      logout: () => {
        set({ token: null, user: null, role: null, isAuthenticated: false });
        delete api.defaults.headers.common['Authorization'];
      },

      checkAuth: async () => {
        const state = get();
        const token = state.token;
        if (!token) {
          set({ isAuthenticated: false });
          return false;
        }

        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await api.get('/auth/me');
          const user = response.data.user || response.data.admin;
          set({ 
            user, 
            role: user?.role || (response.data.admin ? 'admin' : null),
            isAuthenticated: true 
          });
          return true;
        } catch (error) {
          get().logout();
          return false;
        }
      },

      initAuth: () => {
        const state = get();
        if (state.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
          state.checkAuth();
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user, role: state.role }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
          state.isAuthenticated = !!state.token;
        }
      }
    }
  )
);

