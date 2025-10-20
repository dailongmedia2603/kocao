import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { useSession } from "@/contexts/SessionContext";

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";

// Icons
import { Download, Loader2, Captions, Eye, Search, Play, Heart, MessageSquare, Share2, ExternalLink, FileVideo, History, RefreshCw, AlertCircle, PlusCircle } from "lucide-react";
import { FaTiktok } from "react-icons/fa";

// Types
type TranscriptionTask = {
  id: string;
  video_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'downloading' | 'new';
  script_content: string | null;
  error_message: string | null;
  created_at: string;
};

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
    if (error instanceof Error) message = error.message;
    else if (typeof error === 'string') message = error;
    else if (error && typeof error === 'object') {
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

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed': return <Badge className="bg-green-100 text-green-800">Hoàn thành</Badge>;
    case 'processing': return <Badge variant="outline" className="text-blue-800 border-blue-200"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Đang xử lý</Badge>;
    case 'pending': return <Badge variant="secondary">Chờ tách script</Badge>;
    case 'downloading': return <Badge variant="outline" className="text-orange-800 border-orange-200"><Download className="mr-1 h-3 w-3 animate-spin" /> Đang tải về</Badge>;
    case 'failed': return <Badge variant="destructive">Thất bại</Badge>;
    case 'new': return <Badge variant="outline">Mới trên server</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
};

