import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AxiosError } from "axios";
import * as apiService from "../services/apiService";
import { motion, AnimatePresence } from "framer-motion";

interface User {
  id: number;
  username: string;
  first_name: string;
  second_name: string;
  role: "student" | "teacher" | "admin";
  image?: string;
}

export const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (!userId) {
          setError("ID пользователя не указан");
          return;
        }
        const response = await apiService.getUserById(parseInt(userId));
        setUser(response.data);
        setError(null);
      } catch (err) {
        const axiosError = err as AxiosError<{ detail?: string }>;
        setError(
          axiosError.response?.data?.detail || "Ошибка загрузки профиля"
        );
      }
    };
    fetchUser();
  }, [userId]);

  const handleAvatarClick = (image: string | undefined) => {
    if (image) {
      setSelectedAvatar(image);
    }
  };

  const handleCloseModal = () => {
    setSelectedAvatar(null);
  };

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseModal();
      }
    };
    if (selectedAvatar) {
      window.addEventListener("keydown", handleEsc);
    }
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [selectedAvatar]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 pt-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 pt-20">
        <div className="max-w-4xl mx-auto">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 pt-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Профиль пользователя</h1>
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row items-start gap-6">
          <div className="flex flex-col items-center">
            {user.image ? (
              <img
                src={user.image}
                alt="Аватар"
                className="w-24 h-24 rounded-full mb-4 object-cover border-2 border-gray-200 cursor-pointer"
                onClick={() => handleAvatarClick(user.image)}
              />
            ) : (
              <div className="w-24 h-24 rounded-full mb-4 bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-semibold">
                {user.first_name?.charAt(0) || user.username.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1">
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
                <span className="font-medium">Роль:</span>{" "}
                {user.role === "student"
                  ? "Ученик"
                  : user.role === "teacher"
                  ? "Учитель"
                  : "Администратор"}
              </p>
            </div>
          </div>
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
