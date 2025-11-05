import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Loader2 } from "lucide-react";

type PlanResultDisplayProps = {
  planId: string | null;
};

export const PlanResultDisplay = ({ planId }: PlanResultDisplayProps) => {
  const isNew = planId === null;
  // Giả lập trạng thái loading, sẽ thay bằng logic thật ở Giai đoạn 4
  const isLoading = false; 

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>2. Kết quả & Đề xuất</CardTitle>
        <CardDescription>Chiến lược nội dung do AI đề xuất sẽ được hiển thị ở đây.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isNew ? (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-96 border-2 border-dashed rounded-lg">
            <Bot className="h-12 w-12 mb-4" />
            <p className="font-semibold">Chờ bạn nhập thông tin</p>
            <p className="text-sm">Hãy điền vào biểu mẫu bên cạnh và bấm "Tạo kế hoạch" để xem kết quả.</p>
          </div>
        ) : (
          // Placeholder cho khi xem chi tiết plan đã có
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-96 border-2 border-dashed rounded-lg">
            <Loader2 className="h-12 w-12 mb-4 animate-spin" />
            <p className="font-semibold">Đang tải dữ liệu kế hoạch...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};