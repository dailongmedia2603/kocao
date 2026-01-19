import { useSession } from "@/contexts/SessionContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";

const ProtectedRoute = () => {
  const { user, profile, loading } = useSession();
  const location = useLocation();

  if (loading) {
    // Render the layout which will show its own loading state
    // This prevents a full-page takeover while loading
    return <Outlet />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Assuming password recovery flow uses specific routes and doesn't rely on 'recovery' session state anymore
  // If we have a 'reset-password' page with token, it's public.
  // Protected routes are only for logged in users.

  if (profile && profile.status === 'pending' && location.pathname !== '/pending-approval') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (profile && profile.status !== 'pending' && location.pathname === '/pending-approval') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;