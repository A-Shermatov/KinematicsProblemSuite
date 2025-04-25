import React, { createContext, useState, useEffect, useContext } from "react";
import axios, { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";

interface User {
  username: string;
  role: "admin" | "teacher" | "student";
  id: number;
  token: string;
  image?: string;
  first_name?: string;
  second_name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => false,
  logout: () => {},
  updateUser: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log("Token from localStorage:", token);
    if (token) {
      axios
        .get("http://127.0.0.1:8001/api/possibility/user", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          console.log("User data fetched:", response.data);
          setUser({ ...response.data, token });
          setLoading(false);
        })
        .catch((error) => {
          console.error("Failed to fetch user data:", error);
          localStorage.removeItem("token");
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const loginResponse = await axios.post(
        "http://127.0.0.1:8001/api/auth/login",
        { username, password }
      );
      console.log("Login response:", loginResponse.data);
      const { access_token } = loginResponse.data;

      const userResponse = await axios.get("http://127.0.0.1:8001/api/possibility/user", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      console.log("User data after login:", userResponse.data);

      const { id, username: userName, role, image, first_name, second_name } = userResponse.data;
      localStorage.setItem("token", access_token);
      console.log("Token saved to localStorage:", access_token);
      setUser({ id, username: userName, role, token: access_token, image, first_name, second_name });
      return true;
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      console.error("Login error:", axiosError.response?.data);
      throw axiosError.response?.data?.detail || "Ошибка входа";
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    navigate("/login");
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};