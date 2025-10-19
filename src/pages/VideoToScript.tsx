import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { FileObject } from '@supabase/storage-js';
import { cn } from "@/lib/utils";

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// Icons
import { UploadCloud, FileVideo, X, Loader2, AlertTriangle, Trash2, Eye, Captions } from "lucide-react";

// Utils
import { showSuccess, showError } from "@/utils/toast";

type TranscriptionTask = {
  id: string;
  video_name: string;
  status: string;
  created_at: string;
  script_content: string | null;
  error_message: string | null;
};

// Helper to get status badge
const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-100 text-green-800">Hoàn thành</Badge>;
    case 'processing':
      return <Badge variant="outline" className="text-blue-800 border-blue-200"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Đang xử lý</Badge>;
    case 'failed':
      return <Badge variant="destructive">Thất bại</Badge>;
    case 'pending':
    default:
      return <Badge variant="secondary">Đang chờ</Badge>;
  }
};

const VideoToScript = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedExistingVideo, setSelectedExistingVideo] = useState<FileObject | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TranscriptionTask | null>(null);
  const [taskToView, setTaskToView] = useState<TranscriptionTask | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryKey = ['transcription_tasks', user?.id];

  // Fetch tasks
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<TranscriptionTask[]>({
    queryKey,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('transcription_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch already uploaded videos
  const { data: uploadedVideos = [], isLoading: isLoadingVideos } = useQuery<FileObject[]>({
    queryKey: ['uploaded_videos', user?.id],
    queryFn: async () => {
        if (!user) return [];
        const { data, error } = await supabase.storage
            .from('video-uploads')
            .list(user.id, {
                limit: 100,
                offset: 0,
                sortBy: { column: 'created_at', order: 'desc' },
            });
        if (error) throw error;
        return data.filter(file => file.name !== '.emptyFolderPlaceholder');
    },
    enabled: !!user,
  });

  // Real-time subscription for tasks
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`transcription_tasks_changes_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transcription_tasks', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, queryKey]);

  // Mutation for creating a task from an existing video
  const createTaskFromExistingMutation = useMutation({
    mutationFn: async (video: { name: string; path: string }) => {
        if (!user) throw new Error("User not authenticated.");

        const { data: existingTask, error: checkError } = await supabase
            .from('transcription_tasks')
            .select('id')
            .eq('video_storage_path', video.path)
            .maybeSingle();

        if (checkError) throw new Error(`Lỗi kiểm tra tác vụ: ${checkError.message}`);
        if (existingTask) throw new Error("Đã có tác vụ tách script cho video này.");

        const { data: newTask, error: insertError } = await supabase
            .from('transcription_tasks')
            .insert({
                user_id: user.id,
                video_name: video.name,
                video_storage_path: video.path,
                status: 'pending',
            })
            .select()
            .single();
        if (insertError) throw new Error(`Lỗi tạo tác vụ: ${insertError.message}`);

        const { error: functionError } = await supabase.functions.invoke('start-transcription', {
            body: { taskId: newTask.id },
        });
        if (functionError) {
            await supabase.from('transcription_tasks').update({ status: 'failed', error_message: `Lỗi kích hoạt function: ${functionError.message}` }).eq('id', newTask.id);
            throw new Error(`Lỗi kích hoạt xử lý: ${functionError.message}`);
        }
    },
    onSuccess: () => {
        showSuccess("Tác vụ tách script đã được tạo!");
        setSelectedFile(null);
        setSelectedExistingVideo(null);
        queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
        showError(error.message);
    },
  });

  // Upload and create task mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("User not authenticated.");
      setUploadProgress(0);

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('video-uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });
      if (uploadError) throw new Error(`Lỗi tải video: ${uploadError.message}`);

      await createTaskFromExistingMutation.mutateAsync({ name: file.name, path: filePath });
    },
    onSuccess: () => {
      showSuccess("Video đã được tải lên và đang chờ xử lý!");
      setSelectedFile(null);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['uploaded_videos', user?.id] });
    },
    onError: (error: Error) => {
      showError(error.message);
      setUploadProgress(null);
    },
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('transcription_tasks').delete().eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa tác vụ thành công!");
      queryClient.invalidateQueries({ queryKey });
      setTaskToDelete(null);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSelectedExistingVideo(null);
    }
  };

  const handleSelectExisting = (video: FileObject) => {
    setSelectedExistingVideo(video);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStartTranscription = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    } else if (selectedExistingVideo && user) {
      createTaskFromExistingMutation.mutate({
        name: selectedExistingVideo.name,
        path: `${user.id}/${selectedExistingVideo.name}`,
      });
    }
  };

  const isProcessing = uploadMutation.isPending || createTaskFromExistingMutation.isPending;

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Tách Script từ Video</h1>
          <p className="text-muted-foreground mt-1">Tải lên video của bạn để tự động tạo kịch bản bằng công nghệ AI.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>1. Chọn Video</CardTitle>
                <CardDescription>Tải lên file mới hoặc chọn video đã có.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label htmlFor="video-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors">
                  <UploadCloud className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Bấm để chọn file mới</p>
                  <Input ref={fileInputRef} id="video-upload" type="file" className="hidden" onChange={handleFileChange} accept="video/mp4,video/quicktime" disabled={isProcessing} />
                </label>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Hoặc</span></div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">Chọn video đã tải lên</p>
                  <ScrollArea className="h-40 w-full rounded-md border">
                    <div className="p-2 space-y-1">
                      {isLoadingVideos ? (
                        [...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                      ) : uploadedVideos.length > 0 ? (
                        uploadedVideos.map(video => (
                          <button
                            key={video.id}
                            onClick={() => handleSelectExisting(video)}
                            className={cn(
                              "w-full text-left p-2 rounded-md flex items-center gap-2 transition-colors",
                              selectedExistingVideo?.id === video.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                            )}
                          >
                            <FileVideo className="h-4 w-4 flex-shrink-0" />
                            <span className="text-sm truncate font-medium">{video.name}</span>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center p-4">Chưa có video nào.</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {(selectedFile || selectedExistingVideo) && (
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileVideo className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="flex-grow min-w-0">
                        <p className="font-medium truncate text-sm" title={selectedFile?.name || selectedExistingVideo?.name}>
                          {selectedFile?.name || selectedExistingVideo?.name}
                        </p>
                        {selectedFile && <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => { setSelectedFile(null); setSelectedExistingVideo(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {uploadProgress !== null && (
                  <div className="space-y-1">
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-xs text-muted-foreground text-center">{uploadProgress < 100 ? `Đang tải lên... ${Math.round(uploadProgress)}%` : 'Hoàn tất tải lên, đang khởi tạo...'}</p>
                  </div>
                )}

                <Button onClick={handleStartTranscription} disabled={!selectedFile && !selectedExistingVideo || isProcessing} className="w-full">
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Captions className="mr-2 h-4 w-4" />}
                  Bắt đầu Tách Script
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>2. Lịch sử Tác vụ</CardTitle>
                <CardDescription>Theo dõi trạng thái các video đã tải lên.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên Video</TableHead>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingTasks ? (
                      [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                        </TableRow>
                      ))
                    ) : tasks.length > 0 ? (
                      tasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium max-w-xs truncate">{task.video_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: vi })}</TableCell>
                          <TableCell><StatusBadge status={task.status} /></TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => setTaskToView(task)} disabled={task.status !== 'completed' && task.status !== 'failed'}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setTaskToDelete(task)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">Chưa có tác vụ nào.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* View Script/Error Dialog */}
      <Dialog open={!!taskToView} onOpenChange={() => setTaskToView(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{taskToView?.status === 'completed' ? 'Nội dung Script' : 'Chi tiết Lỗi'}</DialogTitle>
            <DialogDescription>{taskToView?.video_name}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4 pr-4">
            {taskToView?.status === 'completed' ? (
              <pre className="whitespace-pre-wrap text-sm">{taskToView.script_content}</pre>
            ) : (
              <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm font-mono">{taskToView?.error_message}</p>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác. Tác vụ cho video "{taskToDelete?.video_name}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => taskToDelete && deleteMutation.mutate(taskToDelete.id)} disabled={deleteMutation.isPending} className="bg-destructive hover:bg-destructive/90">
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default VideoToScript;