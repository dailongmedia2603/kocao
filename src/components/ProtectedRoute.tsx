import { useSession } from "@/contexts/SessionContext";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const ProtectedRoute = () => {
  const { session, loading } = useSession();
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

  // Kiểm tra xem đây có phải là phiên đăng nhập tạm thời để khôi phục mật khẩu không
  const isRecoverySession = (session.user as any).amr?.some(
    (method: { method: string }) => method.method === 'recovery'
  );

  // Nếu là phiên khôi phục và người dùng đang cố truy cập một trang khác ngoài /forgot-password
  // hãy chuyển hướng họ đến trang đổi mật khẩu.
  if (isRecoverySession && location.pathname !== "/forgot-password") {
    return <Navigate to="/forgot-password" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;