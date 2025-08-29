import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { PlusCircle, ArrowLeft } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateTaskDialog } from "../components/tasks/CreateTaskDialog";

type Project = {
  name: string;
};

type Task = {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
};

const ProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [isCreateTaskOpen, setCreateTaskOpen] = useState(false);
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
        .select("id, name, type, status, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
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
        (payload) => {
          console.log("Change received!", payload);
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

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link to="/projects" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
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
                  </TableRow>
                ))
              ) : tasks && tasks.length > 0 ? (
                tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>{task.type}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(task.status) as any}>
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(task.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
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
    </>
  );
};

export default ProjectDetails;