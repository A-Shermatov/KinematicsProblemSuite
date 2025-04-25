import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useNavigate } from 'react-router-dom';

// Создаем экземпляр axios для избежания циклических зависимостей
const axiosInstance = axios.create();


// Функция для обновления токена
let isRefreshing = false;
let failedRequestsQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: AxiosError) => void;
}> = [];

const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post('http://127.0.0.1:8001/api/auth/token/refresh', {
      refreshToken,
    });

    const newAccessToken = response.data.accessToken;
    const newRefreshToken = response.data.refreshToken;

    localStorage.setItem('accessToken', newAccessToken);
    localStorage.setItem('refreshToken', newRefreshToken);

    return newAccessToken;
  } catch (error) {
    // Если обновление токена не удалось, очищаем хранилище и перенаправляем на страницу входа
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    return null;
  }
};

// Request interceptor
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Проверяем, что ошибка 401 и это не запрос на обновление токена
    if (error.response?.status === 401 && !originalRequest.url?.includes('/auth/refresh')) {
      if (!isRefreshing) {
        isRefreshing = true;
        
        try {
          const newAccessToken = await refreshAccessToken();
          if (newAccessToken) {
            // Обновляем токен в оригинальном запросе
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            
            // Пробуем оригинальный запрос с новым токеном
            return axiosInstance(originalRequest);
          }
        } catch (refreshError) {
          // Если обновление токена не удалось, отклоняем все запросы из очереди
          failedRequestsQueue.forEach((request) => request.reject(refreshError as AxiosError));
          failedRequestsQueue = [];
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // Если токен уже обновляется, добавляем запрос в очередь
      return new Promise((resolve, reject) => {
        failedRequestsQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axiosInstance(originalRequest));
          },
          reject: (err: AxiosError) => {
            reject(err);
          },
        });
      });
    }

    return Promise.reject(error);
  }
);

// Экспортируем все оригинальные функции, но используем axiosInstance вместо axios
//export const login = (username: string, password: string) =>
//  axiosInstance.post('http://127.0.0.1:8001/api/auth/login', { username, password });

//export const register = (data: object) =>
//  axiosInstance.post('http://127.0.0.1:8001/api/auth/register', data);

// ... остальные экспортируемые функции аналогично заменяем axios на axiosInstance ...

// Экспортируем axiosInstance для использования в других местах
export default axiosInstance;

// import axios from 'axios';

export const login = (username: string, password: string) =>
  axiosInstance.post('http://127.0.0.1:8001/api/auth/login', { username, password });

export const register = (data: object) =>
  axiosInstance.post('http://127.0.0.1:8001/api/auth/register', data);

export const updateUser = (data: object, token: string) =>
  axiosInstance.patch('http://127.0.0.1:8001/api/possibility/user/update', data, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const getUser = (token: string) =>
  axiosInstance.get('http://127.0.0.1:8001/api/possibility/user', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const getUserById = async (userId: number) => {
  return axiosInstance.get(`http://127.0.0.1:8001/api/possibility/user/${userId}`);
};

export const getUsers = (token: string) =>
  axiosInstance.get('http://127.0.0.1:8001/api/possibility/users', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const blockUser = (userId: number, token: string) =>
  axiosInstance.patch(`http://127.0.0.1:8001/api/possibility/users/${userId}/block`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const unblockUser = (userId: number, token: string) =>
  axiosInstance.patch(`http://127.0.0.1:8001/api/possibility/users/${userId}/unblock`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

// Themes
export const getThemes = () => axiosInstance.get('http://127.0.0.1:8002/api/themes/');

export const getTheme = (id: string) => axiosInstance.get(`http://127.0.0.1:8002/api/themes/${id}`);

export const createTheme = (data: object, token: string) =>
  axiosInstance.post('http://127.0.0.1:8002/api/themes/create', data, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const updateTheme = (id: number, data: object, token: string) =>
  axiosInstance.put(`http://127.0.0.1:8002/api/themes/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const deleteTheme = (id: number, token: string) =>
  axiosInstance.delete(`http://127.0.0.1:8002/api/themes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

// Tasks
export const getTasks = (params = {}) => axiosInstance.get('http://127.0.0.1:8002/api/tasks/', { params });

export const getTask = (id: string) => axiosInstance.get(`http://127.0.0.1:8002/api/tasks/task/${id}`).then((response) => {
  console.log(`getTask response for taskId ${id}:`, response.data);
  return response;
});

export const getTeacherTasks = (token: string) =>
  axiosInstance.get('http://127.0.0.1:8002/api/tasks/teacher', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const createTask = (data: object, token: string) =>
  axiosInstance.post('http://127.0.0.1:8002/api/tasks/create', data, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const updateTask = (id: number, data: object, token: string) =>
  axiosInstance.put(`http://127.0.0.1:8002/api/tasks/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const deleteTask = (id: number, token: string) =>
  axiosInstance.delete(`http://127.0.0.1:8002/api/tasks/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

// Attempts
export const getStudentAttempts = (token: string) =>
  axiosInstance.get('http://127.0.0.1:8003/api/solutions/attempts/student', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const getTeacherAttemptsForGrade = (token: string) =>
  axiosInstance.get('http://127.0.0.1:8003/api/solutions/attempts/teacher/grade', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const getTeacherAttempts = (token: string) =>
  axiosInstance.get('http://127.0.0.1:8003/api/solutions/attempts/teacher', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const getAdminAttempts = (token: string) =>
  axiosInstance.get('http://127.0.0.1:8003/api/solutions/attempts/admin', {
    headers: { Authorization: `Bearer ${token}` },
  });


export const getTeacherStats = (token: string) =>
  axiosInstance.get('http://127.0.0.1:8003/api/solutions/teacher/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const createAttempt = async (data: object, token: string) => {
  try {
    const response = await axiosInstance.post(
      'http://127.0.0.1:8003/api/solutions/attempts',
      data,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response;
  } catch (error) {
    console.error('Error creating attempt:', error);
    throw error;
  }
};

export const gradeAttempt = (attemptId: number, data: object, token: string) =>
  axiosInstance.post(`http://127.0.0.1:8003/api/solutions/attempts/${attemptId}/grade`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });