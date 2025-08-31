import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { PlusCircle, ArrowLeft, MoreHorizontal } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
};

const getTaskTypeName = (type: string) => {
  switch (type) {
    case "FORM_FILL_AND_SUBMIT":
      return "Điền và gửi Form";
    case "comment":
      return "Đăng bình luận";
    case "like":
      return "Thích bài viết";
    case "share":
      return "Chia sẻ bài viết";
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
      const { data, error } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .single();
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
        .select("id, name, type, status, created_at, payload")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa tác vụ thành công!");
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "running":
        return "default";
      case "failed":
        return "destructive";
      case "pending":
      default:
        return "secondary";
    }
  };

  const handleDeleteTask = () => {
    if (selectedTask) {
      deleteTaskMutation.mutate(selectedTask.id);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            to="/projects"
            className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại danh sách dự án
          </Link>
          {isProjectLoading ? (
            <Skeleton className="h-8 w-64" />
          ) : (
            <h1 className="text-3xl font-bold">{project?.name}</h1>
          )}
          <p className="text-muted-foreground">
            Quản lý và theo dõi các tác vụ trong dự án này.
          </p>
        </div>
        <Button onClick={() => setCreateTaskOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Thêm tác vụ mới
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Danh sách tác vụ</CardTitle>
          <CardDescription>
            Trạng thái tác vụ sẽ được cập nhật tự động.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên tác vụ</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areTasksLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : tasks && tasks.length > 0 ? (
                tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>{getTaskTypeName(task.type)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(task.status) as any}>
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(task.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Mở menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedTask(task);
                              setEditTaskOpen(true);
                            }}
                          >
                            Sửa
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-500"
                            onClick={() => {
                              setSelectedTask(task);
                              setDeleteTaskOpen(true);
                            }}
                          >
                            Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Chưa có tác vụ nào trong dự án này.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {projectId && (
        <CreateTaskDialog
          isOpen={isCreateTaskOpen}
          onOpenChange={setCreateTaskOpen}
          projectId={projectId}
        />
      )}
      <EditTaskDialog
        isOpen={isEditTaskOpen}
        onOpenChange={setEditTaskOpen}
        task={selectedTask}
      />
      <AlertDialog
        open={isDeleteTaskOpen}
        onOpenChange={setDeleteTaskOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Thao tác này sẽ xóa vĩnh viễn
              tác vụ "{selectedTask?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTaskMutation.isPending}
            >
              {deleteTaskMutation.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProjectDetails;