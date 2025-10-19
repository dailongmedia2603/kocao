import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import ProjectDetailWorkflow from "@/components/workflow/WorkflowBuilder";

const ProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: project, isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-[calc(100vh-150px)] w-full" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <Link to="/projects" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách dự án
      </Link>
      <h1 className="text-3xl font-bold mb-4">{project?.name}</h1>
      {projectId && <ProjectDetailWorkflow projectId={projectId} />}
    </div>
  );
};

export default ProjectDetail;