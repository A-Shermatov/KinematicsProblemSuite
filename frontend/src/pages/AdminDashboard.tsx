import React, { useContext, useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import {
  ChartData,
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { AxiosError } from "axios";
import { AuthContext } from "../contexts/AuthContext";
import * as apiService from "../services/apiService";
import { motion, AnimatePresence } from "framer-motion";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Stats {
  users: number;
  teachers: number;
  students: number;
  themes: number;
  tasks: number;
  attempts: number;
  solved: number;
}

export const AdminDashboard = () => {
  const { user, updateUser } = useContext(AuthContext);
  const [stats, setStats] = useState<Stats | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    first_name: "",
    second_name: "",
    username: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);

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
      console.error("Ошибка при обновлении пользователя:", axiosError);
    }
  };

  const handleAvatarClick = (image: string | null) => {
    if (image) {
      setSelectedAvatar(image);
    }
  };

  const handleCloseModal = () => {
    setSelectedAvatar(null);
  };

  useEffect(() => {
    if (!user || !user.token) return;

    const fetchStats = async () => {
      try {
        const [usersRes, themesRes, tasksRes, attemptsRes] = await Promise.all([
          apiService.getUsers(user.token),
          apiService.getThemes(),
          apiService.getTasks(),
          apiService.getAdminAttempts(user.token),
        ]);
        const users = usersRes.data;
        const teachers = users.filter(
          (u: { role: string }) => u.role === "teacher"
        ).length;
        const students = users.filter(
          (u: { role: string }) => u.role === "student"
        ).length;
        const themes = themesRes.data.length;
        const tasks = tasksRes.data.length;
        const attempts = attemptsRes.data.length;
        const solved = attemptsRes.data.filter(
          (a: { status: string }) => a.status === "CORRECT"
        ).length;

        setStats({
          users: users.length,
          teachers,
          students,
          themes,
          tasks,
          attempts,
          solved,
        });
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();
  }, [user]);

  const data: ChartData<"pie", number[], string> | null = stats
    ? {
        labels: [
          "Пользователи",
          "Учителя",
          "Ученики",
          "Темы",
          "Задачи",
          "Попытки",
          "Решено",
        ],
        datasets: [
          {
            data: [
              stats.users,
              stats.teachers,
              stats.students,
              stats.themes,
              stats.tasks,
              stats.attempts,
              stats.solved,
            ],
            backgroundColor: [
              "#FF6384",
              "#36A2EB",
              "#FFCE56",
              "#4BC0C0",
              "#9966FF",
              "#FF9F40",
              "#C9CBCF",
            ],
          },
        ],
      }
    : null;

  if (!user) {
    return <div>Пожалуйста, войдите в систему</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 pt-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          Личный кабинет администратора
        </h1>
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
                  <span className="font-medium">Роль:</span> Администратор
                </p>
              </div>
            )}
          </div>
        </div>
        {stats && data && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Статистика</h2>
            <div className="max-w-md mx-auto">
              <Pie data={data} />
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedAvatar && (
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
                src={selectedAvatar}
                alt="Увеличенный аватар"
                className="max-w-full max-h-[80vh] object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
