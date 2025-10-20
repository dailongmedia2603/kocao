import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

// Icons
import { Download, Loader2, Captions, Eye, Search, ListVideo, FileText, Play, Heart, MessageSquare, Share2, Copy, ExternalLink, FileVideo } from "lucide-react";

// API Proxy Function
const callApi = async (path: string, method: 'GET' | 'POST', body?: any) => {
  const { data, error } = await supabase.functions.invoke('transcribe-api-proxy', {
    body: { path, method, body }
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data;
};

const formatStatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "0";
  if (num < 1000) return num.toString();
  if (num < 1000000) return (num / 1000).toFixed(1).replace('.0', '') + "K";
  return (num / 1000000).toFixed(1).replace('.0', '') + "M";
};

const VideoToScript = () => {
  const queryClient = useQueryClient();
  const [channelLink, setChannelLink] = useState("");
  const [videoMetadata, setVideoMetadata] = useState<any[]>([]);

  const getMetadataMutation = useMutation({
    mutationFn: (channel: string) => callApi('/api/v1/metadata', 'POST', { channel_link: channel, max_videos: 50 }),
    onSuccess: (data) => {
      const { username, videos = [] } = data;
      const processedVideos = videos.map((v: any) => {
        let url = v.video_url;
        if (!url) {
          if (v.video_id && username) {
            url = `https://www.tiktok.com/@${username}/video/${v.video_id}`;
          } else if (v.video_id) {
            url = `https://www.tiktok.com/embed/${v.video_id}`;
          }
        }
        return { ...v, video_url: url };
      }).filter((v: any) => v.video_url);

      setVideoMetadata(processedVideos);
      showSuccess(`Đã tìm thấy ${processedVideos.length} video.`);
    },
    onError: (error: Error) => showError(error.message),
  });

  const handleGetMetadata = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelLink) {
      getMetadataMutation.mutate(channelLink);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    showSuccess("Đã sao chép link!");
  };

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Lấy Link Video TikTok</h1>
        <p className="text-muted-foreground mt-1">Nhập kênh TikTok để lấy danh sách link video công khai.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" /> Lấy danh sách video</CardTitle>
          <CardDescription>Nhập link kênh hoặc username TikTok (ví dụ: @username).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGetMetadata} className="flex gap-2 mb-6">
            <Input
              placeholder="@username hoặc link kênh"
              value={channelLink}
              onChange={(e) => setChannelLink(e.target.value)}
              disabled={getMetadataMutation.isPending}
            />
            <Button type="submit" disabled={getMetadataMutation.isPending || !channelLink}>
              {getMetadataMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lấy"}
            </Button>
          </form>

          <h3 className="text-lg font-semibold mb-4">Kết quả</h3>
          <ScrollArea className="h-[60vh] border rounded-md">
            <div className="p-4 space-y-4">
              {getMetadataMutation.isPending ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
              ) : videoMetadata.length > 0 ? (
                videoMetadata.map((video) => (
                  <Card key={video.video_id} className="flex overflow-hidden">
                    {video.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt={video.description || 'Video thumbnail'} className="w-24 h-auto object-cover bg-muted" />
                    ) : (
                      <div className="w-24 h-full flex items-center justify-center bg-muted flex-shrink-0">
                        <FileVideo className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="p-4 flex-1">
                      <p className="text-sm font-medium line-clamp-2">{video.description || "Không có mô tả"}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {formatStatNumber(video.stats?.play)}</span>
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {formatStatNumber(video.stats?.like)}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {formatStatNumber(video.stats?.comment)}</span>
                        <span className="flex items-center gap-1"><Share2 className="h-3 w-3" /> {formatStatNumber(video.stats?.share)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => handleCopyLink(video.video_url)}><Copy className="h-3 w-3 mr-1.5" /> Copy Link</Button>
                        <Button size="sm" asChild><a href={video.video_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 mr-1.5" /> Xem trên TikTok</a></Button>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <FileVideo className="h-10 w-10" />
                  <p className="mt-2">Chưa có video nào.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default VideoToScript;