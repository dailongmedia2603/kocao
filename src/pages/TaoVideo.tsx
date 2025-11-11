import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/utils/toast";
import { Film, Clapperboard, AlertCircle, Download, Loader2, RefreshCw, Trash2, Eye, History, Library, Upload } from "lucide-react";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { VideoPopup } from "@/components/dreamface/VideoPopup";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DreamfaceLogDialog } from "@/components/dreamface/DreamfaceLogDialog";
import { KocVideoSelector } from "@/components/dreamface/KocVideoSelector";
import { VoiceTaskSelector } from "@/components/dreamface/VoiceTaskSelector";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession } from "@/contexts/SessionContext";

const getStatusBadge = (status: string, errorMessage?: string | null) => {
  switch (status) {
    case 'completed': return <Badge className="bg-green-100 text-green-800">Hoàn thành</Badge>;
    case 'processing': return <Badge variant="outline" className="text-blue-800 border-blue-200"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Đang xử lý</Badge>;
    case 'failed':
      if (errorMessage) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="destructive" className="cursor-help">Thất bại</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{errorMessage}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      return <Badge variant="destructive">Thất bại</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
};

const TaoVideo = () => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [selectedKocId, setSelectedKocId] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [selectedAudioUrl, setSelectedAudioUrl] = useState<string | null>(null);
  const [isVideoPopupOpen, setVideoPopupOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<any | null>(null);
  const [isLogOpen, setLogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useSession();

  const { data: kocs, isLoading: isLoadingKocs } = useQuery({
    queryKey: ['kocs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('kocs').select('id, name').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: tasks, isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['dreamface_tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("dreamface-get-list");
      if (error || data.error) throw new Error(error?.message || data.error);
      return data.data;
    },
    refetchInterval: query => {
      const data = query.state.data as any[];
      const shouldRefetch = data?.some(task => 
        task.status === 'processing' || 
        (task.status === 'completed' && !task.result_video_url)
      );
      return shouldRefetch ? 60000 : false;
    },
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('dreamface-tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dreamface_tasks', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dreamface_tasks'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const createVideoMutation = useMutation({
    mutationFn: async () => {
      if (!videoUrl || !selectedKocId || (!audioFile && !selectedAudioUrl)) {
        throw new Error("Vui lòng chọn KOC, video nguồn và nguồn âm thanh.");
      }

      let body;
      let action;

      if (audioFile) {
        // Case 1: Uploading a new file
        action = 'create-video';
        const formData = new FormData();
        formData.append('action', action);
        formData.append('videoUrl', videoUrl);
        formData.append('audioFile', audioFile);
        formData.append('kocId', selectedKocId);
        body = formData;
      } else {
        // Case 2: Using a URL from the library
        action = 'create-video-from-url';
        body = {
          action,
          videoUrl,
          audioUrl: selectedAudioUrl,
          kocId: selectedKocId,
        };
      }
      
      const { data, error } = await supabase.functions.invoke("dreamface-api-proxy", { body });
      if (error || data.error) throw new Error(error?.message || data.error);
      return data;
    },
    onSuccess: () => {
      showSuccess("Yêu cầu tạo video đã được gửi! Video sẽ sớm xuất hiện trong danh sách.");
      queryClient.invalidateQueries({ queryKey: ['dreamface_tasks'] });
      setVideoUrl(null);
      setAudioFile(null);
      setSelectedAudioUrl(null);
      setSelectedKocId(null);
      const form = document.getElementById('create-video-form') as HTMLFormElement;
      form?.reset();
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data, error } = await supabase.functions.invoke("dreamface-delete-task", {
        body: { taskId }
      });
      if (error || data.error) throw new Error(error?.message || data.error);
    },
    onMutate: async (taskIdToDelete: string) => {
      await queryClient.cancelQueries({ queryKey: ['dreamface_tasks'] });
      const previousTasks = queryClient.getQueryData(['dreamface_tasks']);
      queryClient.setQueryData(['dreamface_tasks'], (old: any[] | undefined) =>
        old ? old.filter(task => task.id !== taskIdToDelete) : []
      );
      setTaskToDelete(null);
      showSuccess("Đã bắt đầu xóa tác vụ!");
      return { previousTasks };
    },
    onError: (err: Error, taskId, context: any) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['dreamface_tasks'], context.previousTasks);
      }
      showError(`Lỗi xóa tác vụ: ${err.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dreamface_tasks'] });
    },
  });

  const handleCreateVideo = (e: React.FormEvent) => {
    e.preventDefault();
    createVideoMutation.mutate();
  };

  const handleViewVideo = (task: any) => {
    setSelectedTask(task);
    setVideoPopupOpen(true);
  };

  const handleKocChange = (kocId: string) => {
    setSelectedKocId(kocId);
    setVideoUrl(null); // Reset video selection when KOC changes
  };

  const handleVideoChange = (url: string) => {
    setVideoUrl(url);
  };

  const handleAudioUrlSelect = (url: string | null) => {
    setSelectedAudioUrl(url);
    if (url) setAudioFile(null); // Clear file if URL is selected
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    setAudioFile(file);
    if (file) setSelectedAudioUrl(null); // Clear URL if file is selected
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Tạo Video</h1>
          <p className="text-muted-foreground mt-1">Tạo video AI và quản lý thư viện video của bạn.</p>
        </header>

        <Tabs defaultValue="library" className="w-full">
          <TabsList className="h-auto justify-start gap-1 rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="library"
              className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 border-transparent bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-600 ring-offset-background transition-all hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-red-500 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
            >
              <Library className="h-5 w-5 text-gray-500 group-data-[state=active]:text-red-600" />
              Thư viện
            </TabsTrigger>
            <TabsTrigger
              value="create"
              className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 border-transparent bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-600 ring-offset-background transition-all hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-red-500 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
            >
              <Clapperboard className="h-5 w-5 text-gray-500 group-data-[state=active]:text-red-600" />
              Tạo Video Mới
            </TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Tạo video từ video mẫu và âm thanh</CardTitle>
                <CardDescription>Chọn KOC và video nguồn, sau đó chọn âm thanh từ thư viện hoặc tải lên file mới.</CardDescription>
              </CardHeader>
              <CardContent>
                <form id="create-video-form" onSubmit={handleCreateVideo} className="space-y-6">
                  <KocVideoSelector
                    kocs={kocs || []}
                    isLoadingKocs={isLoadingKocs}
                    selectedKocId={selectedKocId}
                    onKocChange={handleKocChange}
                    selectedVideoUrl={videoUrl}
                    onVideoChange={handleVideoChange}
                  />
                  <div>
                    <label className="text-sm font-medium mb-2 block">3. Chọn nguồn âm thanh</label>
                    <Tabs defaultValue="library" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="library"><Library className="mr-2 h-4 w-4" />Thư viện</TabsTrigger>
                        <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4" />Tải lên</TabsTrigger>
                      </TabsList>
                      <TabsContent value="library" className="pt-4">
                        <VoiceTaskSelector onAudioUrlSelect={handleAudioUrlSelect} selectedAudioUrl={selectedAudioUrl} />
                      </TabsContent>
                      <TabsContent value="upload" className="pt-4">
                        <Input type="file" onChange={handleAudioFileChange} accept="audio/*" />
                      </TabsContent>
                    </Tabs>
                  </div>
                  <Button type="submit" className="w-full" disabled={createVideoMutation.isPending || !videoUrl || (!selectedAudioUrl && !audioFile)}>
                    {createVideoMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Film className="mr-2 h-4 w-4" />}
                    Tạo Video
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="library" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row justify-between items-center">
                <div>
                  <CardTitle>Thư viện Video</CardTitle>
                  <CardDescription>Danh sách các video đã được tạo.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setLogOpen(true)}>
                    <History className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => refetchTasks()} disabled={isLoadingTasks}>
                    <RefreshCw className={`h-4 w-4 ${isLoadingTasks ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thumbnail</TableHead>
                      <TableHead>Tiêu đề</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingTasks ? (
                      <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                    ) : tasks && tasks.length > 0 ? (
                      tasks.map((task: any) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            {task.thumbnail_url ? 
                              <img src={task.thumbnail_url} alt={task.title} className="h-16 w-16 object-cover rounded-md bg-muted" /> :
                              <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center"><Clapperboard className="h-6 w-6 text-muted-foreground" /></div>
                            }
                          </TableCell>
                          <TableCell className="font-medium">{task.title || 'Không có tiêu đề'}</TableCell>
                          <TableCell>{getStatusBadge(task.status, task.error_message)}</TableCell>
                          <TableCell>{format(new Date(task.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewVideo(task)} disabled={task.status !== 'completed'}>
                              <Eye className="mr-2 h-4 w-4" /> Xem
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setTaskToDelete(task)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="h-24 text-center">Chưa có video nào.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <VideoPopup isOpen={isVideoPopupOpen} onOpenChange={setVideoPopupOpen} task={selectedTask} />
      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này sẽ xóa vĩnh viễn tác vụ "{taskToDelete?.title}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTaskMutation.mutate(taskToDelete.id)} disabled={deleteTaskMutation.isPending}>
              {deleteTaskMutation.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DreamfaceLogDialog isOpen={isLogOpen} onOpenChange={setLogOpen} />
    </>
  );
};

export default TaoVideo;