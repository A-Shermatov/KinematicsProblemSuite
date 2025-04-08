import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, setPossibilityAuthToken } from "../api/Auth";
import { setTaskManagerAuthToken } from "../api/TaskManager";
import "../styles/Auth.css";

const Login: React.FC = () => {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await loginUser({ username, password });
      localStorage.setItem("token", response.access_token);
      // console.log(response);
      localStorage.setItem("refreshToken", response.refresh_token);
      setPossibilityAuthToken(response.access_token);
      setTaskManagerAuthToken(response.access_token);
      navigate("/");
      
    } catch (err) {
      setError("Неверный email или пароль");
    }
  };

  return (
    <div className="auth-container">
      <h2>Вход</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Введите username"
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
          Войти
        </button>
      </form>
      <p className="redirect">
        Нет аккаунта? <a href="/register">Зарегистрироваться</a>
      </p>
    </div>
  );
};

export default Login;
