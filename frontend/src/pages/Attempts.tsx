import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { AxiosError } from "axios";
import { useAuth } from "../contexts/AuthContext";
import { NavLink } from "react-router-dom";
import * as apiService from "../services/apiService";
import { motion, AnimatePresence } from "framer-motion";

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
  status: string;
  system_grade: number | null;
  teacher_grade: number | null;
  created_at: string;
  image_data: string | null;
}

export const Attempts = () => {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [grades, setGrades] = useState<{ [key: number]: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Attempt | "student_username" | "task_author_username";
    direction: "asc" | "desc" | null;
  }>({ key: "created_at", direction: "desc" });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchAttempts = async () => {
      try {
        let response;
        if (user.role === "student") {
          response = await apiService.getStudentAttempts(user.token);
        } else if (user.role === "teacher") {
          response = await apiService.getTeacherAttempts(user.token);
        } else {
          response = await apiService.getAdminAttempts(user.token);
        }
        setAttempts(response.data);
        console.log(response.data);
        setError(null);
      } catch (err) {
        const axiosError = err as AxiosError<{ detail?: string }>;
        setError(
          axiosError.response?.data?.detail || "Ошибка загрузки попыток"
        );
      }
    };
    fetchAttempts();
  }, [user]);

  const handleSort = (
    key: keyof Attempt | "student_username" | "task_author_username",
    direction: "asc" | "desc"
  ) => {
    setSortConfig({ key, direction });

    setAttempts((prev) => {
      const sorted = [...prev].sort((a, b) => {
        let aValue = a[key] ?? "";
        let bValue = b[key] ?? "";

        if (key === "system_grade" || key === "teacher_grade") {
          aValue = aValue === null ? -1 : aValue;
          bValue = bValue === null ? -1 : bValue;
        }

        if (key === "created_at") {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        }

        if (aValue < bValue) return direction === "asc" ? -1 : 1;
        if (aValue > bValue) return direction === "asc" ? 1 : -1;
        return 0;
      });
      return sorted;
    });
  };

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
      setAttempts((prev) =>
        prev.map((attempt) =>
          attempt.id === attemptId
            ? { ...attempt, teacher_grade: grade }
            : attempt
        )
      );
      setGrades((prev) => ({ ...prev, [attemptId]: "" }));
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert(
        axiosError.response?.data?.detail || "Ошибка при выставлении оценки"
      );
    }
  };

  const getGradeColor = (grade: number | null) => {
    if (grade === 100) return "text-green-600";
    if (grade === 0) return "text-red-600";
    if (grade === null) return "text-yellow-600";
    return "";
  };

  const handleImageClick = (imageData: string | null) => {
    if (imageData) {
      setSelectedImage(imageData);
    }
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
  };

  if (!user) {
    return <div>Пожалуйста, войдите в систему</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 pt-20">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Попытки</h1>
        {error && <div className="text-red-600 mb-4">{error}</div>}
        <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-200">
                {(user.role === "admin" || user.role === "teacher") && (
                  <th className="px-4 py-2 text-left">
                    <div className="flex items-center justify-between">
                      <span>Отправитель</span>
                      <div className="flex flex-col gap-1">
                        {sortConfig.key === "student_username" ? (
                          sortConfig.direction === "desc" ? (
                            <button
                              onClick={() =>
                                handleSort("student_username", "asc")
                              }
                              className="p-1 bg-gray-300 rounded-sm text-white"
                              title="Сортировать по возрастанию"
                            >
                              ▲
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handleSort("student_username", "desc")
                              }
                              className="p-1 bg-gray-300 rounded-sm text-white"
                              title="Сортировать по убыванию"
                            >
                              ▼
                            </button>
                          )
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                handleSort("student_username", "asc")
                              }
                              className="p-1 bg-gray-300 rounded-sm text-gray-900"
                              title="Сортировать по возрастанию"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() =>
                                handleSort("student_username", "desc")
                              }
                              className="p-1 bg-gray-300 rounded-sm text-gray-900"
                              title="Сортировать по убыванию"
                            >
                              ▼
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </th>
                )}
                <th className="px-4 py-2 text-left">
                  <div className="flex items-center justify-between">
                    <span>Тема</span>
                    <div className="flex flex-col gap-1">
                      {sortConfig.key === "theme_name" ? (
                        sortConfig.direction === "desc" ? (
                          <button
                            onClick={() => handleSort("theme_name", "asc")}
                            className="p-1 bg-gray-300 rounded-sm text-white"
                            title="Сортировать по возрастанию"
                          >
                            ▲
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSort("theme_name", "desc")}
                            className="p-1 bg-gray-300 rounded-sm text-white"
                            title="Сортировать по убыванию"
                          >
                            ▼
                          </button>
                        )
                      ) : (
                        <>
                          <button
                            onClick={() => handleSort("theme_name", "asc")}
                            className="p-1 bg-gray-300 rounded-sm text-gray-900"
                            title="Сортировать по возрастанию"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleSort("theme_name", "desc")}
                            className="p-1 bg-gray-300 rounded-sm text-gray-900"
                            title="Сортировать по убыванию"
                          >
                            ▼
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </th>
                <th className="px-4 py-2 text-left">
                  <div className="flex items-center justify-between">
                    <span>Задача</span>
                    <div className="flex flex-col gap-1">
                      {sortConfig.key === "task_name" ? (
                        sortConfig.direction === "desc" ? (
                          <button
                            onClick={() => handleSort("task_name", "asc")}
                            className="p-1 bg-gray-300 rounded-sm text-white"
                            title="Сортировать по возрастанию"
                          >
                            ▲
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSort("task_name", "desc")}
                            className="p-1 bg-gray-300 rounded-sm text-white"
                            title="Сортировать по убыванию"
                          >
                            ▼
                          </button>
                        )
                      ) : (
                        <>
                          <button
                            onClick={() => handleSort("task_name", "asc")}
                            className="p-1 bg-gray-300 rounded-sm text-gray-900"
                            title="Сортировать по возрастанию"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleSort("task_name", "desc")}
                            className="p-1 bg-gray-300 rounded-sm text-gray-900"
                            title="Сортировать по убыванию"
                          >
                            ▼
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </th>
                {user.role !== "teacher" && (
                  <th className="px-4 py-2 text-left">
                    <div className="flex items-center justify-between">
                      <span>Автор задачи</span>
                      <div className="flex flex-col gap-1">
                        {sortConfig.key === "task_author_username" ? (
                          sortConfig.direction === "desc" ? (
                            <button
                              onClick={() =>
                                handleSort("task_author_username", "asc")
                              }
                              className="p-1 bg-gray-300 rounded-sm text-white"
                              title="Сортировать по возрастанию"
                            >
                              ▲
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handleSort("task_author_username", "desc")
                              }
                              className="p-1 bg-gray-300 rounded-sm text-white"
                              title="Сортировать по убыванию"
                            >
                              ▼
                            </button>
                          )
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                handleSort("task_author_username", "asc")
                              }
                              className="p-1 bg-gray-300 rounded-sm text-gray-900"
                              title="Сортировать по возрастанию"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() =>
                                handleSort("task_author_username", "desc")
                              }
                              className="p-1 bg-gray-300 rounded-sm text-gray-900"
                              title="Сортировать по убыванию"
                            >
                              ▼
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </th>
                )}
                {(user.role === "student" ||
                  user.role === "admin" ||
                  user.role === "teacher") && (
                  <th className="px-4 py-2 text-left">
                    <span>
                      {user.role === "student" ? "Мой ответ" : "Ответ ученика"}
                    </span>
                  </th>
                )}
                {(user.role === "student" ||
                  user.role === "admin" ||
                  user.role === "teacher") && (
                  <th className="px-4 py-2 text-left">
                    <span>
                      {user.role === "student"
                        ? "Картинка"
                        : "Картинка ученика"}
                    </span>
                  </th>
                )}
                {(user.role === "admin" || user.role === "teacher") && (
                  <th className="px-4 py-2 text-left">
                    <span>Ответ системы</span>
                  </th>
                )}
                <th className="px-4 py-2 text-left">
                  <div className="flex items-center justify-between">
                    <span>Оценка системы</span>
                    <div className="flex flex-col gap-1">
                      {sortConfig.key === "system_grade" ? (
                        sortConfig.direction === "desc" ? (
                          <button
                            onClick={() => handleSort("system_grade", "asc")}
                            className="p-1 bg-gray-300 rounded-sm text-white"
                            title="Сортировать по возрастанию"
                          >
                            ▲
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSort("system_grade", "desc")}
                            className="p-1 bg-gray-300 rounded-sm text-white"
                            title="Сортировать по убыванию"
                          >
                            ▼
                          </button>
                        )
                      ) : (
                        <>
                          <button
                            onClick={() => handleSort("system_grade", "asc")}
                            className="p-1 bg-gray-300 rounded-sm text-gray-900"
                            title="Сортировать по возрастанию"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleSort("system_grade", "desc")}
                            className="p-1 bg-gray-300 rounded-sm text-gray-900"
                            title="Сортировать по убыванию"
                          >
                            ▼
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </th>
                <th className="px-4 py-2 text-left">
                  <div className="flex items-center justify-between">
                    <span>Оценка преподавателя</span>
                    <div className="flex flex-col gap-1">
                      {sortConfig.key === "teacher_grade" ? (
                        sortConfig.direction === "desc" ? (
                          <button
                            onClick={() => handleSort("teacher_grade", "asc")}
                            className="p-1 bg-gray-300 rounded-sm text-white"
                            title="Сортировать по возрастанию"
                          >
                            ▲
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSort("teacher_grade", "desc")}
                            className="p-1 bg-gray-300 rounded-sm text-white"
                            title="Сортировать по убыванию"
                          >
                            ▼
                          </button>
                        )
                      ) : (
                        <>
                          <button
                            onClick={() => handleSort("teacher_grade", "asc")}
                            className="p-1 bg-gray-300 rounded-sm text-gray-900"
                            title="Сортировать по возрастанию"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleSort("teacher_grade", "desc")}
                            className="p-1 bg-gray-300 rounded-sm text-gray-900"
                            title="Сортировать по убыванию"
                          >
                            ▼
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </th>
                <th className="px-4 py-2 text-left">
                  <div className="flex items-center justify-between">
                    <span>Дата и время</span>
                    <div className="flex flex-col gap-1">
                      {sortConfig.key === "created_at" ? (
                        sortConfig.direction === "desc" ? (
                          <button
                            onClick={() => handleSort("created_at", "asc")}
                            className="p-1 bg-gray-300 rounded-sm text-white"
                            title="Сортировать по возрастанию"
                          >
                            ▲
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSort("created_at", "desc")}
                            className="p-1 bg-gray-300 rounded-sm text-white"
                            title="Сортировать по убыванию"
                          >
                            ▼
                          </button>
                        )
                      ) : (
                        <>
                          <button
                            onClick={() => handleSort("created_at", "asc")}
                            className="p-1 bg-gray-300 rounded-sm text-gray-900"
                            title="Сортировать по возрастанию"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => handleSort("created_at", "desc")}
                            className="p-1 bg-gray-300 rounded-sm text-gray-900"
                            title="Сортировать по убыванию"
                          >
                            ▼
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {attempts.length ? (
                attempts.map((attempt) => (
                  <tr key={attempt.id} className="border-b">
                    {(user.role === "admin" || user.role === "teacher") && (
                      <td className="px-4 py-2">
                        {attempt.student_id && attempt.student_username ? (
                          <NavLink
                            to={`/users/${attempt.student_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {attempt.student_username}
                          </NavLink>
                        ) : (
                          "Неизвестно"
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <NavLink
                        to={`/themes/${attempt.theme_id}/tasks`}
                        className="text-purple-600 hover:underline"
                      >
                        {attempt.theme_name}
                      </NavLink>
                    </td>
                    <td className="px-4 py-2">
                      <NavLink
                        to={`/tasks/${attempt.task_id}`}
                        className="text-pink-600 hover:underline"
                      >
                        {attempt.task_name}
                      </NavLink>
                    </td>
                    {user.role !== "teacher" && (
                      <td className="px-4 py-2">
                        {attempt.task_author_id &&
                        attempt.task_author_username ? (
                          <NavLink
                            to={`/users/${attempt.task_author_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {attempt.task_author_username}
                          </NavLink>
                        ) : (
                          "Неизвестно"
                        )}
                      </td>
                    )}
                    {(user.role === "student" ||
                      user.role === "admin" ||
                      user.role === "teacher") && (
                      <td className="px-4 py-2 max-w-xs truncate">
                        {attempt.answer || "Нет ответа"}
                      </td>
                    )}
                    {(user.role === "student" ||
                      user.role === "admin" ||
                      user.role === "teacher") && (
                      <td className="px-4 py-2">
                        {attempt.image_data ? (
                          <img
                            src={attempt.image_data}
                            alt="Попытка"
                            className="w-12 h-12 object-cover cursor-pointer rounded"
                            onClick={() => handleImageClick(attempt.image_data)}
                          />
                        ) : (
                          "Нет картинки"
                        )}
                      </td>
                    )}
                    {(user.role === "admin" || user.role === "teacher") && (
                      <td className="px-4 py-2 max-w-xs truncate">
                        {attempt.system_answer || "Нет ответа"}
                      </td>
                    )}
                    <td
                      className={`px-4 py-2 ${getGradeColor(
                        attempt.system_grade
                      )}`}
                    >
                      {attempt.system_grade ?? "Не проверено"}
                    </td>
                    <td className="px-4 py-2">
                      {user.role === "teacher" ? (
                        <div className="flex items-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder={
                              attempt.teacher_grade?.toString() ?? "Оценка"
                            }
                            value={grades[attempt.id] || ""}
                            className="p-2 border rounded w-20 mr-2"
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
                            Сохранить
                          </button>
                        </div>
                      ) : (
                        <span className={getGradeColor(attempt.teacher_grade)}>
                          {attempt.teacher_grade ?? "Не проверено"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {format(new Date(attempt.created_at), "dd.MM.yyyy HH:mm")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={
                      user.role === "student"
                        ? 8
                        : user.role === "teacher"
                        ? 8
                        : 10
                    }
                    className="px-4 py-2 text-center"
                  >
                    Нет попыток
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
