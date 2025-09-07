import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { callVoiceApi } from "@/lib/voiceApi";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Download, Loader2, AlertCircle, Music4, History } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const fetchTasks = async () => {
  const data = await callVoiceApi({ path: "task", method: "GET" });
  return data.tasks || [];
};

const TaskItem = ({ task }: { task: any }) => {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => callVoiceApi({ path: `task/${taskId}`, method: "DELETE" }),
    onSuccess: () => {
      showSuccess("Xóa task thành công!");
      queryClient.invalidateQueries({ queryKey: ["voice_tasks"] });
    },
    onError: (error: Error) => {
      showError(`Lỗi khi xóa: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="default" className="bg-green-500">Hoàn thành</Badge>;
      case 'processing': return <Badge variant="secondary">Đang xử lý</Badge>;
      case 'failed': return <Badge variant="destructive">Thất bại</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50 hover:bg-accent/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm" title={task.input}>{task.input}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {getStatusBadge(task.status)}
          <span>•</span>
          <span>{formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: vi })}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.status === 'completed' && task.result && (
          <>
            <audio controls src={task.result} className="h-8" />
            <Button variant="outline" size="icon" asChild>
              <a href={task.result} download><Download className="h-4 w-4" /></a>
            </Button>
          </>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bạn có chắc muốn xóa task này?</AlertDialogTitle>
              <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(task.id)} disabled={deleteMutation.isPending} className="bg-destructive hover:bg-destructive/90">
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export const TaskHistoryList = () => {
  const { data: tasks, isLoading, isError, error } = useQuery({
    queryKey: ["voice_tasks"],
    queryFn: fetchTasks,
    refetchInterval: (query) => {
      const tasksData = query.state.data as any[];
      const hasProcessingTasks = tasksData?.some((task: any) => task.status === 'processing');
      return hasProcessingTasks ? 5000 : false;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lịch sử tạo Voice</CardTitle>
        <CardDescription>Danh sách các giọng nói đã được tạo gần đây.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : isError ? (
          <div className="text-center py-10 text-destructive">
            <AlertCircle className="mx-auto h-12 w-12" />
            <h3 className="mt-4 text-lg font-medium">Không thể tải lịch sử</h3>
            <p className="mt-1 text-sm">{error.message}</p>
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {tasks.map((task: any) => <TaskItem key={task.id} task={task} />)}
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed rounded-lg">
            <History className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Chưa có task nào</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Hãy bắt đầu tạo voice đầu tiên của bạn!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};