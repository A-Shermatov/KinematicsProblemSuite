import axios from "axios";

const API_TASK_MANAGEMENT_HOST = 'http://127.0.0.1';
const API_TASK_MANAGEMENT_PORT = 8002;
const API_TASK_MANAGEMENT_TASK_PREFIX = "v1/task";
const API_TASK_MANAGEMENT_THEME_PREFIX = "v1/theme";

const api = axios.create({
  baseURL: `${API_TASK_MANAGEMENT_HOST}:${API_TASK_MANAGEMENT_PORT}`, // Укажите ваш базовый URL
});



// Функция для добавления токена в заголовки
export const setTaskManagerAuthToken = (token: string) => {
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
};

export const createTheme = (theme: { title: string; description: string }) =>
  api.post(`/${API_TASK_MANAGEMENT_THEME_PREFIX}/create`, theme).then((response) => response.data);

export const fetchThemes = () =>
  api.get(`/${API_TASK_MANAGEMENT_THEME_PREFIX}/`).then((response) => response.data);

export const updateTheme = (id: number, theme: { title: string; description: string }) =>
  api.put(`/${API_TASK_MANAGEMENT_THEME_PREFIX}/create`, theme).then((response) => response.data);

export const deleteTheme = (id: number) =>
  api.delete(`/${API_TASK_MANAGEMENT_THEME_PREFIX}/create`).then((response) => response.data);

export const fetchTasks = () =>
  api.get(`/${API_TASK_MANAGEMENT_TASK_PREFIX}/`).then((response) => response.data);

export const createTask = (task: { title: string; description: string; themeId: number }) =>
  api.post(`/${API_TASK_MANAGEMENT_TASK_PREFIX}/create`, task).then((response) => response.data);
