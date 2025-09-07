import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, ArrowLeft, MoreHorizontal, Play, RefreshCw, Terminal, Bot, MousePointerClick, UploadCloud, DownloadCloud, Clock, Type, Plug } from "lucide-react";
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
import { type ExtensionInstance } from "@/pages/Extensions";

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
  assigned_extension_id: string | null;
  extension_instances: { name: string } | null;
};

const taskTypeDetails: { [key: string]: { name: string; icon: React.ElementType, description: string } } = {
  NAVIGATE_TO_URL: { name: "Điều hướng đến URL", icon: Bot, description: "Mở một trang web mới." },
  CLICK_ELEMENT: { name: "Bấm vào phần tử", icon: MousePointerClick, description: "Tương tác với một nút hoặc link." },
  DOWNLOAD_FILE: { name: "Tải xuống tệp", icon: DownloadCloud, description: "Lưu một tệp từ trang web." },
  UPLOAD_FILE: { name: "Tải lên tệp", icon: UploadCloud, description: "Tải một tệp lên trang web." },
  DELAY: { name: "Chờ (Delay)", icon: Clock, description: "Tạm dừng kịch bản một lúc." },
  PASTE_TEXT: { name: "Dán văn bản", icon: Type, description: "Nhập văn bản vào một ô." },
  DEFAULT: { name: "Hành động không xác định", icon: Bot, description: "Một hành động không rõ." },
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
        .select("*, extension_instances(name)")
        .eq("project_id", projectId)
        .order("execution_order", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data as any;
    },
    enabled: !!projectId,
  });

  const { data: extensions, isLoading: areExtensionsLoading } = useQuery<ExtensionInstance[]>({
    queryKey: ["extensions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("extension_instances").select("*");
      if (error) throw error;
      return data;
    },
  });

  const runScenarioMutation = useMutation({
    mutationFn: async ({ extensionId }: { extensionId: string }) => {
      const firstTask = tasks?.find(t => t.status === 'pending' && t.execution_order !== null);
      if (!firstTask) throw new Error("Không có bước nào để bắt đầu hoặc kịch bản đã chạy xong.");
      
      const { error } = await supabase
        .from("tasks")
        .update({ status: "queued", assigned_extension_id: extensionId })
        .eq("id", firstTask.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Đã bắt đầu kịch bản! Bước đầu tiên đã được gửi đến Extension được chỉ định.");
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
      <div className="flex flex-col lg:flex-row bg-gray-50/50 min-h-[calc(100vh-theme(spacing.16))]">
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <Link to="/projects" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách dự án
              </Link>
              {isProjectLoading ? <Skeleton className="h-8 w-64" /> : <h1 className="text-3xl font-bold">{project?.name}</h1>}
              <p className="text-muted-foreground mt-1">Xây dựng và quản lý các bước trong kịch bản của bạn.</p>
            </div>
            {scenarioTasks.length > 0 && (
              <Button onClick={() => setCreateTaskOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Thêm bước
              </Button>
            )}
          </div>

          <div className="w-full max-w-3xl mx-auto">
            {areTasksLoading ? (
              <div className="space-y-8">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ) : scenarioTasks.length > 0 ? (
              <div className="relative flex flex-col items-center pb-4">
                <Badge variant="outline" className="bg-white mb-6 z-10">Bắt đầu</Badge>
                <div className="absolute top-5 left-1/2 -translate-x-1/2 h-full w-0.5 bg-transparent">
                  <div className="h-full w-full border-l-2 border-dashed border-border"></div>
                </div>
                <div className="space-y-8 w-full z-10">
                  {scenarioTasks.map((task) => {
                    const details = getTaskTypeDetails(task.type);
                    const Icon = details.icon;
                    return (
                      <div key={task.id} className="w-full flex justify-center">
                        <Card className="w-96 bg-white z-10 relative group shadow-sm hover:shadow-lg transition-shadow">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className={cn("flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center border", getStatusClasses(task.status))}>
                              <Icon className="h-6 w-6" />
                            </div>
                            <div className="flex-grow">
                              <h3 className="font-semibold">{task.name}</h3>
                              <p className="text-sm text-muted-foreground">{details.name}</p>
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
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
                          </CardContent>
                          {task.status === 'failed' && (
                             <div className="border-t p-3">
                               <Alert variant="destructive" className="p-2">
                                 <Terminal className="h-4 w-4" />
                                 <AlertTitle className="text-xs font-semibold">Chi tiết lỗi</AlertTitle>
                                 <AlertDescription className="font-mono text-xs whitespace-pre-wrap mt-1">
                                   {task.error_log || "Extension đã báo lỗi nhưng không cung cấp thông tin chi tiết."}
                                 </AlertDescription>
                               </Alert>
                             </div>
                           )}
                           <Badge variant={task.status === 'completed' ? 'default' : 'outline'} className={cn("capitalize absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-xs px-1.5 py-0.5", getStatusClasses(task.status))}>{task.status}</Badge>
                        </Card>
                      </div>
                    )
                  })}
                </div>
                <Badge variant="destructive" className="mt-6 z-10">Kết thúc</Badge>
              </div>
            ) : (
              <Card className="mt-8">
                <CardContent className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center p-16">
                  <div className="bg-gray-100 rounded-full p-4 mb-4">
                    <PlusCircle className="h-8 w-8 text-gray-500" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Xây dựng kịch bản của bạn</h2>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Thêm các bước từ bảng điều khiển bên phải hoặc nhấp vào nút bên dưới. Mỗi bước là một hành động trong kịch bản của bạn.
                  </p>
                  <Button onClick={() => setCreateTaskOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Thêm bước đầu tiên
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </main>

        <aside className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l p-6 flex flex-col shrink-0">
          <h3 className="text-lg font-semibold mb-4">Các loại bước</h3>
          <div className="space-y-3 flex-grow overflow-y-auto">
            {Object.entries(taskTypeDetails).filter(([key]) => key !== 'DEFAULT').map(([type, details]) => {
              const Icon = details.icon;
              return (
                <Card key={type} className="p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 text-primary p-2 rounded-lg">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{details.name}</p>
                      <p className="text-xs text-muted-foreground">{details.description}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
          <div className="mt-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white" disabled={runScenarioMutation.isPending || !scenarioTasks.some(t => t.status === 'pending')}>
                  <Play className="mr-2 h-4 w-4" /> Thực hiện Kịch bản
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72">
                {areExtensionsLoading ? (
                  <DropdownMenuItem disabled>Đang tải Extensions...</DropdownMenuItem>
                ) : extensions && extensions.length > 0 ? (
                  extensions.map((ext) => (
                    <DropdownMenuItem key={ext.id} onClick={() => runScenarioMutation.mutate({ extensionId: ext.id })}>
                      <Plug className="mr-2 h-4 w-4" /> Gửi đến "{ext.name}"
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/extensions">Chưa có Extension. Thêm ngay.</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      </div>

      {projectId && <CreateTaskDialog isOpen={isCreateTaskOpen} onOpenChange={setCreateTaskOpen} projectId={projectId} taskCount={tasks?.length || 0} />}
      <EditTaskDialog isOpen={isEditTaskOpen} onOpenChange={setEditTaskOpen} task={selectedTask as any} projectId={projectId} />
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