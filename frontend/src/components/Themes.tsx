import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Themes.css";
import { User, Theme } from "../types/TaskManager";
import { getUserPosibility, setPossibilityAuthToken } from "../api/Auth";
import {
  fetchThemes,
  createTheme,
  setTaskManagerAuthToken,
  updateTheme,
  deleteTheme,
} from "../api/TaskManager";

const Themes: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [newThemeTitle, setNewThemeTitle] = useState<string>("");
  const [newThemeDescription, setNewThemeDescription] = useState<string>("");
  const [editingThemeId, setEditingThemeId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(
    null
  );
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();

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

        console.log("Загружаем темы...");
        const themesData = await fetchThemes();
        console.log("Данные тем:", themesData);
        setThemes(themesData);
      } catch (err) {
        setError("Ошибка загрузки данных");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        setIsAuthenticated(false);
        navigate("/login");
      }
    };

    loadData();
  }, [navigate]);

  const handleThemeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThemeTitle.trim()) {
      setError("Название темы не может быть пустым");
      return;
    }

    try {
      const newTheme = await createTheme({
        title: newThemeTitle,
        description: newThemeDescription,
      });
      console.log("Успешно созданная тема:", newTheme);
      setThemes([...themes, newTheme]);
      setNewThemeTitle("");
      setNewThemeDescription("");
      setError("");
    } catch (err) {
      setError("Не удалось создать тему");
    }
  };

  const handleEditStart = (theme: Theme) => {
    setEditingThemeId(theme.id);
    setEditTitle(theme.title);
    setEditDescription(theme.description || "");
  };

  const handleEditSubmit = async (id: number) => {
    if (!editTitle.trim()) {
      setError("Название темы не может быть пустым");
      return;
    }

    try {
      const updatedTheme = await updateTheme(id, {
        title: editTitle,
        description: editDescription,
      });
      console.log("Успешно обновленная тема:", updatedTheme);
      setThemes(
        themes.map((theme) => (theme.id === id ? updatedTheme : theme))
      );
      setEditingThemeId(null);
      setEditTitle("");
      setEditDescription("");
      setError("");
    } catch (err) {
      setError("Не удалось обновить тему");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTheme(id);
      console.log("Тема удалена:", id);
      setThemes(themes.filter((theme) => theme.id !== id));
      setShowDeleteConfirm(null);
      setError("");
    } catch (err) {
      setError("Не удалось удалить тему");
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className="themes-container">
      <header className="themes-header">
        <h1>Темы</h1>
        <button
          className="back-button"
          onClick={() => handleNavigation("/main")}
        >
          Назад
        </button>
      </header>

      <main className="themes-content">
        {error && <p className="error">{error}</p>}

        <div className="themes-list">
          {themes.length > 0 ? (
            themes.map((theme) => (
              <div key={theme.id} className="theme-item">
                {editingThemeId === theme.id ? (
                  <>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Введите название темы"
                      required
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Введите описание темы"
                      rows={4}
                    />
                    <div className="theme-actions">
                      <button onClick={() => handleEditSubmit(theme.id)}>
                        Сохранить
                      </button>
                      <button onClick={() => setEditingThemeId(null)}>
                        Отмена
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="theme-header">
                      <h3>{theme.title}</h3>
                      {isAuthenticated && user?.role === "admin" && (
                        <div className="theme-actions">
                          <button onClick={() => handleEditStart(theme)}>
                            Изменить
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(theme.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      )}
                    </div>
                    <p>{theme.description || "Описание отсутствует"}</p>
                    {showDeleteConfirm === theme.id && (
                      <div className="delete-confirm">
                        <p>Вы уверены, что хотите удалить "{theme.title}"?</p>
                        <button onClick={() => handleDelete(theme.id)}>
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
            <p>Список тем пуст</p>
          )}
        </div>

        {isAuthenticated && user?.role === "admin" && (
          <form onSubmit={handleThemeSubmit} className="theme-form">
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
            <div className="form-group">
              <label>Описание темы</label>
              <textarea
                value={newThemeDescription}
                onChange={(e) => setNewThemeDescription(e.target.value)}
                placeholder="Введите описание темы"
                rows={4}
              />
            </div>
            <button type="submit" className="theme-button">
              Добавить тему
            </button>
          </form>
        )}
      </main>

      <footer className="themes-footer">
        <p>© 2025 Обучающий портал. Все права защищены.</p>
      </footer>
    </div>
  );
};

export default Themes;
