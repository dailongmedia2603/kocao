import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Newspaper } from "lucide-react";

const CapNhatTinTuc = () => {
  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Cập nhật tin tức từ Facebook</h1>
        <p className="text-muted-foreground mt-1">
          Nhập ID bài viết hoặc URL để quét và lấy thông tin chi tiết.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Quét bài viết Facebook</CardTitle>
          <CardDescription>
            Dán ID hoặc URL đầy đủ của bài viết Facebook bạn muốn lấy thông tin.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Input
            placeholder="Nhập ID hoặc URL bài viết..."
            className="flex-grow"
          />
          <Button>
            <Newspaper className="mr-2 h-4 w-4" />
            Quét bài viết
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CapNhatTinTuc;