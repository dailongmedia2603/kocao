import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Video } from "lucide-react";

const ListKoc = () => {
  // Sử dụng trực tiếp Public Development URL bạn đã cung cấp
  const videoUrl = "https://pub-8e3b096d2ce442168e0a26da12395bae.r2.dev/video%20final.mp4";

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">List KOC</h1>
        <p className="text-muted-foreground mt-1">Xem video hướng dẫn và thông tin về KOC.</p>
      </header>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="text-red-500" />
            Video Hướng Dẫn
          </CardTitle>
          <CardDescription>
            Xem video hướng dẫn chi tiết về quy trình làm việc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              controls
              src={videoUrl}
              className="w-full h-full"
              preload="metadata"
            >
              Trình duyệt của bạn không hỗ trợ thẻ video.
            </video>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ListKoc;