import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { SessionProvider, useSession } from './contexts/SessionContext';
import Login from './pages/Login';
import Index from './pages/Index';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

const AppRoutes = () => {
  const { session } = useSession();

  return (
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
      <Route path="/forgot-password" element={!session ? <ForgotPassword /> : <Navigate to="/" />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={session ? <Index /> : <Navigate to="/login" />} />
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