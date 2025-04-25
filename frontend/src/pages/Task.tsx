import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { useAuth } from "../contexts/AuthContext";
import * as apiService from "../services/apiService";
import { motion, AnimatePresence } from "framer-motion";

interface Task {
  id: number;
  title: string;
  condition: string | null;
  answer_id: number;
  theme_id: number;
  user_id: number;
}

export const Task = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [answer, setAnswer] = useState<string>("");
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!taskId) return;

    apiService
      .getTask(taskId)
      .then((response) => {
        const taskData = response.data;
        if (!taskData || typeof taskData.title !== "string") {
          throw new Error(
            `Invalid task data received ${typeof taskData.title}`
          );
        }
        setTask(taskData);
        console.log("Task data: ", taskData, {
          title: taskData.title,
          titleType: typeof taskData.title,
          condition: taskData.condition,
          conditionType: typeof taskData.condition,
        });
        return apiService.getTasks({ theme_id: taskData.theme_id });
      })
      .then((response) => setTasks(response.data))
      .catch((err: AxiosError<{ detail?: string }>) => {
        console.error("Failed to fetch task or tasks:", err);
        setError(
          err.response?.data?.detail || err.message || "Ошибка загрузки задачи"
        );
      });
  }, [taskId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(",")[1];
        setImage(reader.result as string);
        setFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageClick = (image: string) => {
    setSelectedImage(image);
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
  };

  // Закрытие модального окна по клавише Esc
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseModal();
      }
    };
    if (selectedImage) {
      window.addEventListener("keydown", handleEsc);
    }
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [selectedImage]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!taskId || !user) return;

    try {
      await apiService.createAttempt(
        {
          task_id: parseInt(taskId),
          answer,
          image_data:
            image && fileName
              ? { image: image.split(",")[1], file_name: fileName }
              : undefined,
        },
        user.token
      );
      alert("Ответ отправлен!");
      setAnswer("");
      setImage(null);
      setFileName("");
      navigate("/attempts");
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(axiosError.response?.data?.detail || "Ошибка при отправке ответа");
    }
  };

  if (!taskId) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 pt-20 text-center">
        Задача не найдена
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 pt-20 flex">
      <div className="w-1/4 bg-white p-4 rounded-lg shadow-md mr-6">
        <h2 className="text-xl font-semibold mb-4">Задачи темы</h2>
        {tasks.length === 0 ? (
          <p>Задачи отсутствуют</p>
        ) : (
          tasks.map((t) => (
            <Link
              key={t.id}
              to={`/tasks/${t.id}`}
              className={`block p-2 hover:bg-gray-100 rounded ${
                t.id === parseInt(taskId) ? "bg-gray-200" : ""
              }`}
            >
              {t.title}
            </Link>
          ))
        )}
      </div>
      <div className="flex-1">
        {error ? (
          <div className="text-red-500">{error}</div>
        ) : task ? (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-4">
              {task.title || "Без названия"}
            </h1>
            <p className="mb-4">
              {task.condition !== null ? task.condition : "Без условия"}
            </p>
            {user &&
            (user.role === "student" ||
              (user.role === "teacher" && task.user_id !== user.id)) ? (
              <form onSubmit={handleSubmit}>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Введите ваш ответ"
                  className="w-full p-2 border rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="mb-4"
                />
                {image && (
                  <img
                    src={image}
                    alt="Предпросмотр"
                    className="max-w-xs mb-4 cursor-pointer"
                    onClick={() => handleImageClick(image)}
                  />
                )}
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Отправить ответ
                </button>
              </form>
            ) : !user ? (
              <div className="text-gray-600">
                <p className="mb-4">
                  Для отправки ответа необходимо авторизоваться.
                </p>
                <Link
                  to="/login"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Войти
                </Link>
              </div>
            ) : (
              <p className="text-gray-600">
                {user.role === "admin"
                  ? "Администраторы не могут отправлять ответы."
                  : "Авторы задачи не могут отправлять ответы."}
              </p>
            )}
          </div>
        ) : (
          <p>Загрузка...</p>
        )}
        {/* Модальное окно для предпросмотра изображения */}
        <AnimatePresence>
          {selectedImage && (
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
                  src={selectedImage}
                  alt="Увеличенное изображение"
                  className="max-w-full max-h-[80vh] object-contain"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
