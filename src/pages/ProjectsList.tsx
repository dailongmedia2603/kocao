import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Filter,
  Search,
  List,
  LayoutGrid,
  Plus,
  Upload,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { EditProjectDialog } from "@/components/projects/EditProjectDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccess, showError } from "@/utils/toast";
import { ProjectCard } from "@/components/projects/ProjectCard";

type Profile = {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type Project = {
  id: string;
  name: string;
  created_at: string;
  profiles: Profile | null;
  tasks: { count: number }[];
};

const fetchProjects = async () => {
  const { data, error } = await supabase
    .from("projects")
    .select("*, profiles!user_id(*), tasks(count)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Project[];
};

const ProjectsList = () => {
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const queryClient = useQueryClient();

  const {
    data: projects,
    isLoading,
    isError,
    error,
  } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa dự án thành công!");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDeleteDialogOpen(false);
      setSelectedProject(null);
    },
    onError: (error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const handleDeleteProject = () => {
    if (selectedProject) {
      deleteProjectMutation.mutate(selectedProject.id);
    }
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-800">Dự án</h1>
              {!isLoading && (
                <Badge className="bg-red-100 text-red-600 px-2.5 py-0.5 text-sm font-semibold">
                  {projects?.length || 0}
                </Badge>
              )}
            </div>
            <div className="flex items-center text-sm text-gray-500 mt-1">
              <span>Home</span>
              <ChevronRight className="h-4 w-4 mx-1" />
              <span className="font-medium text-gray-700">Dự án</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-white">
              <Upload className="h-4 w-4 mr-2" />
              Xuất file
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="bg-white"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["projects"] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap justify-between items-center gap-4 mb-6 p-4 bg-white rounded-lg border">
          <div className="flex items-center gap-4">
            <Button variant="outline" className="bg-white">
              <Filter className="h-4 w-4 mr-2" />
              Lọc
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Tìm kiếm" className="pl-9" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <List className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 bg-gray-100">
                <LayoutGrid className="h-5 w-5" />
              </Button>
            </div>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Thêm dự án mới
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-red-500">Lỗi tải dự án: {error.message}</div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => {
                  setSelectedProject(project);
                  setEditDialogOpen(true);
                }}
                onDelete={() => {
                  setSelectedProject(project);
                  setDeleteDialogOpen(true);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h3 className="text-xl font-semibold text-gray-700">
              Chưa có dự án nào
            </h3>
            <p className="text-gray-500 mt-2 mb-4">
              Bắt đầu bằng cách tạo dự án đầu tiên của bạn.
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tạo dự án mới
            </Button>
          </div>
        )}
      </div>
      <CreateProjectDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      <EditProjectDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setEditDialogOpen}
        project={selectedProject}
      />
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Thao tác này sẽ xóa vĩnh viễn
              dự án "{selectedProject?.name}" và tất cả các bước liên quan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProjectsList;