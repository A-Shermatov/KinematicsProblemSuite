import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { Register } from "./pages/Register";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Themes } from "./pages/Themes";
import { ThemeTasks } from "./pages/ThemeTasks";
import { Task } from "./pages/Task";
import { ManageThemes } from "./pages/ManageThemes";
import { ManageTasks } from "./pages/ManageTasks";
import { ManageUsers } from "./pages/ManageUsers";
import { Attempts } from "./pages/Attempts";
import { UserProfile } from "./pages/UserProfile";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/themes" element={<Themes />} />
        <Route path="/themes/:themeId/tasks" element={<ThemeTasks />} />
        <Route path="/tasks/:taskId" element={<Task />} />
        <Route
          path="/attempts"
          element={
            <ProtectedRoute allowedRoles={["admin", "teacher", "student"]}>
              <Attempts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage-themes"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <ManageThemes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage-tasks"
          element={
            <ProtectedRoute allowedRoles={["admin", "teacher"]}>
              <ManageTasks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage-users"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <ManageUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/:userId"
          element={
            <ProtectedRoute allowedRoles={["admin", "teacher", "student"]}>
              <UserProfile />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);
