import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";

const TaoContent = () => {
  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Tạo Content bằng AI</h1>
        <p className="text-muted-foreground mt-1">
          Nhập yêu cầu của bạn và để AI tạo ra nội dung sáng tạo.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Yêu cầu nội dung</CardTitle>
          <CardDescription>
            Mô tả chi tiết về nội dung bạn muốn tạo, ví dụ: "Viết một bài đăng Facebook quảng cáo tai nghe không dây mới, nhấn mạnh vào thời lượng pin và chất lượng âm thanh."
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Nhập yêu cầu của bạn ở đây..."
            className="min-h-[150px]"
          />
          <Button>
            <Bot className="mr-2 h-4 w-4" />
            Tạo Content
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaoContent;