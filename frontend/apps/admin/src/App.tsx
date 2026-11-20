import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, SettingsProvider, EmptyState, ThemeProvider, setDocumentTitleSuffix } from "@kps/shared";
import { AdminLayout, AdminLogin, RequireAdmin } from "./components/AdminLayout";
import { Attempts } from "./pages/Attempts";
import { Catalog } from "./pages/Catalog";
import { Dashboard } from "./pages/Dashboard";
import { Certificates, Reviews } from "./pages/Moderation";
import { Olympiads } from "./pages/Olympiads";
import { Settings } from "./pages/Settings";
import { TaskEdit, Tasks } from "./pages/Tasks";
import { Users } from "./pages/Users";

setDocumentTitleSuffix("Админка");

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/:taskId/edit" element={<TaskEdit />} />
        <Route path="attempts" element={<Attempts />} />
        <Route path="olympiads" element={<Olympiads />} />
        <Route path="certificates" element={<Certificates />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<EmptyState icon="🔭" title="Раздел не найден" />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <SettingsProvider>
          <AppRoutes />
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
