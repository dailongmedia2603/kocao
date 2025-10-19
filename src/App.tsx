import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import { SessionContextProvider } from "./contexts/SessionContext";
import { Toaster } from "sonner";
import ListKoc from "./pages/ListKoc";
import KocDetail from "./pages/KocDetail";
import KocLayout from "./components/koc/KocLayout";
import Reports from "./pages/Reports";
import CreateVoicePage from "./pages/CreateVoice";
import TaoContent from "./pages/TaoContent";
import Automation from "./pages/Automation";
import DreamfaceStudio from "./pages/DreamfaceStudio";
import ProjectsList from "./pages/ProjectsList";
import ProjectDetail from "./pages/ProjectDetail";
import Extensions from "./pages/Extensions";

function App() {
  return (
    <BrowserRouter>
      <SessionContextProvider>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/automation" element={<Automation />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/dreamface-studio" element={<DreamfaceStudio />} />
              <Route path="/extensions" element={<Extensions />} />
            </Route>
            <Route element={<KocLayout />}>
              <Route path="/list-koc" element={<ListKoc />} />
              <Route path="/list-koc/:kocId" element={<KocDetail />} />
              <Route path="/projects" element={<ProjectsList />} />
              <Route path="/projects/:projectId" element={<ProjectDetail />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/create-voice" element={<CreateVoicePage />} />
              <Route path="/tao-content" element={<TaoContent />} />
            </Route>
          </Route>
        </Routes>
      </SessionContextProvider>
    </BrowserRouter>
  );
}

export default App;