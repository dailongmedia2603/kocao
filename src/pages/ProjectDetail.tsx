import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, ArrowLeft, MoreHorizontal, Play, RefreshCw, Terminal, Bot, MousePointerClick, UploadCloud, DownloadCloud, Clock, Type } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateTaskDialog } from "../components/tasks/CreateTaskDialog";
import { EditTaskDialog } from "../components/tasks/EditTaskDialog";
import { cn } from "@/lib/utils";

type Project = {
  name: string;
};

type Task = {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
  payload: any;
  execution_order: number | null;
  error_log: string | null;
};

const taskTypeDetails: { [key: string]: { name: string; icon: React.ElementType } } = {
  NAVIGATE_TO_URL: { name: "Điều hướng đến URL", icon: Bot },
  CLICK_ELEMENT: { name: "Bấm vào phần tử", icon: MousePointerClick },
  DOWNLOAD_FILE: { name: "Tải xuống tệp và lưu", icon: DownloadCloud },
  UPLOAD_FILE: { name: "Tải lên tệp", icon: UploadCloud },
  DELAY: { name: "Chờ (Delay)", icon: Clock },
  PASTE_TEXT: { name: "Dán văn bản", icon: Type },
  DEFAULT: { name: "Hành động không xác định", icon: Bot },
};

const getTaskTypeDetails = (type: string) => {
  return taskTypeDetails[type] || { ...taskTypeDetails.DEFAULT, name: type };
};

const ProjectDetail = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [isCreateTaskOpen, setCreateTaskOpen] = useState(false);
  const [isEditTaskOpen, setEditTaskOpen] = useState(false);
  const [isDeleteTaskOpen, setDeleteTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const queryClient = useQueryClient();

  const { data: project, isLoading: isProjectLoading } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("name").eq("id", projectId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: tasks, isLoading: areTasksLoading } = useQuery<Task[]>({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("execution_order", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const runScenarioMutation = useMutation({
    mutationFn: async () => {
      const firstTask = tasks?.find(t => t.status === 'pending' && t.execution_order !== null);
      if (!firstTask) throw new Error("Không có bước nào để bắt đầu hoặc kịch bản đã chạy xong.");
      
      const { error } = await supabase.from("tasks").update({ status: "queued" }).eq("id", firstTask.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Đã bắt đầu kịch bản! Bước đầu tiên đã được gửi đi.");
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string, status: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: status, error_log: null })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Đã gửi lại tác vụ!");
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa bước thành công!");
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      setDeleteTaskOpen(false);
      setSelectedTask(null);
    },
    onError: (error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`realtime-project-tasks-${projectId}`)
      .on<Task>(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  const getStatusClasses = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 border-green-200";
      case "running": return "bg-blue-100 text-blue-800 border-blue-200 animate-pulse";
      case "queued": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "failed": return "bg-red-100 text-red-800 border-red-200";
      case "pending": default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const handleDeleteTask = () => {
    if (selectedTask) deleteTaskMutation.mutate(selectedTask.id);
  };

  const scenarioTasks = tasks?.filter(t => t.execution_order !== null) || [];

  return (
    <>
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/projects" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách dự án
            </Link>
            {isProjectLoading ? <Skeleton className="h-8 w-64" /> : <h1 className="text-3xl font-bold">{project?.name}</h1>}
            <p className="text-muted-foreground mt-1">Xây dựng và quản lý kịch bản tự động hóa của bạn.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => runScenarioMutation.mutate()} disabled={runScenarioMutation.isPending || !scenarioTasks.some(t => t.status === 'pending')}>
              <Play className="mr-2 h-4 w-4" /> Thực hiện Kịch bản
            </Button>
            <Button onClick={() => setCreateTaskOpen(true)} variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" /> Thêm bước
            </Button>
          </div>
        </div>
        
        <div className="w-full max-w-4xl mx-auto">
          {areTasksLoading ? (
            <div className="space-y-8">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : scenarioTasks.length > 0 ? (
            <div className="relative flex flex-col items-center pb-4">
              <div className="absolute top-6 left-10 h-full w-0.5 bg-transparent">
                <div className="h-full w-full border-l-2 border-dashed border-border"></div>
              </div>

              {scenarioTasks.map((task) => {
                const details = getTaskTypeDetails(task.type);
                const Icon = details.icon;
                return (
                  <div key={task.id} className="w-full my-4 z-10 flex items-start gap-6">
                    <div className="flex-shrink-0 h-20 flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center border-2 font-bold text-primary">
                        {task.execution_order}
                      </div>
                    </div>
                    <div className="w-full mt-1">
                      <Card className={cn("transition-all hover:shadow-md", getStatusClasses(task.status))}>
                        <div className="p-4 flex items-center gap-4">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-white flex items-center justify-center border">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-grow">
                            <h3 className="font-semibold">{task.name}</h3>
                            <p className="text-sm text-muted-foreground">{details.name}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant={task.status === 'completed' ? 'default' : 'outline'} className={cn("capitalize", getStatusClasses(task.status))}>{task.status}</Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedTask(task); setEditTaskOpen(true); }}>Sửa</DropdownMenuItem>
                                {task.status !== 'pending' && task.status !== 'queued' && (
                                  <DropdownMenuItem onClick={() => updateTaskStatusMutation.mutate({ taskId: task.id, status: 'queued' })}>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Chạy lại
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setSelectedTask(task); setDeleteTaskOpen(true); }}>Xóa</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        {task.status === 'failed' && (
                           <div className="border-t p-4">
                             <Alert variant="destructive">
                               <Terminal className="h-4 w-4" />
                               <AlertTitle>Chi tiết lỗi</AlertTitle>
                               <AlertDescription className="font-mono text-xs whitespace-pre-wrap mt-2">
                                 {task.error_log || "Extension đã báo lỗi nhưng không cung cấp thông tin chi tiết."}
                               </AlertDescription>
                             </Alert>
                           </div>
                         )}
                      </Card>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Card className="text-center py-16">
              <CardHeader>
                <CardTitle className="text-2xl">Bắt đầu kịch bản của bạn</CardTitle>
                <CardDescription>Chưa có bước nào trong dự án này.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setCreateTaskOpen(true)} className="mt-4">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Thêm bước đầu tiên
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {projectId && <CreateTaskDialog isOpen={isCreateTaskOpen} onOpenChange={setCreateTaskOpen} projectId={projectId} taskCount={tasks?.length || 0} />}
      <EditTaskDialog isOpen={isEditTaskOpen} onOpenChange={setEditTaskOpen} task={selectedTask} projectId={projectId} />
      <AlertDialog open={isDeleteTaskOpen} onOpenChange={setDeleteTaskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác. Thao tác này sẽ xóa vĩnh viễn bước "{selectedTask?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteTaskMutation.isPending}>
              {deleteTaskMutation.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProjectDetail;