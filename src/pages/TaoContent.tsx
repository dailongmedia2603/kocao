import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Newspaper } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TaoContent = () => {
  return (
    <div className="p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Công cụ Content</h1>
        <p className="text-muted-foreground mt-1">
          Sử dụng AI để tạo nội dung mới hoặc cập nhật tin tức từ các nguồn có sẵn.
        </p>
      </header>

      <Tabs defaultValue="create-content" className="w-full">
        <TabsList className="inline-flex h-auto items-center justify-center gap-1 rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="create-content"
            className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-muted-foreground ring-offset-background transition-all hover:bg-muted/50 focus-visible:outline-none data-[state=active]:border-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-muted-foreground transition-colors group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white">
              <Bot className="h-5 w-5" />
            </div>
            Tạo content
          </TabsTrigger>
          <TabsTrigger
            value="news"
            className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-muted-foreground ring-offset-background transition-all hover:bg-muted/50 focus-visible:outline-none data-[state=active]:border-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-muted-foreground transition-colors group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white">
              <Newspaper className="h-5 w-5" />
            </div>
            Tin tức mới
          </TabsTrigger>
        </TabsList>
        <TabsContent value="create-content" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Tạo Content bằng AI</CardTitle>
              <CardDescription>
                Mô tả chi tiết yêu cầu của bạn, AI sẽ tạo ra nội dung sáng tạo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Ví dụ: Viết một bài đăng Facebook quảng cáo tai nghe không dây mới, nhấn mạnh vào thời lượng pin và chất lượng âm thanh."
                className="min-h-[200px] resize-y"
              />
              <Button className="w-full sm:w-auto">
                <Bot className="mr-2 h-4 w-4" />
                Bắt đầu tạo
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="news" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Cập nhật tin tức từ Facebook</CardTitle>
              <CardDescription>
                Dán ID hoặc URL bài viết để quét và lấy thông tin chi tiết.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Nhập ID hoặc URL bài viết Facebook..."
              />
              <Button className="w-full sm:w-auto">
                <Newspaper className="mr-2 h-4 w-4" />
                Quét bài viết
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TaoContent;