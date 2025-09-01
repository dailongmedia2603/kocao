import { useState, useEffect, Fragment } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlusCircle, ArrowLeft, MoreHorizontal, Play, ArrowDown } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateTaskDialog } from "../components/tasks/CreateTaskDialog";
import { EditTaskDialog } from "../components/tasks/EditTaskDialog";

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
};

const getTaskTypeName = (type: string) => {
  switch (type) {
    case "NAVIGATE_TO_URL":
      return "Điều hướng đến URL";
    case "FORM_FILL_AND_SUBMIT":
      return "Điền và Gửi Form";
    default:
      return type;
  }
};

const ProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
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

  const queueNextTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").update({ status: "queued" }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Bước tiếp theo đã được gửi đi!");
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (error: Error) => {
      showError(`Lỗi khi gửi bước tiếp theo: ${error.message}`);
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
      .channel(`tasks-project-${projectId}`)
      .on<Task>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
          const updatedTask = payload.new;
          const oldTask = payload.old;
          if (updatedTask.status === 'completed' && oldTask.status !== 'completed') {
            const currentOrder = updatedTask.execution_order;
            if (typeof currentOrder === 'number') {
              const nextTask = tasks?.find(t => t.execution_order === currentOrder + 1);
              if (nextTask && nextTask.status === 'pending') {
                queueNextTaskMutation.mutate(nextTask.id);
              }
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, queryClient, tasks, queueNextTaskMutation]);

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed": return "secondary";
      case "running": case "queued": return "default";
      case "failed": return "destructive";
      case "pending": default: return "outline";
    }
  };

  const handleDeleteTask = () => {
    if (selectedTask) deleteTaskMutation.mutate(selectedTask.id);
  };

  const scenarioTasks = tasks?.filter(t => t.execution_order !== null) || [];

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link to="/projects" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách dự án
          </Link>
          {isProjectLoading ? <Skeleton className="h-8 w-64" /> : <h1 className="text-3xl font-bold">{project?.name}</h1>}
          <p className="text-muted-foreground">Xây dựng và quản lý kịch bản tự động hóa của bạn.</p>
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
      
      <Card>
        <CardHeader>
          <CardTitle>Kịch bản tự động</CardTitle>
          <CardDescription>Các bước sẽ được thực hiện tuần tự từ trên xuống dưới.</CardDescription>
        </CardHeader>
        <CardContent>
          {areTasksLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : scenarioTasks.length > 0 ? (
            <div className="flex flex-col items-center -mb-4">
              {scenarioTasks.map((task, index) => (
                <Fragment key={task.id}>
                  <Card className="w-full max-w-3xl z-10 shadow-sm">
                    <CardHeader className="flex flex-row items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                           <Badge variant="secondary" className="text-lg">{task.execution_order}</Badge>
                           <CardTitle className="text-lg">{task.name}</CardTitle>
                        </div>
                        <CardDescription className="mt-1 ml-10">{getTaskTypeName(task.type)}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedTask(task); setEditTaskOpen(true); }}>Sửa</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-500" onClick={() => { setSelectedTask(task); setDeleteTaskOpen(true); }}>Xóa</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardFooter>
                       <Badge variant={getStatusVariant(task.status)}>{task.status}</Badge>
                    </CardFooter>
                  </Card>
                  {index < scenarioTasks.length - 1 && (
                    <div className="h-10 w-0.5 bg-border -my-2 flex items-center justify-center">
                      <ArrowDown className="h-5 w-5 text-border" />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">Chưa có bước nào trong kịch bản này.</p>
              <Button onClick={() => setCreateTaskOpen(true)} className="mt-4">Bắt đầu bằng cách thêm bước đầu tiên</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {projectId && <CreateTaskDialog isOpen={isCreateTaskOpen} onOpenChange={setCreateTaskOpen} projectId={projectId} />}
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

export default ProjectDetails;