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
import CreateVoicePage from "./pages/CreateVoice";
import TaoContent from "./pages/TaoContent";
import Automation from "./pages/Automation";
import TaoVideo from "./pages/TaoVideo";
import VideoToScript from "./pages/VideoToScript";
import AutomationDetail from "./pages/AutomationDetail";
import ForgotPassword from "./pages/ForgotPassword";
import PendingApproval from "./pages/PendingApproval";
import AdminRoute from "./components/AdminRoute";
import UserManagement from "./pages/admin/UserManagement";
import TaoKeHoach from "./pages/TaoKeHoach";
import TaoKeHoachDetail from "./pages/TaoKeHoachDetail";
import SubscriptionPlans from "./pages/admin/SubscriptionPlans";
import SubscriptionPage from "./pages/Subscription";

function App() {
  return (
    <BrowserRouter>
      <SessionContextProvider>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          <Route element={<ProtectedRoute />}>
            {/* Trang dành cho người dùng đang chờ duyệt */}
            <Route path="/pending-approval" element={<PendingApproval />} />

            {/* Các Route chỉ dành cho Admin */}
            <Route element={<AdminRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/admin/users" element={<UserManagement />} />
                <Route path="/admin/plans" element={<SubscriptionPlans />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>

            {/* Các Route cho người dùng đã được duyệt */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/automation" element={<Automation />} />
              <Route path="/automation/:campaignId" element={<AutomationDetail />} />
              <Route path="/tao-video" element={<TaoVideo />} />
              <Route path="/tao-ke-hoach" element={<TaoKeHoach />} />
              <Route path="/tao-ke-hoach/:planId" element={<TaoKeHoachDetail />} />
              <Route path="/subscription" element={<SubscriptionPage />} />
            </Route>
            <Route element={<KocLayout />}>
              <Route path="/list-koc" element={<ListKoc />} />
              <Route path="/list-koc/:kocId" element={<KocDetail />} />
              <Route path="/create-voice" element={<CreateVoicePage />} />
              <Route path="/tao-content" element={<TaoContent />} />
              <Route path="/video-to-script" element={<VideoToScript />} />
            </Route>
          </Route>
        </Routes>
      </SessionContextProvider>
    </BrowserRouter>
  );
}

export default App;