import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/Tasks.css";
import { User, Task, Theme } from "../types/TaskManager";
import { getUserPosibility, setPossibilityAuthToken } from "../api/Auth";
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  fetchThemeById,
  setTaskManagerAuthToken,
} from "../api/TaskManager";

const Tasks: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState<string>("");
  const [newTaskCondition, setNewTaskCondition] = useState<string>("");
  const [newTaskAnswer, setNewTaskAnswer] = useState<string>("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editCondition, setEditCondition] = useState<string>("");
  const [editAnswer, setEditAnswer] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(
    null
  );
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();
  const { themeId } = useParams<{ themeId: string }>();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsAuthenticated(false);
      navigate("/login");
      return;
    }

    setPossibilityAuthToken(token);
    setTaskManagerAuthToken(token);
    setIsAuthenticated(true);

    const loadData = async () => {
      try {
        console.log("Загружаем данные пользователя...");
        const userData = await getUserPosibility();
        console.log("Данные пользователя:", userData);
        setUser(userData);

        console.log("Загружаем тему:", themeId);
        const themeData = await fetchThemeById(Number(themeId)); // Используем fetchThemeById
        console.log("Данные темы:", themeData);
        if (!themeData.id) {
          throw new Error("Тема не найдена");
        }
        setTheme(themeData);

        console.log("Загружаем задачи для темы:", themeId);
        const tasksData = await fetchTasks(Number(themeId));
        console.log("Данные задач:", tasksData);
        setTasks(tasksData);
      } catch (err) {
        setError("Ошибка загрузки данных или тема не найдена");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        setIsAuthenticated(false);
        navigate("/login");
      }
    };

    loadData();
  }, [navigate, themeId]);

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskAnswer.trim() || !themeId) {
      setError("Название и ответ обязательны");
      return;
    }

    try {
      const newTask = await createTask({
        title: newTaskTitle,
        condition: newTaskCondition || "",
        theme_id: Number(themeId),
        answer: newTaskAnswer,
      });
      console.log("Успешно созданная задача:", newTask);
      setTasks([...tasks, newTask]);
      setNewTaskTitle("");
      setNewTaskCondition("");
      setNewTaskAnswer("");
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не удалось создать задачу");
    }
  };

  const handleEditStart = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditCondition(task.condition || "");
    setEditAnswer(""); // Ответ не редактируется напрямую
  };

  const handleEditSubmit = async (id: number) => {
    if (!editTitle.trim() || !themeId) {
      setError("Название обязательно");
      return;
    }

    try {
      const updatedTask = await updateTask(id, {
        title: editTitle,
        condition: editCondition || "",
        answer: editAnswer || "default_answer", // Заглушка для ответа
      });
      console.log("Успешно обновленная задача:", updatedTask);
      setTasks(tasks.map((task) => (task.id === id ? updatedTask : task)));
      setEditingTaskId(null);
      setEditTitle("");
      setEditCondition("");
      setEditAnswer("");
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не удалось обновить задачу");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTask(id);
      console.log("Задача удалена:", id);
      setTasks(tasks.filter((task) => task.id !== id));
      setShowDeleteConfirm(null);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не удалось удалить задачу");
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className="tasks-container">
      <header className="tasks-header">
        <h1>Задачи для темы "{theme?.title || `Тема #${themeId}`}"</h1>
        <button
          className="back-button"
          onClick={() => handleNavigation("/themes")}
        >
          Назад к темам
        </button>
      </header>

      <main className="tasks-content">
        {error && <p className="error">{error}</p>}

        <div className="tasks-list">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <div key={task.id} className="task-item">
                {editingTaskId === task.id ? (
                  <>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Введите название задачи"
                      required
                    />
                    <textarea
                      value={editCondition}
                      onChange={(e) => setEditCondition(e.target.value)}
                      placeholder="Введите условие задачи"
                      rows={4}
                    />
                    <div className="task-actions">
                      <button onClick={() => handleEditSubmit(task.id)}>
                        Сохранить
                      </button>
                      <button onClick={() => setEditingTaskId(null)}>
                        Отмена
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="task-header">
                      <h3>{task.title}</h3>
                      {isAuthenticated && user?.role !== "student" && (
                        <div className="task-actions">
                          <button onClick={() => handleEditStart(task)}>
                            Изменить
                          </button>
                          <button onClick={() => setShowDeleteConfirm(task.id)}>
                            Удалить
                          </button>
                        </div>
                      )}
                    </div>
                    <p>{task.condition || "Условие отсутствует"}</p>
                    {showDeleteConfirm === task.id && (
                      <div className="delete-confirm">
                        <p>Вы уверены, что хотите удалить "{task.title}"?</p>
                        <button onClick={() => handleDelete(task.id)}>
                          Да
                        </button>
                        <button onClick={() => setShowDeleteConfirm(null)}>
                          Нет
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          ) : (
            <p>Список задач пуст</p>
          )}
        </div>

        {isAuthenticated && user?.role !== "student" && (
          <form onSubmit={handleTaskSubmit} className="task-form">
            <h3>
              Создать задачу для темы "{theme?.title || `Тема #${themeId}`}"
            </h3>
            <div className="form-group">
              <label>Название задачи</label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Введите название задачи"
                required
              />
            </div>
            <div className="form-group">
              <label>Условие задачи (опционально)</label>
              <textarea
                value={newTaskCondition}
                onChange={(e) => setNewTaskCondition(e.target.value)}
                placeholder="Введите условие задачи"
                rows={4}
              />
            </div>
            <div className="form-group">
              <label>Ответ</label>
              <input
                type="text"
                value={newTaskAnswer}
                onChange={(e) => setNewTaskAnswer(e.target.value)}
                placeholder="Введите ответ"
                required
              />
            </div>
            <button type="submit" className="task-button">
              Добавить задачу
            </button>
          </form>
        )}
      </main>

      <footer className="tasks-footer">
        <p>© 2025 Обучающий портал. Все права защищены.</p>
      </footer>
    </div>
  );
};

export default Tasks;
