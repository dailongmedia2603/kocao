import { useSession } from "@/contexts/SessionContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Video, User } from "lucide-react";

const SubscriptionPage = () => {
  const { subscription, profile, loading } = useSession();

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <Skeleton className="h-8 w-64 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Gói cước của bạn</h1>
        <p className="text-muted-foreground mt-1">Thông tin chi tiết về gói đăng ký và giới hạn sử dụng.</p>
      </header>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl">
                {subscription ? subscription.plan_name : "Chưa có gói cước"}
              </CardTitle>
              <CardDescription>
                {`${profile?.last_name || ''} ${profile?.first_name || ''}`.trim()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {subscription ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2 text-sm font-medium">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Video className="h-4 w-4" />
                    Số video đã sử dụng
                  </span>
                  <span>
                    {subscription.videos_used} / {subscription.video_limit}
                  </span>
                </div>
                <Progress value={(subscription.videos_used / subscription.video_limit) * 100} className="h-3" />
              </div>
              <p className="text-xs text-muted-foreground text-center pt-2">
                Số lượt tạo video sẽ được làm mới vào đầu mỗi chu kỳ.
              </p>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <User className="mx-auto h-12 w-12" />
              <p className="mt-4 font-semibold">Bạn hiện chưa đăng ký gói cước nào.</p>
              <p className="text-sm">Vui lòng liên hệ quản trị viên để được hỗ trợ.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionPage;