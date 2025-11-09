import { useSession } from "@/contexts/SessionContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingSpinner } from "./LoadingSpinner";

const ProtectedRoute = () => {
  const { session, profile, loading } = useSession();
  const location = useLocation();

  if (loading) {
    // Render the layout which will show its own loading state
    // This prevents a full-page takeover while loading
    return <Outlet />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const isRecoverySession = (session.user as any).amr?.some(
    (method: { method: string }) => method.method === 'recovery'
  );

  if (isRecoverySession && location.pathname !== "/forgot-password") {
    return <Navigate to="/forgot-password" replace />;
  }
  
  if (!isRecoverySession) {
    if (profile && profile.status === 'pending' && location.pathname !== '/pending-approval') {
      return <Navigate to="/pending-approval" replace />;
    }

    if (profile && profile.status !== 'pending' && location.pathname === '/pending-approval') {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;