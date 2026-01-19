import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, History, Loader2, Trash2, FileText, RefreshCcw, Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { showError, showSuccess } from "@/utils/toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const LogViewer = ({ taskId }: { taskId: string }) => {
  const { data: log, isLoading, isError, error } = useQuery({
    queryKey: ['tts_log', taskId],
    queryFn: async () => {
      // In a real Laravel implementation, we would have an endpoint for this
      // For now, we'll return a placeholder or check if the API supports fetching logs
      // Assuming for now logs are not prioritized or implemented in the same way
      return null;
    },
    enabled: !!taskId,
  });

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader><DialogTitle>API Log for Task {taskId}</DialogTitle></DialogHeader>
      <div className="max-h-[60vh] overflow-y-auto pr-4">
        {isLoading && <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
        {isError && <p className="text-destructive">Lỗi khi tải log: {(error as Error).message}</p>}
        {!log && !isLoading && !isError && <p className="text-center text-muted-foreground py-8">Chức năng xem log chi tiết chưa được hỗ trợ trên backend mới.</p>}
      </div>
    </DialogContent>
  );
};

type VoiceTask = {
  id: string;
  voice_name: string;
  status: string;
  created_at: string;
  audio_url: string | null;
  error_message: string | null;
  cloned_voice_name: string | null;
  koc_content_ideas: { idea_content: string }[] | null;
};

const TaskItem = ({ task, onSelect, isSelected, onDelete, onLogView, onRetry }: { task: VoiceTask, onSelect: (id: string) => void, isSelected: boolean, onDelete: (id: string) => void, onLogView: (id: string) => void, onRetry: (id: string) => void }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "done": return <Badge variant="default" className="bg-green-100 text-green-800">Hoàn thành</Badge>;
      case "doing":
      case "pending": // Handle 'pending' which might be used in Laravel
      case "processing":
        return <Badge variant="outline" className="text-blue-800 border-blue-200"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Đang xử lý</Badge>;
      case "error":
      case "failed":
        return <Badge variant="destructive" className="hover:bg-destructive">Lỗi</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const friendlyErrorMessage = (message: string | null) => {
    if (message && message.includes("Max retries")) return "Dịch vụ tạo voice không thể xử lý yêu cầu này sau nhiều lần thử. Vui lòng thử lại sau hoặc kiểm tra lại nội dung văn bản.";
    return message;
  };

  const ideaContent = task.koc_content_ideas?.[0]?.idea_content;
  const displayName = ideaContent
    ? (ideaContent.length > 50 ? `${ideaContent.substring(0, 50)}...` : ideaContent)
    : task.voice_name;

  const title = ideaContent || task.voice_name;

  return (
    <div className="p-3 rounded-md border bg-background">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect(task.id)}
            aria-label={`Select task ${task.id}`}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate text-sm" title={title}>{displayName}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {getStatusBadge(task.status)}
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: vi })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col -mt-1 -mr-2">
          {/* Log functionality temporarily disabled/simplified */}
          {/* <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-500" onClick={() => onLogView(task.id)} title="Xem Log">
            <FileText className="h-4 w-4" />
          </Button> */}
          {(task.status === 'error' || task.status === 'failed') && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-green-500" onClick={() => onRetry(task.id)} title="Thử lại">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(task.id)} title="Xóa Task">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {(task.status === 'done' && task.audio_url) && (
        <div className="mt-2">
          <audio controls src={task.audio_url} className="h-8 w-full" />
        </div>
      )}
      {(task.status === 'error' || task.status === 'failed') && (
        <div className="mt-2">
          <p className="text-xs text-destructive">{friendlyErrorMessage(task.error_message)}</p>
        </div>
      )}
    </div>
  );
};

