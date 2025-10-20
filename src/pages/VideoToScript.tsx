import { useState, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Icons
import { Download, Loader2, Captions, Eye, Search, ListVideo, FileText, Play, Heart, MessageSquare, Share2, Copy, ExternalLink, FileVideo, History, Upload } from "lucide-react";
import { FaTiktok } from "react-icons/fa";

// API Proxy Function
const callApi = async (path: string, method: 'GET' | 'POST', body?: any) => {
  const { data, error } = await supabase.functions.invoke('transcribe-api-proxy', {
    body: { path, method, body }
  });
  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data;
};

const handleRobustError = (error: unknown, defaultMessage: string) => {
    let message = defaultMessage;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      if ('message' in error) message = String(error.message);
      else if ('detail' in error) message = String(error.detail);
      else message = JSON.stringify(error);
    }
    showError(message);
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
  const [logData, setLogData] = useState<any | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [scriptToView, setScriptToView] = useState<{ title: string; content: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setLogData(data);
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
    onError: (error: unknown) => handleRobustError(error, "Lấy danh sách video thất bại."),
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
    onError: (error: unknown) => handleRobustError(error, "Tải video thất bại."),
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
    onError: (error: unknown) => handleRobustError(error, "Tách script thất bại."),
  });

  const viewTranscriptionMutation = useMutation({
    mutationFn: async (videoName: string) => {
      const content = await callApi(`/api/v1/transcription/${videoName.replace('.mp4', '')}`, 'GET');
      return { title: videoName, content };
    },
    onSuccess: ({ title, content }) => {
      setScriptToView({ title, content });
    },
    onError: (error: unknown) => handleRobustError(error, "Không thể xem script."),
  });

  const uploadVideoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data, error } = await supabase.functions.invoke('transcribe-upload-proxy', { body: formData });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      showSuccess("Tải lên thành công! Video đã sẵn sàng để tách script.");
      queryClient.invalidateQueries({ queryKey: ['downloaded_videos_list'] });
    },
    onError: (error: unknown) => handleRobustError(error, "Tải lên thất bại."),
  });

  const handleGetMetadata = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelLink) {
      getMetadataMutation.mutate(channelLink);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadVideoMutation.mutate(file);
    }
    // Reset file input to allow uploading the same file again
    if (event.target) {
      event.target.value = "";
    }
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Tách Script từ Video TikTok</h1>
          <p className="text-muted-foreground mt-1">Lấy link, tải video và tách script tự động.</p>
        </header>

        <Tabs defaultValue="get-link">
          <TabsList className="inline-flex gap-3 bg-transparent p-0 mb-6">
            <TabsTrigger value="get-link" className="group h-auto justify-start gap-3 rounded-lg border p-3 shadow-sm transition-colors hover:bg-muted/50 data-[state=active]:border-red-500 data-[state=active]:bg-red-50">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-muted transition-colors group-data-[state=active]:bg-red-500"><Search className="h-5 w-5 text-muted-foreground transition-colors group-data-[state=active]:text-white" /></div>
              <span className="font-semibold text-muted-foreground transition-colors group-data-[state=active]:text-red-600">Lấy Link Video</span>
            </TabsTrigger>
            <TabsTrigger value="transcribe" className="group h-auto justify-start gap-3 rounded-lg border p-3 shadow-sm transition-colors hover:bg-muted/50 data-[state=active]:border-red-500 data-[state=active]:bg-red-50">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-muted transition-colors group-data-[state=active]:bg-red-500"><Captions className="h-5 w-5 text-muted-foreground transition-colors group-data-[state=active]:text-white" /></div>
              <span className="font-semibold text-muted-foreground transition-colors group-data-[state=active]:text-red-600">Tách Script</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="get-link">
            <Card>
              <CardHeader>
                <CardTitle>Lấy danh sách video</CardTitle>
                <CardDescription>Nhập link kênh hoặc username TikTok (ví dụ: @username).</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGetMetadata} className="flex gap-2 mb-6">
                  <Input placeholder="@username hoặc link kênh" value={channelLink} onChange={(e) => setChannelLink(e.target.value)} disabled={getMetadataMutation.isPending} />
                  <Button type="submit" disabled={getMetadataMutation.isPending || !channelLink}>{getMetadataMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lấy"}</Button>
                </form>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Kết quả</h3>
                  {logData && <Button variant="outline" size="sm" onClick={() => setIsLogOpen(true)}><History className="h-4 w-4 mr-2" />Xem Log</Button>}
                </div>
                <ScrollArea className="h-[60vh] border rounded-md">
                  <div className="p-4 space-y-4">
                    {getMetadataMutation.isPending ? ([...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />))
                    : videoMetadata.length > 0 ? (videoMetadata.map((video) => (
                      <Card key={video.video_id} className="flex overflow-hidden">
                        {video.thumbnail_url ? <img src={video.thumbnail_url} alt={video.description || 'Video thumbnail'} className="w-24 object-cover bg-muted flex-shrink-0" />
                        : <div className="w-24 flex items-center justify-center bg-black flex-shrink-0"><FaTiktok className="h-10 w-10 text-white" /></div>}
                        <div className="p-4 flex-1">
                          <p className="text-sm font-medium line-clamp-2">{video.description || "Không có mô tả"}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                            <span className="flex items-center gap-1"><Play className="h-3 w-3" /> {formatStatNumber(video.view_count)}</span>
                            <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {formatStatNumber(video.like_count)}</span>
                            <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {formatStatNumber(video.comment_count)}</span>
                            <span className="flex items-center gap-1"><Share2 className="h-3 w-3" /> {formatStatNumber(video.repost_count)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <Button size="sm" variant="outline" onClick={() => downloadVideoMutation.mutate(video.video_url)} disabled={downloadVideoMutation.isPending}><Download className="h-3 w-3 mr-1.5" /> Tải về</Button>
                            <Button size="sm" asChild><a href={video.video_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 mr-1.5" /> Xem trên TikTok</a></Button>
                          </div>
                        </div>
                      </Card>
                    ))) : (<div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><FileVideo className="h-10 w-10" /><p className="mt-2">Chưa có video nào.</p></div>)}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="transcribe">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><ListVideo className="h-5 w-5 text-primary" /> Video đã tải về</CardTitle>
                    <CardDescription>Các video sẵn sàng để tách script.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadVideoMutation.isPending}>
                    {uploadVideoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileChange} />
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[28.5rem]">
                    {isLoadingDownloaded ? <Skeleton className="h-full w-full" /> : (
                      <Table>
                        <TableHeader><TableRow><TableHead>Tên file</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {Array.isArray(downloadedVideos) && downloadedVideos.length > 0 ? (downloadedVideos.map((filename: string, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="text-xs truncate max-w-xs">{filename}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" onClick={() => transcribeMutation.mutate({ filename, model: 'medium' })} disabled={transcribeMutation.isPending}><Captions className="h-4 w-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))) : (<TableRow><TableCell colSpan={2} className="h-24 text-center text-muted-foreground">Chưa có video nào.</TableCell></TableRow>)}
                        </TableBody>
                      </Table>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Kết quả</CardTitle>
                  <CardDescription>Các script đã được tách thành công.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[28.5rem]">
                    {isLoadingTranscriptions ? <Skeleton className="h-full w-full" /> : (
                      <Table>
                        <TableHeader><TableRow><TableHead>Tên file</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {Array.isArray(transcriptions) && transcriptions.length > 0 ? (transcriptions.map((filename: string, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="text-xs truncate max-w-xs">{filename}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" onClick={() => viewTranscriptionMutation.mutate(filename)} disabled={viewTranscriptionMutation.isPending}><Eye className="h-4 w-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))) : (<TableRow><TableCell colSpan={2} className="h-24 text-center text-muted-foreground">Chưa có script nào.</TableCell></TableRow>)}
                        </TableBody>
                      </Table>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Log Dialog */}
      <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log Dữ liệu API</DialogTitle>
            <DialogDescription>Đây là dữ liệu thô trả về từ API metadata.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4 pr-4">
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md"><code>{JSON.stringify(logData, null, 2)}</code></pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>

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