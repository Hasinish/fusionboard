import { Routes, Route, Navigate, useParams } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";

import NotificationsPage from "./pages/NotificationsPage";
import VoiceChatRoomPage from "./pages/VoiceChatRoomPage";
import WhiteboardPage from "./pages/WhiteboardPage";

import TestWhiteboardPage from "./pages/TestWhiteboardPage";
import BoardReplayPage from "./pages/BoardReplayPage";

const WorkspaceRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/dashboard?wsId=${id}`} replace />;
};

function App() {
  return (
    <div className="min-h-screen bg-base-200">
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />


        <Route path="/workspaces/:id" element={<WorkspaceRedirect />} />
        <Route path="/workspaces/:id/voice" element={<VoiceChatRoomPage />} />

        <Route path="/workspaces/:id/files" element={<Navigate to={`/dashboard?openedFilesModal=true&wsId=${window.location.pathname.split('/')[2]}${window.location.search.replace('?', '&')}`} replace />} />
        <Route path="/workspaces/:id/activity" element={<WorkspaceRedirect />} />

        <Route path="/workspaces/:id/boards/:boardId" element={<WhiteboardPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        {/* Infinite Canvas Test Route */}
        <Route path="/test-whiteboard" element={<TestWhiteboardPage />} />
        <Route path="/recordings/:recordingId" element={<BoardReplayPage />} />
      </Routes>
    </div>
  );
}

export default App;