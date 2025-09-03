import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskStep } from "@/components/tasks/TaskStep";
import { Play, Plus, ChevronRight } from "lucide-react";

type Task = {
  id: string;
  name: string;
  status: 'completed' | 'failed' | 'running' | 'queued' | 'pending' | string;
  type: string | null;
  error_log: string | null;
  payload: any;
};

type Project = {
  id: string;
  name: string;
  tasks: Task[];
};

const fetchProjectDetails = async (projectId: string | undefined) => {
  if (!projectId) throw new Error("Project ID is required");
  const { data, error } = await supabase
    .from("projects")
    .select("*, tasks(*)")
    .eq("id", projectId)
    .order("execution_order", { foreignTable: "tasks", ascending: true })
    .single();

  if (error) throw error;
  return data as Project;
};

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();

  const {
    data: project,
    isLoading,
    isError,
    error,
  } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => fetchProjectDetails(id),
  });

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="mt-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-x-4 mb-8">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-grow">
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (isError) {
      return <div className="text-red-500 mt-8">Lỗi tải dự án: {error.message}</div>;
    }

    if (!project || project.tasks.length === 0) {
      return (
        <div className="text-center py-16 border-2 border-dashed rounded-lg mt-8">
          <h3 className="text-xl font-semibold text-gray-700">
            Quy trình này chưa có bước nào
          </h3>
          <p className="text-gray-500 mt-2 mb-4">
            Bắt đầu bằng cách thêm bước đầu tiên cho quy trình của bạn.
          </p>
          <Button className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Thêm bước mới
          </Button>
        </div>
      );
    }

    return (
      <div className="mt-8">
        {project.tasks.map((task, index) => (
          <TaskStep
            key={task.id}
            task={task}
            isLast={index === project.tasks.length - 1}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <div className="flex items-center text-sm text-gray-500 mb-1">
            <span>Dự án</span>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="font-medium text-gray-700">{project?.name || 'Đang tải...'}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">
            {project?.name || <Skeleton className="h-9 w-64" />}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-white">
            <Plus className="h-4 w-4 mr-2" />
            Thêm bước
          </Button>
          <Button className="bg-red-600 hover:bg-red-700 text-white">
            <Play className="h-4 w-4 mr-2" />
            Chạy quy trình
          </Button>
        </div>
      </header>

      <main>
        {renderContent()}
      </main>
    </div>
  );
};

export default ProjectDetail;