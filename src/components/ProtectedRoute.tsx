import { useSession } from "@/contexts/SessionContext";
import { Navigate, Outlet } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const ProtectedRoute = () => {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;