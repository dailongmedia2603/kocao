import { useQuery } from "@tanstack/react-query";
import { callVoiceApi } from "@/lib/voiceApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, History, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const fetchTasks = async () => {
  const data = await callVoiceApi({ path: "v1/tasks?limit=20&type=minimax_tts", method: "GET" });
  return data.data;
};

const TaskItem = ({ task }: { task: any }) => {
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
  );
};

export const TaskList = () => {
  const { data: tasks, isLoading, isError, error } = useQuery({
    queryKey: ["voice_tasks"],
    queryFn: fetchTasks,
    refetchInterval: (query) => {
      const data = query.state.data as any[];
      return data?.some(task => task.status === 'doing') ? 5000 : false;
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle>Lịch sử Tasks</CardTitle><CardDescription>Các yêu cầu tạo voice gần đây.</CardDescription></CardHeader>
      <CardContent>
        {isLoading ? <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        : isError ? <div className="text-center py-10 text-destructive"><AlertCircle className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-medium">Không thể tải lịch sử</h3><p className="mt-1 text-sm">{(error as Error).message}</p></div>
        : tasks && tasks.length > 0 ? <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">{tasks.map((task: any) => <TaskItem key={task.id} task={task} />)}</div>
        : <div className="text-center py-10 border-2 border-dashed rounded-lg"><History className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">Chưa có task nào</h3><p className="mt-1 text-sm text-muted-foreground">Hãy bắt đầu tạo voice đầu tiên của bạn!</p></div>}
      </CardContent>
    </Card>
  );
};