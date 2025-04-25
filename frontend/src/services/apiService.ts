import axios from 'axios';

export const login = (username: string, password: string) =>
  axios.post('http://127.0.0.1:8001/api/auth/login', { username, password });

export const register = (data: object) =>
  axios.post('http://127.0.0.1:8001/api/auth/register', data);

export const updateUser = (data: object, token: string) =>
  axios.patch('http://127.0.0.1:8001/api/possibility/user/update', data, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const getUser = (token: string) =>
  axios.get('http://127.0.0.1:8001/api/possibility/user', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const getUserById = async (userId: number) => {
  return axios.get(`http://127.0.0.1:8001/api/possibility/user/${userId}`);
};

export const getUsers = (token: string) =>
  axios.get('http://127.0.0.1:8001/api/possibility/users', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const blockUser = (userId: number, token: string) =>
  axios.patch(`http://127.0.0.1:8001/api/possibility/users/${userId}/block`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const unblockUser = (userId: number, token: string) =>
  axios.patch(`http://127.0.0.1:8001/api/possibility/users/${userId}/unblock`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

// Themes
export const getThemes = () => axios.get('http://127.0.0.1:8002/api/themes/');

export const getTheme = (id: string) => axios.get(`http://127.0.0.1:8002/api/themes/${id}`);

export const createTheme = (data: object, token: string) =>
  axios.post('http://127.0.0.1:8002/api/themes/create', data, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const updateTheme = (id: number, data: object, token: string) =>
  axios.put(`http://127.0.0.1:8002/api/themes/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const deleteTheme = (id: number, token: string) =>
  axios.delete(`http://127.0.0.1:8002/api/themes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

// Tasks
export const getTasks = (params = {}) => axios.get('http://127.0.0.1:8002/api/tasks/', { params });

export const getTask = (id: string) => axios.get(`http://127.0.0.1:8002/api/tasks/task/${id}`).then((response) => {
  console.log(`getTask response for taskId ${id}:`, response.data);
  return response;
});

export const getTeacherTasks = (token: string) =>
  axios.get('http://127.0.0.1:8002/api/tasks/teacher', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const createTask = (data: object, token: string) =>
  axios.post('http://127.0.0.1:8002/api/tasks/create', data, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const updateTask = (id: number, data: object, token: string) =>
  axios.put(`http://127.0.0.1:8002/api/tasks/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const deleteTask = (id: number, token: string) =>
  axios.delete(`http://127.0.0.1:8002/api/tasks/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

// Attempts
export const getStudentAttempts = (token: string) =>
  axios.get('http://127.0.0.1:8003/api/solutions/attempts/student', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const getTeacherAttemptsForGrade = (token: string) =>
  axios.get('http://127.0.0.1:8003/api/solutions/attempts/teacher/grade', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const getTeacherAttempts = (token: string) =>
  axios.get('http://127.0.0.1:8003/api/solutions/attempts/teacher', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const getAdminAttempts = (token: string) =>
  axios.get('http://127.0.0.1:8003/api/solutions/attempts/admin', {
    headers: { Authorization: `Bearer ${token}` },
  });


export const getTeacherStats = (token: string) =>
  axios.get('http://127.0.0.1:8003/api/solutions/teacher/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const createAttempt = async (data: object, token: string) => {
  try {
    const response = await axios.post(
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
  axios.post(`http://127.0.0.1:8003/api/solutions/attempts/${attemptId}/grade`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });