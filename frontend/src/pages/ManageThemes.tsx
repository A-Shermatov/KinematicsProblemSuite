import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import * as apiService from '../services/apiService';

// Интерфейс для темы
interface Theme {
  id: number;
  title: string;
  description?: string;
}

// Интерфейс для формы
interface ThemeForm {
  title: string;
  description: string;
}

export const ManageThemes = () => {
  const { user } = useAuth(); // Используем useAuth для безопасного доступа к контексту
  const [themes, setThemes] = useState<Theme[]>([]);
  const [form, setForm] = useState<ThemeForm>({ title: '', description: '' });
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    apiService
      .getThemes()
      .then((response) => setThemes(response.data))
      .catch((err: AxiosError<{ detail?: string }>) => {
        console.error('Failed to fetch themes:', err);
      });
  }, []); // Зависимости пустые, так как запрос выполняется только при монтировании

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return; // Проверяем, что пользователь авторизован

    try {
      if (editingId) {
        await apiService.updateTheme(editingId, form, user.token);
      } else {
        await apiService.createTheme(form, user.token);
      }
      setForm({ title: '', description: '' });
      setEditingId(null);
      const response = await apiService.getThemes();
      setThemes(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(axiosError.response?.data?.detail || 'Ошибка');
    }
  };

  const handleEdit = (theme: Theme) => {
    setForm({ title: theme.title, description: theme.description || '' });
    setEditingId(theme.id);
  };

  const handleDelete = async (id: number) => {
    if (!user) return; // Проверяем, что пользователь авторизован

    try {
      await apiService.deleteTheme(id, user.token);
      setThemes(themes.filter((t) => t.id !== id));
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
      <h1 className="text-3xl font-bold mb-6 max-w-4xl mx-auto">Управление темами</h1>
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow-md mb-6 max-w-4xl mx-auto"
      >
        <input
          type="text"
          placeholder="Название темы"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full p-2 mb-4 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
          required
        />
        <textarea
          placeholder="Описание"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full p-2 mb-4 border rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {editingId ? 'Обновить' : 'Создать'}
        </button>
      </form>
      <div className="max-w-4xl mx-auto grid gap-4">
        {themes.length === 0 ? (
          <p>Темы отсутствуют</p>
        ) : (
          themes.map((theme) => (
            <div
              key={theme.id}
              className="bg-white p-4 rounded-lg shadow-md flex justify-between"
            >
              <div>
                <h2 className="text-xl font-semibold">{theme.title}</h2>
                <p className="text-gray-600">{theme.description || 'Без описания'}</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(theme)}
                  className="bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-600"
                >
                  Редактировать
                </button>
                <button
                  onClick={() => handleDelete(theme.id)}
                  className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};