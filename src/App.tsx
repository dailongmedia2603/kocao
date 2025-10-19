import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './contexts/SessionContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';

// Public Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';

// Protected Pages
import Dashboard from './pages/Dashboard';
import ListKoc from './pages/ListKoc';
import KocDetail from './pages/KocDetail';
import CreateVoicePage from './pages/CreateVoice';
import TaoContent from './pages/TaoContent';
import VideoToScript from './pages/VideoToScript';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ProfilePage from './pages/Profile';
import Automation from './pages/Automation';
import AutomationDetail from './pages/AutomationDetail';
import DreamfaceStudio from './pages/DreamfaceStudio';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/list-koc" element={<ListKoc />} />
          <Route path="/list-koc/:kocId" element={<KocDetail />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/automation/:campaignId" element={<AutomationDetail />} />
          <Route path="/dreamface-studio" element={<DreamfaceStudio />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/create-voice" element={<CreateVoicePage />} />
          <Route path="/tao-content" element={<TaoContent />} />
          <Route path="/video-to-script" element={<VideoToScript />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <SessionProvider>
      <Router>
        <AppRoutes />
      </Router>
    </SessionProvider>
  );
}

export default App;