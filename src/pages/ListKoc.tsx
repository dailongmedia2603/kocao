import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Video } from "lucide-react";

const fetchVideoUrl = async () => {
  const { data, error } = await supabase.functions.invoke("get-r2-presigned-url");
  if (error) {
    throw new Error(`Không thể lấy URL video: ${error.message}`);
  }
  if (!data.url) {
    throw new Error("Phản hồi từ server không chứa URL video.");
  }
  return data.url;
};

const ListKoc = () => {
  const { data: videoUrl, isLoading, isError, error } = useQuery<string>({
    queryKey: ["kocVideoUrl"],
    queryFn: fetchVideoUrl,
    refetchOnWindowFocus: false, // Không cần tải lại URL mỗi khi focus vào cửa sổ
    staleTime: 1000 * 60 * 55, // URL có hiệu lực 1 giờ, làm mới sau 55 phút
  });

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
          {isLoading && (
            <Skeleton className="w-full aspect-video rounded-lg" />
          )}
          {isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Lỗi</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định."}
              </AlertDescription>
            </Alert>
          )}
          {videoUrl && (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ListKoc;