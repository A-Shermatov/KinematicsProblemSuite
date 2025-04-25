import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import * as apiService from '../services/apiService';

// Интерфейс для пользователя
interface User {
  id: number;
  username: string;
  role: 'admin' | 'teacher' | 'student';
  is_active: boolean;
}

export const ManageUsers = () => {
  const { user } = useAuth(); // Используем useAuth для безопасного доступа к контексту
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!user) return; // Проверяем, что пользователь авторизован

    apiService
      .getUsers(user.token)
      .then((response) => setUsers(response.data))
      .catch((err: AxiosError<{ detail?: string }>) => {
        console.error('Failed to fetch users:', err);
      });
  }, [user]); // Включаем user в зависимости

  const handleBlock = async (userId: number) => {
    if (!user) return; // Проверяем, что пользователь авторизован

    try {
      await apiService.blockUser(userId, user.token);
      setUsers(users.map((u) => (u.id === userId ? { ...u, is_active: false } : u)));
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(axiosError.response?.data?.detail || 'Ошибка');
    }
  };

  const handleUnblock = async (userId: number) => {
    if (!user) return; // Проверяем, что пользователь авторизован

    try {
      await apiService.unblockUser(userId, user.token);
      setUsers(users.map((u) => (u.id === userId ? { ...u, is_active: true } : u)));
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
      <h1 className="text-3xl font-bold mb-6 max-w-4xl mx-auto">Управление пользователями</h1>
      <div className="max-w-4xl mx-auto grid gap-4">
        {users.length === 0 ? (
          <p>Пользователи отсутствуют</p>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="bg-white p-4 rounded-lg shadow-md flex justify-between"
            >
              <div>
                <h2 className="text-xl font-semibold">{u.username}</h2>
                <p className="text-gray-600">Роль: {u.role}</p>
                <p className="text-gray-600">
                  Статус: {u.is_active ? 'Активен' : 'Заблокирован'}
                </p>
              </div>
              <div>
                {u.is_active ? (
                  <button
                    onClick={() => handleBlock(u.id)}
                    className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                  >
                    Заблокировать
                  </button>
                ) : (
                  <button
                    onClick={() => handleUnblock(u.id)}
                    className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                  >
                    Разблокировать
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};