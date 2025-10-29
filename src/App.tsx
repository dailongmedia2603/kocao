import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ListKoc from "./pages/ListKoc";
import KocDetail from "./pages/KocDetail";
import CreateVoicePage from "./pages/CreateVoice";
import TaoContent from "./pages/TaoContent";
import TaoVideo from "./pages/TaoVideo";
import AutomationDetail from "./pages/AutomationDetail";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import { SessionContextProvider } from "./contexts/SessionContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminRoute from "./components/auth/AdminRoute";

function App() {
  return (
    <SessionContextProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="list-koc" element={<ListKoc />} />
            <Route path="koc/:kocId" element={<KocDetail />} />
            <Route path="create-voice" element={<CreateVoicePage />} />
            <Route path="tao-content" element={<TaoContent />} />
            <Route path="tao-video" element={<TaoVideo />} />
            <Route path="automation/:campaignId" element={<AutomationDetail />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
      </Router>
    </SessionContextProvider>
  );
}

export default App;