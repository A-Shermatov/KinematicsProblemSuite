import React, { useState, ChangeEvent, FormEvent } from "react";
import { AxiosError } from 'axios';
import { useNavigate } from "react-router-dom";
import "../styles/Auth.css";
import { registerUser } from "../api/Auth";
import { RegisterFormData } from "../types/Auth";

const Register: React.FC = () => {
  const [firstName, setFirstName] = useState<string>("");
  const [secondName, setSecondName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      setPreview(null);
    }
  };

  const handleRoleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedRole = event.target.value as "student" | "teacher";
    setRole(selectedRole);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      let imageData: { image: string; file_name: string } | undefined;
      if (selectedFile) {
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);

        imageData = await new Promise((resolve) => {
          reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve({
              image: base64String,
              file_name: selectedFile.name,
            });
          };
        });
      }

      const registerData: RegisterFormData = {
        first_name: firstName,
        second_name: secondName,
        username,
        role,
        password,
        ...(imageData && { image_data: imageData }), // Добавляем image_data только если есть файл
      };

      const response = await registerUser(registerData);

      if (response.status === 200 || response.status === 201) {
        navigate("/login");
      }
    } catch (err) {
      const error = err as AxiosError<{ detail: string }>;
      if (error.response?.status === 406) {
        setError("Пользователь с таким username уже существует");
      } else if (error.response?.status === 500) {
        setError("Ошибка при обработке изображения");
      } else {
        setError("Ошибка при регистрации");
      }
      console.error(err);
    }
  };

  return (
    <div className="auth-container">
      <h2>Регистрация</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            // Убрано required, так как image_data опционально
          />
          {preview && (
            <div>
              <h3>Предпросмотр:</h3>
              <img src={preview} alt="Preview" style={{ maxWidth: '200px' }} />
            </div>
          )}
        </div>
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
          <label>Фамилия</label>
          <input
            type="text"
            value={secondName}
            onChange={(e) => setSecondName(e.target.value)}
            placeholder="Введите фамилию (необязательно)"
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
          <select
            value={role}
            onChange={handleRoleChange}
            required
          >
            <option value="student">Студент</option>
            <option value="teacher">Преподаватель</option>
            <option value="admin">Администратор</option>
          </select>
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