import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Film, PlayCircle, ArrowLeft, UploadCloud } from "lucide-react";
import { format } from "date-fns";
import { VideoPlayerDialog } from "@/components/koc/VideoPlayerDialog";
import { UploadVideoDialog } from "@/components/koc/UploadVideoDialog";
import { VideoThumbnail } from "@/components/koc/VideoThumbnail";

type KocVideo = {
  name: string;
  url: string;
  lastModified: string;
};

type Koc = {
  id: string;
  name: string;
  folder_path: string | null;
};

const fetchKocDetails = async (kocId: string) => {
  const { data, error } = await supabase.from("kocs").select("id, name, folder_path").eq("id", kocId).single();
  if (error) throw error;
  return data;
};

const fetchKocVideos = async (folderPath: string): Promise<KocVideo[]> => {
  const { data, error } = await supabase.functions.invoke("list-r2-videos", {
    body: { folderPath },
  });
  if (error) throw new Error(`Không thể lấy danh sách video: ${error.message}`);
  if (!data.videos) throw new Error("Phản hồi từ server không hợp lệ.");
  return data.videos;
};

const KocDetail = () => {
  const { kocId } = useParams<{ kocId: string }>();
  const [selectedVideo, setSelectedVideo] = useState<KocVideo | null>(null);
  const [isPlayerOpen, setPlayerOpen] = useState(false);
  const [isUploadOpen, setUploadOpen] = useState(false);

  const { data: koc, isLoading: isKocLoading } = useQuery<Koc>({
    queryKey: ["koc", kocId],
    queryFn: () => fetchKocDetails(kocId!),
    enabled: !!kocId,
  });

  const { data: videos, isLoading: areVideosLoading, isError, error } = useQuery<KocVideo[]>({
    queryKey: ["kocVideos", koc?.folder_path],
    queryFn: () => fetchKocVideos(koc!.folder_path!),
    enabled: !!koc && !!koc.folder_path,
  });

  const handleVideoClick = (video: KocVideo) => {
    setSelectedVideo(video);
    setPlayerOpen(true);
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex justify-between items-center mb-6">
          <div>
            <Link to="/list-koc" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách KOC
            </Link>
            {isKocLoading ? <Skeleton className="h-8 w-64" /> : <h1 className="text-3xl font-bold">{koc?.name}</h1>}
            <p className="text-muted-foreground mt-1">Danh sách các video của KOC.</p>
          </div>
          <Button variant="outline" onClick={() => setUploadOpen(true)} disabled={!koc?.folder_path}>
            <UploadCloud className="mr-2 h-4 w-4" /> Tải lên video
          </Button>
        </header>

        {areVideosLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full" />)}
          </div>
        ) : isError ? (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Lỗi</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>
        ) : videos && videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {videos.map((video) => (
              <Card key={video.url} className="overflow-hidden cursor-pointer group" onClick={() => handleVideoClick(video)}>
                <CardContent className="p-0">
                  <div className="aspect-video bg-black flex items-center justify-center relative">
                    <VideoThumbnail videoUrl={video.url} />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <PlayCircle className="h-16 w-16 text-white" />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-sm truncate" title={video.name}>{video.name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(video.lastModified), "dd/MM/yyyy")}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-16"><CardContent><div className="text-center text-muted-foreground"><Film className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">Chưa có video nào</h3><p className="mt-1 text-sm">Bấm "Tải lên video" để thêm video đầu tiên của bạn.</p></div></CardContent></Card>
        )}
      </div>
      <VideoPlayerDialog isOpen={isPlayerOpen} onOpenChange={setPlayerOpen} videoUrl={selectedVideo?.url} videoName={selectedVideo?.name} />
      {koc && koc.folder_path && (
        <UploadVideoDialog
          isOpen={isUploadOpen}
          onOpenChange={setUploadOpen}
          folderPath={koc.folder_path}
          kocName={koc.name}
        />
      )}
    </>
  );
};

export default KocDetail;