import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import {
  ChartData,
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { AxiosError } from "axios";
import { useAuth } from "../contexts/AuthContext";
import { NavLink } from "react-router-dom";
import * as apiService from "../services/apiService";
import { motion, AnimatePresence } from "framer-motion";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Stats {
  tasks: number;
  attempts: number;
  solved: number;
}

interface Attempt {
  id: number;
  student_id?: number;
  student_username?: string;
  theme_id: number;
  theme_name: string;
  task_id: number;
  task_name: string;
  task_author_id?: number;
  task_author_username?: string;
  system_answer: string;
  answer: string;
  status: "CORRECT" | "GRADED" | "PENDING";
  system_grade: number | null;
  teacher_grade: number | null;
  created_at: string;
  image_data: string | null;
}

export const TeacherDashboard = () => {
  const { user, updateUser } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [grades, setGrades] = useState<{ [key: number]: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    first_name: "",
    second_name: "",
    username: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleUpdateUser = async () => {
    if (!user) return;
    try {
      let image_data = null;
      if (imageFile) {
        const reader = new FileReader();
        const imageBase64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
        image_data = {
          image: imageBase64.split(",")[1],
          file_name: imageFile.name,
        };
      }

      const response = await apiService.updateUser(
        { ...editData, image_data },
        user.token
      );
      setEditMode(false);
      updateUser({
        first_name: response.data.first_name,
        second_name: response.data.second_name,
        username: response.data.username,
        image: response.data.image,
      });
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setError(
        axiosError.response?.data?.detail || "Ошибка при обновлении данных"
      );
    }
  };

  const handleAvatarClick = (image: string | null) => {
    if (image) {
      setSelectedAvatar(image);
    }
  };

  const handleImageClick = (image: string | null) => {
    if (image) {
      setSelectedImage(image);
    }
  };

  const handleCloseModal = () => {
    setSelectedAvatar(null);
    setSelectedImage(null);
  };

  const fetchStats = async () => {
    if (!user) return;
    try {
      const [tasksRes, statsRes, attemptsRes] = await Promise.all([
        apiService.getTeacherTasks(user.token),
        apiService.getTeacherStats(user.token),
        apiService.getTeacherAttemptsForGrade(user.token),
      ]);
      setStats({
        tasks: tasksRes.data.length,
        attempts: statsRes.data.attempts,
        solved: statsRes.data.solved,
      });
      setAttempts(attemptsRes.data);
      setError(null);
      console.log(attemptsRes);
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      console.error("Failed to fetch data:", axiosError);
      setError(axiosError.response?.data?.detail || "Ошибка загрузки данных");
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  const handleGrade = async (attemptId: number, gradeInput: string) => {
    const grade = parseInt(gradeInput);
    if (isNaN(grade) || grade < 0 || grade > 100) {
      alert("Оценка должна быть числом от 0 до 100");
      return;
    }
    if (!user) return;

    try {
      await apiService.gradeAttempt(
        attemptId,
        { teacher_grade: grade },
        user.token
      );
      await fetchStats();
      setGrades((prev) => ({ ...prev, [attemptId]: "" }));
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(
        axiosError.response?.data?.detail || "Ошибка при выставлении оценки"
      );
    }
  };

  const data: ChartData<"pie", number[], string> | null = stats
    ? {
        labels: ["Задачи", "Попытки", "Решено"],
        datasets: [
          {
            data: [stats.tasks, stats.attempts, stats.solved],
            backgroundColor: ["#36A2EB", "#FFCE56", "#4BC0C0"],
          },
        ],
      }
    : null;

  if (!user) {
    return <div>Пожалуйста, войдите в систему</div>;
  }

  if (user.role !== "teacher") {
    return <div>Этот раздел доступен только для учителей</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 pt-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Личный кабинет учителя</h1>
        <div className="bg-white p-6 rounded-lg shadow-md mb-6 flex flex-col md:flex-row items-start gap-6">
          <div className="flex flex-col items-center">
            {user.image ? (
              <img
                src={user.image}
                alt="Аватар"
                className="w-24 h-24 rounded-full mb-4 object-cover border-2 border-gray-200 cursor-pointer"
                onClick={() => handleAvatarClick(user.image ?? null)}
              />
            ) : (
              <div className="w-24 h-24 rounded-full mb-4 bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-semibold">
                {user.first_name?.charAt(0) || user.username.charAt(0)}
              </div>
            )}
            {!editMode && (
              <button
                onClick={() => {
                  setEditData({
                    first_name: user.first_name || "",
                    second_name: user.second_name || "",
                    username: user.username,
                  });
                  setEditMode(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-300"
              >
                Редактировать
              </button>
            )}
          </div>
          <div className="flex-1">
            {editMode ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUpdateUser();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Имя
                  </label>
                  <input
                    type="text"
                    value={editData.first_name}
                    onChange={(e) =>
                      setEditData({ ...editData, first_name: e.target.value })
                    }
                    className="mt-1 p-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Фамилия
                  </label>
                  <input
                    type="text"
                    value={editData.second_name}
                    onChange={(e) =>
                      setEditData({ ...editData, second_name: e.target.value })
                    }
                    className="mt-1 p-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Имя пользователя
                  </label>
                  <input
                    type="text"
                    value={editData.username}
                    onChange={(e) =>
                      setEditData({ ...editData, username: e.target.value })
                    }
                    className="mt-1 p-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Изображение
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="mt-1 p-2 border rounded-lg w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-300"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-300"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-800">
                  Личная информация
                </h2>
                <p className="text-gray-600">
                  <span className="font-medium">Имя:</span>{" "}
                  {user.first_name || "Не указано"}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Фамилия:</span>{" "}
                  {user.second_name || "Не указано"}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Имя пользователя:</span>{" "}
                  {user.username}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Роль:</span> Учитель
                </p>
              </div>
            )}
          </div>
        </div>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        {stats && data ? (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">Статистика</h2>
            <div className="max-w-md mx-auto">
              <Pie data={data} />
            </div>
          </div>
        ) : (
          !error && <div>Загрузка статистики...</div>
        )}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Проверка решений</h2>
          {attempts.length ? (
            attempts.map((attempt) => (
              <div key={attempt.id} className="border-b py-4">
                <p>
                  Тема:{" "}
                  <NavLink
                    to={`/themes/${attempt.theme_id}/tasks`}
                    className="text-purple-600 hover:underline"
                  >
                    {attempt.theme_name}
                  </NavLink>
                </p>
                <p>
                  Задача:{" "}
                  <NavLink
                    to={`/tasks/${attempt.task_id}`}
                    className="text-pink-600 hover:underline"
                  >
                    {attempt.task_name}
                  </NavLink>
                </p>
                <p>
                  Ученик (username):{" "}
                  <NavLink
                    to={`/users/${attempt.student_id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {attempt.student_username}
                  </NavLink>
                </p>
                <p>Ответ: {attempt.answer}</p>
                {attempt.image_data && (
                  <img
                    src={attempt.image_data}
                    alt="Решение"
                    className="max-w-xs my-2 cursor-pointer"
                    onClick={() => handleImageClick(attempt.image_data)}
                  />
                )}
                <p>Системная оценка: {attempt.system_grade ?? "Нет"}</p>
                <p>
                  Оценка учителя: {attempt.teacher_grade ?? "Не выставлена"}
                </p>
                <div className="mt-2 flex items-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Оценка"
                    value={grades[attempt.id] || ""}
                    className="p-2 border rounded mr-2 w-20"
                    onChange={(e) =>
                      setGrades((prev) => ({
                        ...prev,
                        [attempt.id]: e.target.value,
                      }))
                    }
                  />
                  <button
                    onClick={() =>
                      handleGrade(attempt.id, grades[attempt.id] || "")
                    }
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Выставить оценку
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p>Нет попыток для проверки</p>
          )}
        </div>
      </div>

      {/* Модальное окно для увеличенного аватара */}
      <AnimatePresence>
        {selectedAvatar && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={handleCloseModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="relative bg-white p-4 rounded-lg max-w-3xl max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <button
                onClick={handleCloseModal}
                className="absolute top-2 right-2 bg-gray-200 rounded-full p-2 text-gray-600 hover:bg-gray-300 hover:text-gray-900 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <img
                src={selectedAvatar}
                alt="Увеличенный аватар"
                className="max-w-full max-h-[80vh] object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно для увеличенной картинки попытки */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={handleCloseModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className="relative bg-white p-4 rounded-lg max-w-3xl max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <button
                onClick={handleCloseModal}
                className="absolute top-2 right-2 bg-gray-200 rounded-full p-2 text-gray-600 hover:bg-gray-300 hover:text-gray-900 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <img
                src={selectedImage}
                alt="Увеличенная картинка"
                className="max-w-full max-h-[80vh] object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
