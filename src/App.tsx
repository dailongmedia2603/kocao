import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionContextProvider } from "./contexts/SessionContext";
import { Toaster } from "@/components/ui/sonner";

// Layouts
import AppLayout from "./components/AppLayout";

// Auth Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import PendingApproval from "./pages/PendingApproval";

// Protected Pages
import Dashboard from "./pages/Dashboard";
import ListKoc from "./pages/ListKoc";
import KocDetail from "./pages/KocDetail";
import CreateVoicePage from "./pages/CreateVoice";
import TaoContent from "./pages/TaoContent";
import TaoVideo from "./pages/TaoVideo";
import VideoToScript from "./pages/VideoToScript";
import Automation from "./pages/Automation";
import AutomationDetail from "./pages/AutomationDetail";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import UserManagement from "./pages/admin/UserManagement";

// Route Guards
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

// 404
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <SessionContextProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route element={<AppLayout />}>
              <Route index element={<Navigate replace to="/dashboard" />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="list-koc" element={<ListKoc />} />
              <Route path="list-koc/:kocId" element={<KocDetail />} />
              <Route path="create-voice" element={<CreateVoicePage />} />
              <Route path="tao-content" element={<TaoContent />} />
              <Route path="tao-video" element={<TaoVideo />} />
              <Route path="video-to-script" element={<VideoToScript />} />
              <Route path="automation" element={<Automation />} />
              <Route path="automation/:campaignId" element={<AutomationDetail />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
              
              {/* Admin Routes */}
              <Route element={<AdminRoute />}>
                <Route path="admin/users" element={<UserManagement />} />
              </Route>
            </Route>
          </Route>

          {/* Not Found Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </SessionContextProvider>
    </BrowserRouter>
  );
}

export default App;