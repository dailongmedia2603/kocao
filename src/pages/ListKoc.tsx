import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Video, Film } from "lucide-react";
import { format } from "date-fns";

type KocVideo = {
  name: string;
  url: string;
  lastModified: string;
};

const fetchKocVideos = async (): Promise<KocVideo[]> => {
  const { data, error } = await supabase.functions.invoke("list-r2-videos");

  if (error) {
    // Cố gắng lấy thông báo lỗi chi tiết hơn từ phản hồi của function
    let detailedMessage = error.message;
    if (error.context && typeof error.context.json === 'function') {
      try {
        const errorBody = await error.context.json();
        if (errorBody.error) {
          detailedMessage = errorBody.error;
        }
      } catch (e) {
        // Bỏ qua nếu không phân tích được JSON, giữ lại lỗi gốc
      }
    }
    throw new Error(`Không thể lấy danh sách video: ${detailedMessage}`);
  }

  if (!data.videos) {
    throw new Error("Phản hồi từ server không hợp lệ.");
  }
  return data.videos;
};

const ListKoc = () => {
  const { data: videos, isLoading, isError, error } = useQuery<KocVideo[]>({
    queryKey: ["kocVideos"],
    queryFn: fetchKocVideos,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // Cache trong 5 phút
  });

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">List KOC</h1>
        <p className="text-muted-foreground mt-1">Xem các video hướng dẫn đã được tải lên.</p>
      </header>

      <div className="space-y-6">
        {isLoading && (
          Array.from({ length: 2 }).map((_, index) => (
            <Card key={index} className="max-w-4xl mx-auto">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="w-full aspect-video rounded-lg" />
              </CardContent>
            </Card>
          ))
        )}

        {isError && (
          <Alert variant="destructive" className="max-w-4xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Lỗi</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định."}
            </AlertDescription>
          </Alert>
        )}

        {videos && videos.length === 0 && !isLoading && (
            <Card className="max-w-4xl mx-auto">
                <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                        <Film className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">Không tìm thấy video nào</h3>
                        <p className="mt-1 text-sm">Chưa có video nào được tải lên Cloudflare R2.</p>
                    </div>
                </CardContent>
            </Card>
        )}

        {videos && videos.map((video) => (
          <Card key={video.name} className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="text-red-500" />
                {video.name}
              </CardTitle>
              <CardDescription>
                Tải lên vào: {format(new Date(video.lastModified), "dd/MM/yyyy HH:mm")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  controls
                  src={video.url}
                  className="w-full h-full"
                  preload="metadata"
                >
                  Trình duyệt của bạn không hỗ trợ thẻ video.
                </video>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ListKoc;