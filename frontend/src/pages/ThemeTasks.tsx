import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AxiosError } from "axios";
import * as apiService from "../services/apiService";

interface Theme {
  id: number;
  title: string;
  description?: string;
}

interface Task {
  id: number;
  title: string;
  condition?: string;
  theme_id: number;
  user_id?: number; // Поле для идентификации создателя задачи
}

export const ThemeTasks = () => {
  const { themeId } = useParams<{ themeId: string }>();
  const [theme, setTheme] = useState<Theme | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!themeId) {
      setError("Тема не найдена");
      setIsLoading(false);
      return;
    }

    Promise.all([
      apiService.getTheme(themeId),
      apiService.getTasks({ theme_id: parseInt(themeId) }),
    ])
      .then(([themeRes, tasksRes]) => {
        setTheme(themeRes.data);
        setTasks(tasksRes.data);
      })
      .catch((err: AxiosError<{ detail?: string }>) => {
        console.error("Failed to fetch theme or tasks:", err);
        setError(err.response?.data?.detail || "Ошибка при загрузке данных");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [themeId]);

  if (!themeId) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 pt-20">Тема не найдена</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 pt-20 flex">
      <div className="w-1/4 bg-white p-4 rounded-lg shadow-md mr-6">
        <h2 className="text-xl font-semibold mb-4">Задачи темы</h2>
        {isLoading ? (
          <p>Загрузка...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : tasks.length === 0 ? (
          <p>Задачи отсутствуют</p>
        ) : (
          tasks.map((task) => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className="block p-2 hover:bg-gray-100 rounded"
            >
              {task.title}
            </Link>
          ))
        )}
      </div>
      <div className="flex-1">
        {isLoading ? (
          <p>Загрузка...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            <h1 className="text-3xl font-bold mb-6">
              {theme?.title || "Тема не найдена"}
            </h1>
            <div className="grid gap-4">
              {tasks.length === 0 ? (
                <p>Задачи отсутствуют</p>
              ) : (
                tasks.map((task) => (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className="bg-white p-4 rounded-lg shadow-md hover:bg-gray-50 transition"
                  >
                    <h2 className="text-xl font-semibold">{task.title}</h2>
                    <p className="text-gray-600">
                      {task.condition || "Без условия"}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
