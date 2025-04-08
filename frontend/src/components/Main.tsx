import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Main.css";
import { User } from "../types/TaskManager";
import { getUserPosibility, setPossibilityAuthToken } from "../api/Auth";

const Main: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const navigate = useNavigate();
  const [user, setUser] = useState<User|null>(null);
  const [error, setError] = useState<string>("");

  let timeoutId: NodeJS.Timeout | null = null;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsAuthenticated(false);
      navigate("/login"); // Перенаправляем на логин, если токена нет
      return;
    }

    setPossibilityAuthToken(token); // Устанавливаем токен для запросов к api_possibility
    setIsAuthenticated(true);

    const loadData = async () => {
      try {
        const userData = await getUserPosibility();
        console.log(userData);
        setUser(userData);
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
    

  // Проверка авторизации
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token); // Если токен есть, пользователь авторизован
  }, []);

  // Обработка выхода
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setIsAuthenticated(false);
    navigate("/login");
  };

  // Навигация по ссылкам
  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleMouseEnter = () => {
    if (timeoutId) clearTimeout(timeoutId); // Отменяем закрытие, если оно было запланировано
    setShowDropdown(true);
  };

  const handleMouseLeave = () => {
    timeoutId = setTimeout(() => {
      setShowDropdown(false);
    }, 100); // Задержка 300мс перед закрытием
  };

  return (
    <div className="main-container">
      {/* Шапка */}
      <header className="main-header">
        <div className="nav-links">
          <button
            className="nav-button"
            onClick={() => handleNavigation("/themes")}
          >
            Темы
          </button>
          <button
            className="nav-button"
            onClick={() => handleNavigation("/tasks")}
          >
            Задачи
          </button>
        </div>

        <div className="auth-section">
          {isAuthenticated ? (
            <div
              className="user-avatar"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <img
                src={user?.image} // Замените на реальный URL аватара
                alt="User Avatar"
                className="avatar-img"
              />
              {showDropdown && (
                <div className="dropdown-menu">
                  <button
                    className="dropdown-item"
                    onClick={() => handleNavigation("/profile")}
                  >
                    Профиль
                  </button>
                  <button className="dropdown-item" onClick={handleLogout}>
                    Выйти
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <button
                className="auth-button"
                onClick={() => handleNavigation("/login")}
              >
                Вход
              </button>
              <button
                className="auth-button"
                onClick={() => handleNavigation("/register")}
              >
                Регистрация
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Основной контент */}
      <main className="main-content">
        <h1>Добро пожаловать на наш сайт!</h1>
        <p className="site-description">
          Этот сайт создан для обучения и управления задачами. Здесь вы найдете
          множество тем и практических заданий, которые помогут вам развить
          свои навыки. Присоединяйтесь к нам, чтобы начать свой путь к знаниям!
        </p>
        <div className="features">
          <div className="feature-item">
            <h3>Изучайте темы</h3>
            <p>Раздел "Темы" содержит полезные материалы для обучения.</p>
          </div>
          <div className="feature-item">
            <h3>Решайте задачи</h3>
            <p>Практикуйтесь с задачами разной сложности в разделе "Задачи".</p>
          </div>
          <div className="feature-item">
            <h3>Отслеживайте прогресс</h3>
            <p>Следите за своими достижениями в профиле.</p>
          </div>
        </div>
      </main>

      {/* Футер */}
      <footer className="main-footer">
        <p>&copy; 2025 Обучающий портал. Все права защищены.</p>
      </footer>
    </div>
  );
};

export default Main;