const VideoToScript = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [channelLink, setChannelLink] = useState("");
  const [videoMetadata, setVideoMetadata] = useState<any[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [logData, setLogData] = useState<any | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [scriptToView, setScriptToView] = useState<{ title: string; content: string } | null>(null);

  // Queries
  const { data: tasks = [], isLoading: isLoadingTasks, isFetching: isFetchingTasks } = useQuery<TranscriptionTask[]>({
    queryKey: ['transcription_tasks'],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('transcription_tasks').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: (query) => {
      const data = query.state.data as TranscriptionTask[] | undefined;
      return data?.some(task => task.status !== 'completed' && task.status !== 'failed') ? 15000 : false;
    },
  });

  const { data: serverFiles = [], isLoading: isLoadingServerFiles } = useQuery<string[]>({
    queryKey: ['server_video_files'],
    queryFn: async () => {
        const response = await callApi('/api/v1/videos/list', 'GET');
        return response?.files || [];
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh server file list every 30 seconds
  });

  const combinedTasks = useMemo(() => {
    const existingTaskNames = new Set(tasks.map(t => t.video_name));
    const newFilesAsTasks: TranscriptionTask[] = serverFiles
        .filter(fileName => !existingTaskNames.has(fileName))
        .map(fileName => ({
            id: `new-${fileName}`, // temporary ID
            video_name: fileName,
            status: 'new', // A new custom status
            script_content: null,
            error_message: null,
            created_at: new Date().toISOString(),
        }));
    return [...newFilesAsTasks, ...tasks];
  }, [tasks, serverFiles]);

  // Mutations
  const getMetadataMutation = useMutation({
    mutationFn: (channel: string) => callApi('/api/v1/metadata', 'POST', { channel_link: channel, max_videos: 50 }),
    onSuccess: (data) => {
      setLogData(data);
      const { username, videos = [] } = data;
      const processedVideos = videos.map((v: any) => {
        let url = v.video_url;
        if (!url) {
          if (v.video_id && username) url = `https://www.tiktok.com/@${username}/video/${v.video_id}`;
          else if (v.video_id) url = `https://www.tiktok.com/embed/${v.video_id}`;
        }
        return { ...v, video_url: url };
      }).filter((v: any) => v.video_url);
      setVideoMetadata(processedVideos);
      showSuccess(`Đã tìm thấy ${processedVideos.length} video.`);
    },
    onError: (error: unknown) => handleRobustError(error, "Lấy danh sách video thất bại."),
  });

  const downloadVideosMutation = useMutation({
    mutationFn: async (videoUrls: string[]) => {
      const toastId = showLoading(`Đang gửi yêu cầu tải ${videoUrls.length} video...`);
      try {
        const downloadPromises = videoUrls.map(url => callApi('/api/v1/download', 'POST', { channel_link: url, max_videos: 1 }));
        const results = await Promise.all(downloadPromises);
        
        console.log("API Download Response:", results);

        const failedRequests = results.filter(res => res.success !== true);
        if (failedRequests.length > 0) {
          const firstErrorResponse = failedRequests[0];
          const errorMessage = firstErrorResponse?.message || JSON.stringify(firstErrorResponse) || "Một số yêu cầu tải video thất bại.";
          throw new Error(errorMessage);
        }
        
        return { total: videoUrls.length };
      } finally {
        dismissToast(toastId);
      }
    },
    onSuccess: ({ total }) => {
      showSuccess(`Yêu cầu tải ${total} video đã được gửi. Vui lòng kiểm tra tab "Tách Script" sau vài phút.`);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['server_video_files'] });
      }, 5000);
      setSelectedVideoIds([]);
    },
    onError: (error: unknown) => handleRobustError(error, "Tải video thất bại."),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (videoName: string) => {
        if (!user) throw new Error("User not authenticated");
        const { error } = await supabase.from('transcription_tasks').insert({
            user_id: user.id,
            video_name: videoName,
            video_storage_path: `/uploads/${videoName}`,
            status: 'pending',
        });
        if (error) throw error;
    },
    onSuccess: (_, videoName) => {
        showSuccess(`Đã tạo tác vụ cho ${videoName}.`);
        queryClient.invalidateQueries({ queryKey: ['transcription_tasks'] });
        queryClient.invalidateQueries({ queryKey: ['server_video_files'] });
    },
    onError: (error: unknown) => handleRobustError(error, "Không thể tạo tác vụ."),
  });

  const transcribeMutation = useMutation({
    mutationFn: async (task: TranscriptionTask) => {
      const toastId = showLoading(`Đang tách script cho video ${task.video_name}...`);
      try {
        await supabase.from('transcription_tasks').update({ status: 'processing' }).eq('id', task.id);
        await callApi('/api/v1/transcribe', 'POST', {
          video_filename: task.video_name,
          language: "vi", model_size: 'medium', beam_size: 5, vad_filter: true, compute_type: "auto"
        });
      } finally {
        dismissToast(toastId);
      }
    },
    onSuccess: () => {
      showSuccess("Yêu cầu tách script đã được gửi đi. Kết quả sẽ được cập nhật tự động.");
      queryClient.invalidateQueries({ queryKey: ['transcription_tasks'] });
    },
    onError: (error: unknown, task) => {
      handleRobustError(error, "Tách script thất bại.");
      supabase.from('transcription_tasks').update({ status: 'failed', error_message: error instanceof Error ? error.message : String(error) }).eq('id', task.id);
    },
  });

  const handleGetMetadata = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelLink) getMetadataMutation.mutate(channelLink);
  };

  const handleDownloadSelected = () => {
    const urlsToDownload = videoMetadata
      .filter(v => selectedVideoIds.includes(v.video_id))
      .map(v => v.video_url);
    if (urlsToDownload.length > 0) {
      downloadVideosMutation.mutate(urlsToDownload);
    }
  };

  const handleSelectVideo = (videoId: string) => {
    setSelectedVideoIds(prev => 
      prev.includes(videoId) ? prev.filter(id => id !== videoId) : [...prev, videoId]
    );
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
            <TabsTrigger value="get-link" className="group h-auto justify-start gap-3 rounded-lg border p-3 shadow-sm transition-colors hover:bg-muted/50 data-[state=active]:border-red-500 data-[state=active]:bg-red-50"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-muted transition-colors group-data-[state=active]:bg-red-500"><Search className="h-5 w-5 text-muted-foreground transition-colors group-data-[state=active]:text-white" /></div><span className="font-semibold text-muted-foreground transition-colors group-data-[state=active]:text-red-600">Lấy Link & Tải Video</span></TabsTrigger>
            <TabsTrigger value="transcribe" className="group h-auto justify-start gap-3 rounded-lg border p-3 shadow-sm transition-colors hover:bg-muted/50 data-[state=active]:border-red-500 data-[state=active]:bg-red-50"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-muted transition-colors group-data-[state=active]:bg-red-500"><Captions className="h-5 w-5 text-muted-foreground transition-colors group-data-[state=active]:text-white" /></div><span className="font-semibold text-muted-foreground transition-colors group-data-[state=active]:text-red-600">Tách Script</span></TabsTrigger>
          </TabsList>
          <TabsContent value="get-link">
            <Card>
              <CardHeader><CardTitle>Lấy danh sách video</CardTitle><CardDescription>Nhập link kênh hoặc username TikTok (ví dụ: @username).</CardDescription></CardHeader>
              <CardContent>
                <form onSubmit={handleGetMetadata} className="flex gap-2 mb-6"><Input placeholder="@username hoặc link kênh" value={channelLink} onChange={(e) => setChannelLink(e.target.value)} disabled={getMetadataMutation.isPending} /><Button type="submit" disabled={getMetadataMutation.isPending || !channelLink}>{getMetadataMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lấy"}</Button></form>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold">Kết quả</h3>
                    {selectedVideoIds.length > 0 && <Button size="sm" onClick={handleDownloadSelected} disabled={downloadVideosMutation.isPending}><Download className="h-4 w-4 mr-2" /> Tải {selectedVideoIds.length} video đã chọn</Button>}
                  </div>
                  {logData && <Button variant="outline" size="sm" onClick={() => setIsLogOpen(true)}><History className="h-4 w-4 mr-2" />Xem Log</Button>}
                </div>
                <ScrollArea className="h-[60vh] border rounded-md"><div className="p-4 space-y-4">{getMetadataMutation.isPending ? ([...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)) : videoMetadata.length > 0 ? (videoMetadata.map((video) => (<Card key={video.video_id} className="flex overflow-hidden relative">{video.thumbnail_url ? <img src={video.thumbnail_url} alt={video.description || 'Video thumbnail'} className="w-24 object-cover bg-muted flex-shrink-0" /> : <div className="w-24 flex items-center justify-center bg-black flex-shrink-0"><FaTiktok className="h-10 w-10 text-white" /></div>}<div className="p-4 flex-1"><p className="text-sm font-medium line-clamp-2">{video.description || "Không có mô tả"}</p><div className="flex items-center gap-4 text-xs text-muted-foreground mt-2"><span className="flex items-center gap-1"><Play className="h-3 w-3" /> {formatStatNumber(video.view_count)}</span><span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {formatStatNumber(video.like_count)}</span><span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {formatStatNumber(video.comment_count)}</span><span className="flex items-center gap-1"><Share2 className="h-3 w-3" /> {formatStatNumber(video.repost_count)}</span></div><div className="flex items-center gap-2 mt-3"><Button size="sm" asChild><a href={video.video_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 mr-1.5" /> Xem trên TikTok</a></Button></div></div><Checkbox checked={selectedVideoIds.includes(video.video_id)} onCheckedChange={() => handleSelectVideo(video.video_id)} className="absolute top-2 right-2 h-5 w-5" /></Card>))) : (<div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><FileVideo className="h-10 w-10" /><p className="mt-2">Chưa có video nào.</p></div>)}</div></ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="transcribe">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Bảng điều khiển tác vụ</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => { queryClient.invalidateQueries({ queryKey: ['transcription_tasks'] }); queryClient.invalidateQueries({ queryKey: ['server_video_files'] }); }} disabled={isFetchingTasks || isLoadingServerFiles}><RefreshCw className={`h-4 w-4 ${(isFetchingTasks || isLoadingServerFiles) ? 'animate-spin' : ''}`} /></Button>
                </div>
                <CardDescription>Theo dõi trạng thái tải về và tách script của các video.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Tên Video</TableHead><TableHead>Trạng thái</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {isLoadingTasks || isLoadingServerFiles ? ([...Array(5)].map((_, i) => (<TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)))
                    : combinedTasks.length > 0 ? (combinedTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium text-xs max-w-xs truncate">{task.video_name}</TableCell>
                        <TableCell><StatusBadge status={task.status} /></TableCell>
                        <TableCell className="text-right space-x-2">
                          {task.status === 'new' && <Button size="sm" onClick={() => createTaskMutation.mutate(task.video_name)} disabled={createTaskMutation.isPending}><PlusCircle className="h-4 w-4 mr-2" /> Tạo tác vụ</Button>}
                          {task.status === 'pending' && <Button size="sm" onClick={() => transcribeMutation.mutate(task)} disabled={transcribeMutation.isPending}><Captions className="h-4 w-4" /></Button>}
                          {task.status === 'completed' && <Button size="sm" variant="outline" onClick={() => setScriptToView({ title: task.video_name, content: task.script_content || "Không có nội dung." })}><Eye className="h-4 w-4" /></Button>}
                          {task.status === 'failed' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertCircle className="h-5 w-5 text-destructive inline-block" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{task.error_message || 'Lỗi không xác định'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                      </TableRow>
                    ))) : (<TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">Chưa có tác vụ nào.</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Log Dữ liệu API</DialogTitle><DialogDescription>Đây là dữ liệu thô trả về từ API metadata.</DialogDescription></DialogHeader><ScrollArea className="max-h-[60vh] mt-4 pr-4"><pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md"><code>{JSON.stringify(logData, null, 2)}</code></pre></ScrollArea></DialogContent></Dialog>
      <Dialog open={!!scriptToView} onOpenChange={() => setScriptToView(null)}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Nội dung Script</DialogTitle><DialogDescription>{scriptToView?.title}</DialogDescription></DialogHeader><ScrollArea className="max-h-[60vh] mt-4 pr-4"><pre className="whitespace-pre-wrap text-sm">{scriptToView?.content}</pre></ScrollArea></DialogContent></Dialog>
    </>
  );
};

export default VideoToScript;