export const TaskList = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [tasksToDelete, setTasksToDelete] = useState<string[]>([]);
  const [logTaskId, setLogTaskId] = useState<string | null>(null);

  const { data: tasks, isLoading, isError, error } = useQuery<VoiceTask[]>({
    queryKey: ["voice_tasks_grouped", user?.id],
    queryFn: () => api.voice.tasks(),
    enabled: !!user,
    // Replace realtime subscription with polling
    refetchInterval: (query) => {
      const data = query.state.data as VoiceTask[];
      // Poll if any task is processing
      return data?.some(task => ['doing', 'pending', 'processing'].includes(task.status)) ? 5000 : false;
    }
  });

  const groupedTasks = useMemo(() => {
    if (!tasks) return {};
    return tasks.reduce((acc, task) => {
      const groupName = task.cloned_voice_name || 'Chưa phân loại';
      if (!acc[groupName]) acc[groupName] = [];
      acc[groupName].push(task);
      return acc;
    }, {} as Record<string, VoiceTask[]>);
  }, [tasks]);

  const deleteTasksMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      // Delete tasks sequentially or in parallel if API supports bulk
      for (const id of taskIds) {
        await api.voice.deleteTask(id);
      }
    },
    onSuccess: (_, variables) => {
      showSuccess(`Đã xóa ${variables.length} task thành công!`);
      queryClient.invalidateQueries({ queryKey: ["voice_tasks_grouped", user?.id] });
      setSelectedTaskIds([]);
      setTasksToDelete([]);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
      setTasksToDelete([]);
    },
  });

  const retryTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await api.voice.retryTask(taskId);
    },
    onSuccess: () => {
      showSuccess("Đã gửi lại yêu cầu tạo voice!");
      queryClient.invalidateQueries({ queryKey: ["voice_tasks_grouped", user?.id] });
    },
    onError: (error: Error) => showError(`Thử lại thất bại: ${error.message}`),
  });

  const handleSelectTask = (id: string) => setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(taskId => taskId !== id) : [...prev, id]);
  const handleDelete = (ids: string[]) => setTasksToDelete(ids);
  const confirmDelete = () => { if (tasksToDelete.length > 0) deleteTasksMutation.mutate(tasksToDelete); };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>Lịch sử Tasks</CardTitle><CardDescription>Các yêu cầu tạo voice gần đây.</CardDescription></div>
          {selectedTaskIds.length > 0 && (<Button variant="destructive" onClick={() => handleDelete(selectedTaskIds)}><Trash2 className="mr-2 h-4 w-4" /> Xóa ({selectedTaskIds.length})</Button>)}
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
            : isError ? <div className="text-center py-10 text-destructive"><AlertCircle className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-medium">Không thể tải lịch sử</h3><p className="mt-1 text-sm">{(error as Error).message}</p></div>
              : tasks && tasks.length > 0 ? (
                <Accordion type="multiple" className="w-full space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {Object.entries(groupedTasks).map(([voiceName, taskGroup]) => (
                    <AccordionItem key={voiceName} value={voiceName} className="border rounded-lg bg-background/50">
                      <AccordionTrigger className="p-4 hover:no-underline">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-purple-100 text-purple-600">
                              <Mic className="h-5 w-5" />
                            </div>
                            <span className="font-semibold text-sm truncate">{voiceName}</span>
                          </div>
                          <Badge variant="secondary" className="flex-shrink-0 ml-2 text-xs">{taskGroup.length} task</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 pt-0"><div className="space-y-3 border-t pt-4">{taskGroup.map((task) => (<TaskItem key={task.id} task={task} onSelect={handleSelectTask} isSelected={selectedTaskIds.includes(task.id)} onDelete={(id) => handleDelete([id])} onLogView={(id) => setLogTaskId(id)} onRetry={(id) => retryTaskMutation.mutate(id)} />))}</div></AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )
                : <div className="text-center py-10 border-2 border-dashed rounded-lg"><History className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">Chưa có task nào</h3><p className="mt-1 text-sm text-muted-foreground">Hãy bắt đầu tạo voice đầu tiên của bạn!</p></div>}
        </CardContent>
      </Card>
      <AlertDialog open={tasksToDelete.length > 0} onOpenChange={() => setTasksToDelete([])}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác. {tasksToDelete.length} task sẽ bị xóa vĩnh viễn.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} disabled={deleteTasksMutation.isPending} className="bg-destructive hover:bg-destructive/90">{deleteTasksMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!logTaskId} onOpenChange={(open) => !open && setLogTaskId(null)}>{logTaskId && <LogViewer taskId={logTaskId} />}</Dialog>
    </>
  );
};