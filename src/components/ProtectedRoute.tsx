import { useSession } from "@/contexts/SessionContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const ProtectedRoute = () => {
  const { session, profile, loading } = useSession();
  const location = useLocation();

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

  // Xử lý phiên khôi phục mật khẩu tạm thời
  const isRecoverySession = (session.user as any).amr?.some(
    (method: { method: string }) => method.method === 'recovery'
  );

  if (isRecoverySession && location.pathname !== "/forgot-password") {
    return <Navigate to="/forgot-password" replace />;
  }
  
  // Nếu không phải phiên khôi phục, kiểm tra trạng thái profile
  if (!isRecoverySession) {
    // Nếu profile đã tải và trạng thái là 'pending', chuyển hướng đến trang chờ duyệt
    // trừ khi họ đã ở trên trang đó.
    if (profile && profile.status === 'pending' && location.pathname !== '/pending-approval') {
      return <Navigate to="/pending-approval" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;