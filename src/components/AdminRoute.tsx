import { useSession } from "@/contexts/SessionContext";
import { Navigate, Outlet } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const AdminRoute = () => {
  const { profile, loading } = useSession();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    // Chuyển hướng về trang chủ nếu không phải admin
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;