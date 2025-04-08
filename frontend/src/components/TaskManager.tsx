// TaskManager.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchThemes,
  fetchTasks,
  createTask,
  setTaskManagerAuthToken,
} from "../api/TaskManager";
import { getUserPosibility, setPossibilityAuthToken } from "../api/Auth";
import "../styles/TaskManager.css";
import { User, Theme, Task } from "../types/TaskManager";

const TaskManager: React.FC = () => {
  const [user, setUser] = useState<User | null>(null); // Пользователь из токена
  const [Themes, setThemes] = useState<Theme[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [newThemeTitle, setNewThemeTitle] = useState<string>("");
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    ThemeId: "",
  });
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();

  // Инициализация токена и загрузка данных
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login"); // Если токена нет, перенаправляем на логин
      return;
    }

    setPossibilityAuthToken(token); // Устанавливаем токен для всех запросов
    setTaskManagerAuthToken(token);

    // Декодируем токен для получения роли (пример с JWT)

    const loadData = async () => {
      try {
        const UserData = await getUserPosibility();
        const ThemesData = await fetchThemes();
        //const tasksData = await fetchTasks();
        setUser(UserData);
        setThemes(ThemesData);
        //setTasks(tasksData);
      } catch (err) {
        setError("Ошибка загрузки данных");
      }
    };
    loadData();
  }, [navigate]);
  

  // Обработка поиска
  const filteredThemes = Themes.filter((Theme) =>
    Theme.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  //const filteredTasks = tasks.filter(
  //  (task) =>
      //task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      //task.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      //task.type.toLowerCase().includes(searchQuery.toLowerCase())
  //);

  // Создание темы
  const handleThemeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== "admin") return;
    try {
      // const newTheme = await createTheme(newThemeTitle);
      // setThemes([...Themes, newTheme]);
      setNewThemeTitle("");
    } catch (err) {
      setError("Ошибка создания темы");
    }
  };

  // Создание задачи
  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== "admin" && user?.role !== "teacher") return;
    if (!newTask.title || !newTask.ThemeId) {
      setError("Заполните все поля");
      return;
    }
    try {
      const taskData = {
        title: newTask.title,
        description: newTask.description,
        themeId: Number(newTask.ThemeId),
      };
      // const newTaskResponse = await createTask(taskData);
      //setTasks([...tasks, newTaskResponse]);
      setNewTask({ title: "", description: "", ThemeId: "" });
    } catch (err) {
      setError("Ошибка создания задачи");
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="task-manager-container">
      <h2>Управление заданиями</h2>

      {/* Поиск */}
      <div className="form-group">
        <label>Поиск</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск тем или задач"
          className="search-input"
        />
      </div>

      {/* Форма создания темы (только для админа) */}
      {user.role === "admin" && (
        <form onSubmit={handleThemeSubmit} className="task-form">
          <h3>Создать тему</h3>
          <div className="form-group">
            <label>Название темы</label>
            <input
              type="text"
              value={newThemeTitle}
              onChange={(e) => setNewThemeTitle(e.target.value)}
              placeholder="Введите название темы"
              required
            />
          </div>
          <button type="submit" className="task-button">
            Добавить тему
          </button>
        </form>
      )}

      {/* Форма создания задачи (для админа и учителя) */}
      {(user.role === "admin" || user.role === "teacher") && (
        <form onSubmit={handleTaskSubmit} className="task-form">
          <h3>Создать задачу</h3>
          <div className="form-group">
            <label>Название задачи</label>
            <input
              type="text"
              value={newTask.title}
              onChange={(e) =>
                setNewTask({ ...newTask, title: e.target.value })
              }
              placeholder="Введите название задачи"
              required
            />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea
              value={newTask.description}
              onChange={(e) =>
                setNewTask({ ...newTask, description: e.target.value })
              }
              placeholder="Введите описание задачи"
            />
          </div>
          <div className="form-group">
            <label>Тема</label>
            <select
              value={newTask.ThemeId}
              onChange={(e) =>
                setNewTask({ ...newTask, ThemeId: e.target.value })
              }
              required
            >
              <option value="">Выберите тему</option>
              {Themes.map((Theme) => (
                <option key={Theme.id} value={Theme.id}>
                  {Theme.title}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="task-button">
            Добавить задачу
          </button>
        </form>
      )}

      {/* Список тем и задач */}
      <div className="task-list">
        <h3>Список тем и задач</h3>
        {error && <p className="error">{error}</p>}
        {filteredThemes.map((Theme) => (
          <div key={Theme.id} className="Theme-item">
            <h4>{Theme.title}</h4>
            <ul>
              {/*{filteredTasks
                .filter((task) => task.theme_id === Theme.id)
                .map((task) => (
                  <li key={task.id} className="task-item">
                    <strong>{task.title}</strong>
                    <p>{task.condition}</p>
                  </li>
                ))}*/}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskManager;
