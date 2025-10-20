import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Icons
import { Download, Loader2, FileVideo, Captions, Eye, RefreshCw, Search, ListVideo, FileText } from "lucide-react";

// API Proxy Function
const callApi = async (path: string, method: 'GET' | 'POST', body?: any) => {
  const { data, error } = await supabase.functions.invoke('transcribe-api-proxy', {
    body: { path, method, body }
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data;
};

const VideoToScript = () => {
  const queryClient = useQueryClient();
  const [channelLink, setChannelLink] = useState("");
  const [videoMetadata, setVideoMetadata] = useState<any[]>([]);
  const [scriptToView, setScriptToView] = useState<{ title: string; content: string } | null>(null);

  // Queries
  const { data: downloadedVideos = [], isLoading: isLoadingDownloaded } = useQuery({
    queryKey: ['downloaded_videos_list'],
    queryFn: () => callApi('/api/v1/videos/list', 'GET'),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: transcriptions = [], isLoading: isLoadingTranscriptions } = useQuery({
    queryKey: ['transcriptions_list'],
    queryFn: () => callApi('/api/v1/transcriptions/list', 'GET'),
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  // Mutations
  const getMetadataMutation = useMutation({
    mutationFn: (channel: string) => callApi('/api/v1/metadata', 'POST', { channel_link: channel, max_videos: 50 }),
    onSuccess: (data) => {
      setVideoMetadata(data.videos || []);
      showSuccess(`Đã tìm thấy ${data.videos?.length || 0} video.`);
    },
    onError: (error: Error) => showError(error.message),
  });

  const downloadVideoMutation = useMutation({
    mutationFn: (videoUrl: string) => {
      const toastId = showLoading(`Đang tải video...`);
      return callApi('/api/v1/download', 'POST', { channel_link: videoUrl, max_videos: 1 }).finally(() => dismissToast(toastId));
    },
    onSuccess: () => {
      showSuccess("Video đã được thêm vào hàng đợi tải về.");
      queryClient.invalidateQueries({ queryKey: ['downloaded_videos_list'] });
    },
    onError: (error: Error) => showError(error.message),
  });

  const transcribeMutation = useMutation({
    mutationFn: (params: { filename: string; model: string }) => {
      const toastId = showLoading(`Đang tách script cho video ${params.filename}...`);
      return callApi('/api/v1/transcribe', 'POST', {
        video_filename: params.filename,
        language: "vi",
        model_size: params.model,
        beam_size: 5,
        vad_filter: true,
        compute_type: "auto"
      }).finally(() => dismissToast(toastId));
    },
    onSuccess: () => {
      showSuccess("Yêu cầu tách script đã được gửi đi.");
      queryClient.invalidateQueries({ queryKey: ['transcriptions_list'] });
    },
    onError: (error: Error) => showError(error.message),
  });

  const viewTranscriptionMutation = useMutation({
    mutationFn: async (videoName: string) => {
      const content = await callApi(`/api/v1/transcription/${videoName.replace('.mp4', '')}`, 'GET');
      return { title: videoName, content };
    },
    onSuccess: ({ title, content }) => {
      setScriptToView({ title, content });
    },
    onError: (error: Error) => showError(error.message),
  });

  const handleGetMetadata = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelLink) {
      getMetadataMutation.mutate(channelLink);
    }
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Tách Script từ Video TikTok</h1>
          <p className="text-muted-foreground mt-1">Nhập kênh TikTok, tải video và tách script tự động.</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Column 1: Get Metadata */}
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" /> 1. Lấy danh sách video</CardTitle>
              <CardDescription>Nhập link kênh hoặc username TikTok.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGetMetadata} className="flex gap-2">
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
              <ScrollArea className="mt-4 h-96">
                <div className="space-y-2">
                  {videoMetadata.map((video, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                      <p className="text-sm truncate flex-1 pr-2">{video.desc}</p>
                      <Button size="sm" variant="outline" onClick={() => downloadVideoMutation.mutate(video.video_url)} disabled={downloadVideoMutation.isPending}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Column 2 & 3: Downloaded & Transcribed */}
          <div className="xl:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ListVideo className="h-5 w-5 text-primary" /> 2. Video đã tải về</CardTitle>
                <CardDescription>Các video sẵn sàng để tách script.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[28.5rem]">
                  {isLoadingDownloaded ? <Skeleton className="h-full w-full" /> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Tên file</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {downloadedVideos.map((filename: string, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="text-xs truncate max-w-xs">{filename}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" onClick={() => transcribeMutation.mutate({ filename, model: 'medium' })} disabled={transcribeMutation.isPending}>
                                <Captions className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> 3. Kết quả</CardTitle>
                <CardDescription>Các script đã được tách thành công.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[28.5rem]">
                  {isLoadingTranscriptions ? <Skeleton className="h-full w-full" /> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Tên file</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {transcriptions.map((filename: string, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="text-xs truncate max-w-xs">{filename}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" onClick={() => viewTranscriptionMutation.mutate(filename)} disabled={viewTranscriptionMutation.isPending}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* View Script Dialog */}
      <Dialog open={!!scriptToView} onOpenChange={() => setScriptToView(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nội dung Script</DialogTitle>
            <DialogDescription>{scriptToView?.title}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4 pr-4">
            <pre className="whitespace-pre-wrap text-sm">{scriptToView?.content}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VideoToScript;