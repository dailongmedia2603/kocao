import { useSession } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import { MailCheck, LogOut } from "lucide-react";

const PendingApproval = () => {
  const { signOut } = useSession();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 text-center">
      <div className="max-w-md">
        <MailCheck className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
          Tài khoản đang chờ duyệt
        </h1>
        <p className="mt-4 text-base text-gray-600">
          Cảm ơn bạn đã đăng ký! Tài khoản của bạn đã được tạo và đang chờ quản trị viên phê duyệt. Vui lòng quay lại sau.
        </p>
        <Button
          onClick={signOut}
          variant="outline"
          className="mt-8"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </Button>
      </div>
    </div>
  );
};

export default PendingApproval;