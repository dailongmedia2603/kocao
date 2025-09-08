import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Newspaper } from "lucide-react";

const TaoContent = () => {
  return (
    <div className="p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Công cụ Content</h1>
        <p className="text-muted-foreground mt-1">
          Sử dụng AI để tạo nội dung mới hoặc cập nhật tin tức từ các nguồn có sẵn.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* AI Content Generation Card */}
        <Card className="h-full flex flex-col">
          <CardHeader className="flex-row items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 flex-shrink-0">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Tạo Content bằng AI</CardTitle>
              <CardDescription className="mt-1">
                Mô tả chi tiết yêu cầu của bạn, AI sẽ tạo ra nội dung sáng tạo.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col">
            <div className="flex-grow">
              <Textarea
                placeholder="Ví dụ: Viết một bài đăng Facebook quảng cáo tai nghe không dây mới, nhấn mạnh vào thời lượng pin và chất lượng âm thanh."
                className="min-h-[150px] resize-none"
              />
            </div>
            <Button className="mt-4 w-full">
              <Bot className="mr-2 h-4 w-4" />
              Tạo Content
            </Button>
          </CardContent>
        </Card>

        {/* Facebook Post Scanner Card */}
        <Card className="h-full flex flex-col">
          <CardHeader className="flex-row items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
              <Newspaper className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Cập nhật tin tức từ Facebook</CardTitle>
              <CardDescription className="mt-1">
                Dán ID hoặc URL bài viết để quét và lấy thông tin chi tiết.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-between">
            <Input
              placeholder="Nhập ID hoặc URL bài viết Facebook..."
            />
            <Button className="mt-4 w-full">
              <Newspaper className="mr-2 h-4 w-4" />
              Quét bài viết
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaoContent;