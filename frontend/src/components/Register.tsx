// src/components/Register.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Auth.css";
import { registerUser } from "../api/Auth";

const Register: React.FC = () => {
  const [firstName, setFirstName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const response = await registerUser({
        first_name: firstName,
        role,
        username,
        password,
      });

      if (response.status === 200 || response.status === 201) {
        navigate("/login");
      }
    } catch (err) {
      setError("Ошибка при регистрации");
    }
  };

  return (
    <div className="auth-container">
      <h2>Регистрация</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label>Имя</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            placeholder="Введите имя"
          />
        </div>
        <div className="form-group">
          <label>Имя пользователя (username)</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Введите username"
          />
        </div>
        <div className="form-group">
          <label>Роль</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            placeholder="Введите роль"
          />
        </div>
        <div className="form-group">
          <label>Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Введите пароль"
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="auth-button">
          Зарегистрироваться
        </button>
      </form>
      <p className="redirect">
        Уже есть аккаунт? <a href="/login">Войти</a>
      </p>
    </div>
  );
};

export default Register;
