import { BrowserRouter, Route, Routes } from "react-router-dom";
import { APP_NAME, AuthProvider, SettingsProvider, ButtonLink, EmptyState, ThemeProvider, setDocumentTitleSuffix, t } from "@kps/shared";
import { Layout, RequireAuth } from "./components/Layout";
import { Attempts } from "./pages/Attempts";
import { Login, Register } from "./pages/Auth";
import { Catalog, SourceTasksPage, SourcesPage, ThemeTasks } from "./pages/Catalog";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { Leaderboard } from "./pages/Leaderboard";
import { ManageOlympiads, OlympiadEditor, OlympiadJury } from "./pages/manage/ManageOlympiads";
import { ManageTasks, TaskEditorPage } from "./pages/manage/ManageTasks";
import { DiplomaPage, OlympiadPage, Olympiads } from "./pages/Olympiads";
import { Profile, UserPage } from "./pages/Profile";
import { TaskPage } from "./pages/TaskPage";
import { TeacherPage, TeacherSettings, Teachers } from "./pages/Teachers";
import { ImportTasks } from "./pages/manage/ImportTasks";

setDocumentTitleSuffix(APP_NAME);

function NotFound() {
  return (
    <EmptyState icon="🔭" title={t("Страница не найдена")}>
      <ButtonLink to="/" variant="secondary" size="sm" className="mt-3">
        {t("На главную")}
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
        <Route path="sources" element={<SourcesPage />} />
        <Route path="sources/:sourceId" element={<SourceTasksPage />} />
        <Route path="tasks/:taskId" element={<TaskPage />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="olympiads" element={<Olympiads />} />
        <Route path="olympiads/:olympiadId" element={<OlympiadPage />} />
        <Route path="olympiads/:olympiadId/diploma" element={<RequireAuth><DiplomaPage /></RequireAuth>} />
        <Route path="manage/olympiads" element={<RequireAuth roles={["teacher"]}><ManageOlympiads /></RequireAuth>} />
        <Route path="manage/olympiads/new" element={<RequireAuth roles={["teacher"]}><OlympiadEditor /></RequireAuth>} />
        <Route path="manage/olympiads/:olympiadId" element={<RequireAuth roles={["teacher", "admin"]}><OlympiadEditor /></RequireAuth>} />
        <Route path="manage/olympiads/:olympiadId/jury" element={<RequireAuth roles={["teacher", "admin"]}><OlympiadJury /></RequireAuth>} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="teachers/:teacherId" element={<TeacherPage />} />
        <Route path="profile/teacher" element={<RequireAuth roles={["teacher"]}><TeacherSettings /></RequireAuth>} />
        <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="attempts" element={<RequireAuth><Attempts /></RequireAuth>} />
        <Route path="users/:userId" element={<RequireAuth><UserPage /></RequireAuth>} />
        <Route path="manage/tasks" element={<RequireAuth roles={["teacher", "admin"]}><ManageTasks /></RequireAuth>} />
        <Route path="manage/tasks/new" element={<RequireAuth roles={["teacher", "admin"]}><TaskEditorPage /></RequireAuth>} />
        <Route path="manage/tasks/import" element={<RequireAuth roles={["teacher", "admin"]}><ImportTasks /></RequireAuth>} />
        <Route path="manage/tasks/:taskId/edit" element={<RequireAuth roles={["teacher", "admin"]}><TaskEditorPage /></RequireAuth>} />
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
          <SettingsProvider>
          <AppRoutes />
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
