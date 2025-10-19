import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, AlertCircle, Video } from "lucide-react";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { ProjectCard } from "@/components/projects/ProjectCard";

export type Project = {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  tasks: { count: number }[];
};

const ProjectsList = () => {
  const { user } = useSession();
  const [isCreateOpen, setCreateOpen] = useState(false);

  const { data: projects, isLoading, isError, error } = useQuery<Project[]>({
    queryKey: ["projects", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc("get_projects_for_user");
      if (error) throw new Error(error.message);
      return data as Project[];
    },
    enabled: !!user,
  });

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Dự án</h1>
            <p className="text-muted-foreground mt-1">Quản lý tất cả các dự án và kịch bản của bạn.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Tạo dự án mới
          </Button>
        </header>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Lỗi</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && projects && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
          </div>
        )}

        {!isLoading && !isError && projects && projects.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Video className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="text-xl font-semibold mt-4">Chưa có dự án nào</h3>
            <p className="text-muted-foreground mt-2 mb-4">Hãy tạo dự án đầu tiên của bạn để bắt đầu.</p>
            <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> Tạo dự án mới
            </Button>
          </div>
        )}
      </div>
      <CreateProjectDialog isOpen={isCreateOpen} onOpenChange={setCreateOpen} />
    </>
  );
};

export default ProjectsList;