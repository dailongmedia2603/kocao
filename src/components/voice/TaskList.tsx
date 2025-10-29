import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
      const { data, error } = await supabase.from('tts_logs').select('*').eq('task_id', taskId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader><DialogTitle>API Log for Task {taskId}</DialogTitle></DialogHeader>
      <div className="max-h-[60vh] overflow-y-auto pr-4">
        {isLoading && <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
        {isError && <p className="text-destructive">Lỗi khi tải log: {(error as Error).message}</p>}
        {log ? (
          <div className="space-y-4 text-sm">
            <div><h4 className="font-semibold mb-2">Request Payload</h4><pre className="p-3 bg-muted rounded-md text-xs overflow-auto"><code>{JSON.stringify(log.request_payload, null, 2)}</code></pre></div>
            <div><h4 className="font-semibold mb-2">Response Body (Status: {log.status_code})</h4><pre className="p-3 bg-muted rounded-md text-xs overflow-auto"><code>{JSON.stringify(log.response_body, null, 2)}</code></pre></div>
          </div>
        ) : (!isLoading && !isError && <p className="text-center text-muted-foreground py-8">Không tìm thấy log cho task này.</p>)}
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
};

const fetchTasks = async (userId: string): Promise<VoiceTask[]> => {
  if (!userId) return [];
  const { data, error } = await supabase.from('voice_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data as VoiceTask[];
};

const TaskItem = ({ task, onSelect, isSelected, onDelete, onLogView, onRetry }: { task: VoiceTask, onSelect: (id: string) => void, isSelected: boolean, onDelete: (id: string) => void, onLogView: (id: string) => void, onRetry: (id: string) => void }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "done": return <Badge variant="default" className="bg-green-100 text-green-800">Hoàn thành</Badge>;
      case "doing": return <Badge variant="outline" className="text-blue-800 border-blue-200"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Đang xử lý</Badge>;
      case "error": return <Badge variant="destructive" className="hover:bg-destructive">Lỗi</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const friendlyErrorMessage = (message: string | null) => {
    if (message && message.includes("Max retries")) return "Dịch vụ tạo voice không thể xử lý yêu cầu này sau nhiều lần thử. Vui lòng thử lại sau hoặc kiểm tra lại nội dung văn bản.";
    return message;
  };

  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-md border bg-background">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Checkbox checked={isSelected} onCheckedChange={() => onSelect(task.id)} aria-label={`Select task ${task.id}`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate text-sm">{task.voice_name}</p>
          <div className="flex items-center gap-2 mt-1">
            {getStatusBadge(task.status)}
            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: vi })}</p>
          </div>
          {task.status === 'done' && task.audio_url && (<audio controls src={task.audio_url} className="h-8 w-full mt-2" />)}
          {task.status === 'error' && <p className="text-xs text-destructive mt-1">{friendlyErrorMessage(task.error_message)}</p>}
        </div>
      </div>
      <div className="flex items-center">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-blue-500" onClick={() => onLogView(task.id)} title="Xem Log"><FileText className="h-4 w-4" /></Button>
        {task.status === 'error' && (<Button variant="ghost" size="icon" className="text-muted-foreground hover:text-green-500" onClick={() => onRetry(task.id)} title="Thử lại"><RefreshCcw className="h-4 w-4" /></Button>)}
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(task.id)} title="Xóa Task"><Trash2 className="h-4 w-4" /></Button>
      </div>
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
    queryFn: () => fetchTasks(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`voice_tasks_changes_${user.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'voice_tasks',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Voice task change received!', payload);
          queryClient.invalidateQueries({ queryKey: ['voice_tasks_grouped', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

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
      const { error: dbError } = await supabase.from('voice_tasks').delete().in('id', taskIds);
      if (dbError) throw dbError;
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
      const { data, error } = await supabase.functions.invoke("retry-voice-task", { body: { oldTaskId: taskId } });
      if (error || data.error) throw new Error(error?.message || data.error);
      return data;
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