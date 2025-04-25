import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import * as apiService from '../services/apiService';

// Интерфейс для задачи
interface Task {
  id: number;
  title: string;
  condition?: string;
  theme_id: number;
}

// Интерфейс для темы
interface Theme {
  id: number;
  title: string;
}

// Интерфейс для формы
interface TaskForm {
  title: string;
  condition: string;
  answer: string;
  theme_id: string;
}

export const ManageTasks = () => {
  const { user } = useAuth(); // Используем useAuth для безопасного доступа к контексту
  const [tasks, setTasks] = useState<Task[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [form, setForm] = useState<TaskForm>({ title: '', condition: '', answer: '', theme_id: '' });
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    // Проверяем, что user существует
    if (!user) return;

    Promise.all([apiService.getTeacherTasks(user.token), apiService.getThemes()])
      .then(([tasksRes, themesRes]) => {
        setTasks(tasksRes.data);
        setThemes(themesRes.data);
      })
      .catch((err: AxiosError<{ detail?: string }>) => {
        console.error('Failed to fetch data:', err);
      });
  }, [user]); // Включаем user в зависимости

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return; // Проверяем user перед выполнением запросов

    try {
      const themeId = parseInt(form.theme_id);
      if (isNaN(themeId)) {
        alert('Пожалуйста, выберите тему');
        return;
      }

      if (editingId) {
        await apiService.updateTask(editingId, { ...form, theme_id: themeId }, user.token);
      } else {
        await apiService.createTask({ ...form, theme_id: themeId }, user.token);
      }
      setForm({ title: '', condition: '', answer: '', theme_id: '' });
      setEditingId(null);
      const response = await apiService.getTeacherTasks(user.token);
      setTasks(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(axiosError.response?.data?.detail || 'Ошибка');
    }
  };

  const handleEdit = (task: Task) => {
    setForm({
      title: task.title,
      condition: task.condition || '',
      answer: '',
      theme_id: task.theme_id.toString(),
    });
    setEditingId(task.id);
  };

  const handleDelete = async (id: number) => {
    if (!user) return; // Проверяем user перед выполнением запросов

    try {
      await apiService.deleteTask(id, user.token);
      setTasks(tasks.filter((t) => t.id !== id));
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(axiosError.response?.data?.detail || 'Ошибка');
    }
  };

  // Проверка, если пользователь не авторизован
  if (!user) {
    return <div>Пожалуйста, войдите в систему</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 pt-20">
      <h1 className="text-3xl font-bold mb-6 max-w-4xl mx-auto">Управление задачами</h1>
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow-md mb-6 max-w-4xl mx-auto"
      >
        <input
          type="text"
          placeholder="Название задачи"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full p-2 mb-4 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
          required
        />
        <textarea
          placeholder="Условие"
          value={form.condition}
          onChange={(e) => setForm({ ...form, condition: e.target.value })}
          className="w-full p-2 mb-4 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <input
          type="text"
          placeholder="Ответ"
          value={form.answer}
          onChange={(e) => setForm({ ...form, answer: e.target.value })}
          className="w-full p-2 mb-4 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
          required
        />
        <select
          value={form.theme_id}
          onChange={(e) => setForm({ ...form, theme_id: e.target.value })}
          className="w-full p-2 mb-4 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
          required
        >
          <option value="">Выберите тему</option>
          {themes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.title}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {editingId ? 'Обновить' : 'Создать'}
        </button>
      </form>
      <div className="max-w-4xl mx-auto grid gap-4">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="bg-white p-4 rounded-lg shadow-md flex justify-between"
          >
            <div>
              <h2 className="text-xl font-semibold">{task.title}</h2>
              <p className="text-gray-600">{task.condition || 'Без условия'}</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handleEdit(task)}
                className="bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
              >
                Редактировать
              </button>
              <button
                onClick={() => handleDelete(task.id)}
                className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};