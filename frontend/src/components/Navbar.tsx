import React, { useContext, useState, useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

export const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const [showDropdown, setShowDropdown] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShowDropdown(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
    }, 300);
  };

  return (
    <nav className="bg-gray-800 text-white p-4 fixed w-full top-0 z-10 shadow-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <NavLink to="/" className="text-2xl font-bold">
          Kinematics Suite
        </NavLink>
        <div className="flex items-center space-x-4">
          <NavLink to="/themes" className="hover:text-gray-300">
            Темы
          </NavLink>
          {user && (
            <NavLink to="/attempts">Попытки</NavLink>
          )}
          {user?.role === "admin" && (
            <>
              <NavLink to="/manage-themes" className="hover:text-gray-300">
                Управление темами
              </NavLink>
              <NavLink to="/manage-users" className="hover:text-gray-300">
                Пользователи
              </NavLink>
            </>
          )}
          {(user?.role === "admin" || user?.role === "teacher") && (
            <NavLink to="/manage-tasks" className="hover:text-gray-300">
              Управление задачами
            </NavLink>
          )}
          {user ? (
            <div
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <img
                src={user.image || "https://via.placeholder.com/40"}
                alt="Аватар"
                className="w-10 h-10 rounded-full cursor-pointer"
              />
              {showDropdown && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-md shadow-lg py-2"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="px-4 py-2">
                    <p className="font-semibold">{user.username}</p>
                    <p className="text-sm capitalize">{user.role}</p>
                  </div>
                  <Link
                    to="/dashboard"
                    className="block px-4 py-2 hover:bg-gray-100"
                    onClick={() => setShowDropdown(false)}
                  >
                    Личный кабинет
                  </Link>

                  <button
                    onClick={() => {
                      logout();
                      setShowDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    Выйти
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="hover:text-gray-300">
                Вход
              </Link>
              <Link to="/register" className="hover:text-gray-300">
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
