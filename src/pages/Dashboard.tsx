import { useSession } from "@/contexts/SessionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, PlayCircle, CheckCircle2 } from "lucide-react";

const Dashboard = () => {
  const { profile } = useSession();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Chào mừng trở lại, {profile?.first_name || "bạn"}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Đây là trang tổng quan của bạn, hãy xem những gì đang diễn ra.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tổng số dự án
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Dự án đang hoạt động
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tác vụ đang chạy
            </CardTitle>
            <PlayCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Tác vụ trong hàng đợi
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tác vụ đã hoàn thành
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Trong 24 giờ qua
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;