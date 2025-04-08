import axios from 'axios';
import { RegisterFormData, LoginData } from '../types/Auth';
const API_AUTH_HOST = 'http://127.0.0.1';
const API_AUTH_PORT = 8001;
const API_AUTH_AUTH_PREFIX = "v1/auth";
const API_AUTH_POSSIBILITY_PREFIX = "v1/possibility";


const api_auth = axios.create({
  baseURL: `${API_AUTH_HOST}:${API_AUTH_PORT}/${API_AUTH_AUTH_PREFIX}`,
});

// Перехватчик для обработки истекших токенов
api_auth.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshTokenStored = localStorage.getItem('refreshToken');
      if (refreshTokenStored) {
        try {
          const { access_token, refresh_token: newRefreshToken } = await refreshToken(refreshTokenStored);
          localStorage.setItem('token', access_token);
          localStorage.setItem('refreshToken', newRefreshToken);
          api_auth.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
          originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
          return api_auth(originalRequest);
        } catch (refreshError) {
          console.error('Не удалось обновить токен:', refreshError);
          // Перенаправить на логин
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const registerUser = (data: RegisterFormData) =>
  api_auth.post(`/register`, data).then((response) => response.data);

export const loginUser = (data: LoginData) =>
  api_auth.post(`/login`, data).then((response) => response.data);

export const refreshToken = (refreshToken: string) =>
  api_auth.post(`/refresh`, {}, {
    headers: {
      Authorization: `Bearer ${refreshToken}`,
    },
  }).then((response) => response.data);

export const setAuthToken = (token: string) => {
  api_auth.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};


const api_possibility = axios.create({
  baseURL: `${API_AUTH_HOST}:${API_AUTH_PORT}/${API_AUTH_POSSIBILITY_PREFIX}`
})

// Перехватчик для обработки истекших токенов
api_possibility.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshTokenStored = localStorage.getItem('refreshToken');
      if (refreshTokenStored) {
        try {
          const { access_token, refresh_token: newRefreshToken } = await refreshToken(refreshTokenStored);
          localStorage.setItem('token', access_token);
          localStorage.setItem('refreshToken', newRefreshToken);
          api_auth.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
          originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
          return api_auth(originalRequest);
        } catch (refreshError) {
          console.error('Не удалось обновить токен:', refreshError);
          // Перенаправить на логин
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const setPossibilityAuthToken = (token: string) => {
  api_possibility.defaults.headers.common["Authorization"] = `Bearer ${token}`;
};

export const getUserPosibility = () =>
  api_possibility.get(`/user`).then((response) => response.data);
