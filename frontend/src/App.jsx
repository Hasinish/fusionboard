import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";
import CreateWorkspacePage from "./pages/CreateWorkspacePage";
import WorkspaceDetailsPage from "./pages/WorkspaceDetailsPage";
import NotificationsPage from "./pages/NotificationsPage";
import VoiceChatRoomPage from "./pages/VoiceChatRoomPage";

function App() {
  return (
    <div className="min-h-screen bg-base-200">
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/workspaces/create" element={<CreateWorkspacePage />} />
        <Route path="/workspaces/:id" element={<WorkspaceDetailsPage />} />
        <Route path="/workspaces/:id/voice" element={<VoiceChatRoomPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Routes>
    </div>
  );
}

export default App;
