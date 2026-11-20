import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { Layout, RequireAuth } from "./components/Layout";
import { ButtonLink, EmptyState } from "./components/ui";
import { Attempts } from "./pages/Attempts";
import { Login, Register } from "./pages/Auth";
import { Catalog, ThemeTasks } from "./pages/Catalog";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { Leaderboard } from "./pages/Leaderboard";
import { ManageCatalog } from "./pages/manage/ManageCatalog";
import { ManageTasks, TaskEditor } from "./pages/manage/ManageTasks";
import { ManageUsers } from "./pages/manage/ManageUsers";
import { Profile, UserPage } from "./pages/Profile";
import { TaskPage } from "./pages/TaskPage";
import { ThemeProvider } from "./theme/ThemeContext";

function NotFound() {
  return (
    <EmptyState icon="🔭" title="Страница не найдена">
      <ButtonLink to="/" variant="secondary" size="sm" className="mt-3">
        На главную
      </ButtonLink>
    </EmptyState>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="themes/:themeId" element={<ThemeTasks />} />
        <Route path="tasks/:taskId" element={<TaskPage />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="attempts" element={<RequireAuth><Attempts /></RequireAuth>} />
        <Route path="users/:userId" element={<RequireAuth><UserPage /></RequireAuth>} />
        <Route path="manage/tasks" element={<RequireAuth roles={["teacher", "admin"]}><ManageTasks /></RequireAuth>} />
        <Route path="manage/tasks/new" element={<RequireAuth roles={["teacher", "admin"]}><TaskEditor /></RequireAuth>} />
        <Route path="manage/tasks/:taskId/edit" element={<RequireAuth roles={["teacher", "admin"]}><TaskEditor /></RequireAuth>} />
        <Route path="manage/catalog" element={<RequireAuth roles={["admin"]}><ManageCatalog /></RequireAuth>} />
        <Route path="manage/users" element={<RequireAuth roles={["admin"]}><ManageUsers /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
