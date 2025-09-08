import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { callVoiceApi } from "@/lib/voiceApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, History, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { showError, showSuccess } from "@/utils/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fetchTasks = async () => {
  const data = await callVoiceApi({ path: "v1/tasks?limit=20&type=minimax_tts", method: "GET" });
  return data.data;
};

const TaskItem = ({ task, onSelect, isSelected, onDelete }: { task: any, onSelect: (id: string) => void, isSelected: boolean, onDelete: (id: string) => void }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "done": return <Badge variant="default" className="bg-green-100 text-green-800">Hoàn thành</Badge>;
      case "doing": return <Badge variant="outline" className="text-blue-800 border-blue-200"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Đang xử lý</Badge>;
      case "error": return <Badge variant="destructive">Lỗi</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Checkbox checked={isSelected} onCheckedChange={() => onSelect(task.id)} aria-label={`Select task ${task.id}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {getStatusBadge(task.status)}
            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: vi })}</p>
          </div>
          {task.status === 'done' && task.metadata?.audio_url && (
            <audio controls src={task.metadata.audio_url} className="h-8 w-full mt-2" />
          )}
          {task.status === 'error' && <p className="text-xs text-destructive mt-1">{task.error_message}</p>}
        </div>
      </div>
      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(task.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

export const TaskList = () => {
  const queryClient = useQueryClient();
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [tasksToDelete, setTasksToDelete] = useState<string[]>([]);

  const { data: tasks, isLoading, isError, error } = useQuery({
    queryKey: ["voice_tasks"],
    queryFn: fetchTasks,
    refetchInterval: (query) => {
      const data = query.state.data as any[];
      return data?.some(task => task.status === 'doing') ? 5000 : false;
    },
  });

  const deleteTasksMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      const data = await callVoiceApi({ path: "v1/task/delete", method: "POST", body: { task_ids: taskIds } });
      if (data.success === false) {
        throw new Error(data.message || "API báo lỗi nhưng không có thông báo chi tiết.");
      }
      return data;
    },
    onSuccess: (_, variables) => {
      showSuccess(`Đã xóa ${variables.length} task thành công!`);
      // Invalidate query only after successful API response
      queryClient.invalidateQueries({ queryKey: ["voice_tasks"] });
      setSelectedTaskIds([]);
      setTasksToDelete([]);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
      setTasksToDelete([]);
    },
  });

  const handleSelectTask = (id: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(id) ? prev.filter(taskId => taskId !== id) : [...prev, id]
    );
  };

  const handleDelete = (ids: string[]) => {
    setTasksToDelete(ids);
  };

  const confirmDelete = () => {
    if (tasksToDelete.length > 0) {
      deleteTasksMutation.mutate(tasksToDelete);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lịch sử Tasks</CardTitle>
            <CardDescription>Các yêu cầu tạo voice gần đây.</CardDescription>
          </div>
          {selectedTaskIds.length > 0 && (
            <Button variant="destructive" onClick={() => handleDelete(selectedTaskIds)}>
              <Trash2 className="mr-2 h-4 w-4" /> Xóa ({selectedTaskIds.length})
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          : isError ? <div className="text-center py-10 text-destructive"><AlertCircle className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-medium">Không thể tải lịch sử</h3><p className="mt-1 text-sm">{(error as Error).message}</p></div>
          : tasks && tasks.length > 0 ? <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">{tasks.map((task: any) => (
            <TaskItem 
              key={task.id} 
              task={task} 
              onSelect={handleSelectTask}
              isSelected={selectedTaskIds.includes(task.id)}
              onDelete={(id) => handleDelete([id])}
            />
          ))}</div>
          : <div className="text-center py-10 border-2 border-dashed rounded-lg"><History className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">Chưa có task nào</h3><p className="mt-1 text-sm text-muted-foreground">Hãy bắt đầu tạo voice đầu tiên của bạn!</p></div>}
        </CardContent>
      </Card>
      <AlertDialog open={tasksToDelete.length > 0} onOpenChange={() => setTasksToDelete([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. {tasksToDelete.length} task sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteTasksMutation.isPending} className="bg-destructive hover:bg-destructive/90">
              {deleteTasksMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};