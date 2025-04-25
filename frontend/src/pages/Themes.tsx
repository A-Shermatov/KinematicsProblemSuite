import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import * as apiService from '../services/apiService';

// Интерфейс для темы
interface Theme {
  id: number;
  title: string;
  description?: string;
}

export const Themes = () => {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    apiService
      .getThemes()
      .then((response) => {
        setThemes(response.data);
      })
      .catch((err: AxiosError<{ detail?: string }>) => {
        console.error('Failed to fetch themes:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []); // Зависимости пустые, так как запрос выполняется только при монтировании

  return (
    <div className="min-h-screen bg-gray-100 p-6 pt-20">
      <h1 className="text-3xl font-bold mb-6 max-w-4xl mx-auto">Список тем</h1>
      <div className="max-w-4xl mx-auto grid gap-4">
        {isLoading ? (
          <p>Загрузка...</p>
        ) : themes.length === 0 ? (
          <p>Темы отсутствуют</p>
        ) : (
          themes.map((theme) => (
            <Link
              key={theme.id}
              to={`/themes/${theme.id}/tasks`}
              className="bg-white p-4 rounded-lg shadow-md hover:bg-gray-50 transition"
            >
              <h2 className="text-xl font-semibold">{theme.title}</h2>
              <p className="text-gray-600">{theme.description || 'Без описания'}</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};