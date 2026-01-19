import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionContext";
import { Link, useNavigate } from "react-router-dom";
import { api, ContentPlan, Koc } from "@/lib/apiClient";

// UI Components
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlanCard } from "@/components/content/PlanCard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { showSuccess, showError } from "@/utils/toast";
import { ConfigurePromptDialog } from "@/components/content/ConfigurePromptDialog";

// Icons
import { Plus, AlertCircle, ClipboardList, Loader2, Settings } from "lucide-react";

// Type Definitions
import { ContentPlanWithKoc } from "@/types/contentPlan";

const TaoKeHoach = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [planToDelete, setPlanToDelete] = useState<ContentPlanWithKoc | null>(null);
  const [isConfigureOpen, setIsConfigureOpen] = useState(false);

  const { data: kocs = [] } = useQuery<Koc[]>({
    queryKey: ['kocs_for_plans', user?.id],
    queryFn: () => api.kocs.list(),
    enabled: !!user,
  });

  const { data: rawPlans = [], isLoading, isError, error } = useQuery<ContentPlan[]>({
    queryKey: ["content_plans", user?.id],
    queryFn: () => api.contentPlan.list(),
    enabled: !!user,
  });

  const mappedPlans = useMemo(() => {
    return rawPlans.map(plan => {
      const kocId = plan.content?.kocId || plan.content?.koc_id; // Flexible key name
      const koc = kocs.find(k => k.id === kocId);
      return {
        id: plan.id,
        name: plan.name,
        status: plan.status,
        created_at: plan.created_at,
        inputs: plan.content?.inputs || null,
        results: plan.content?.results || null,
        koc_id: kocId || '',
        kocs: koc ? { name: koc.name, avatar_url: koc.avatar_url } : null
      } as ContentPlanWithKoc;
    });
  }, [rawPlans, kocs]);

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await api.contentPlan.delete(planId);
    },
    onSuccess: () => {
      showSuccess("Xóa kế hoạch thành công!");
      queryClient.invalidateQueries({ queryKey: ['content_plans', user?.id] });
      setPlanToDelete(null);
    },
    onError: (error: Error) => {
      showError(`Lỗi xóa kế hoạch: ${error.message}`);
    }
  });

  const handleEdit = (plan: ContentPlanWithKoc) => {
    navigate(`/tao-ke-hoach/${plan.id}`);
  };

  const handleDelete = (plan: ContentPlanWithKoc) => {
    setPlanToDelete(plan);
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Lên Kế Hoạch Nội Dung</h1>
            <p className="text-muted-foreground mt-1">Xây dựng chiến lược và định hướng nội dung cho kênh KOC của bạn.</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={() => setIsConfigureOpen(true)}>
              <Settings className="mr-2 h-4 w-4" /> Cấu hình prompt
            </Button>
            <Button asChild className="bg-red-600 hover:bg-red-700 text-white">
              <Link to="/tao-ke-hoach/new">
                <Plus className="mr-2 h-4 w-4" /> Tạo kế hoạch mới
              </Link>
            </Button>
          </div>
        </header>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Lỗi</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && mappedPlans.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mappedPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {!isLoading && !isError && mappedPlans.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-semibold">Chưa có kế hoạch nào</h3>
            <p className="text-muted-foreground mt-2 mb-4">Hãy tạo kế hoạch nội dung đầu tiên của bạn.</p>
            <Button asChild className="bg-red-600 hover:bg-red-700 text-white">
              <Link to="/tao-ke-hoach/new">
                <Plus className="mr-2 h-4 w-4" /> Tạo kế hoạch mới
              </Link>
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={!!planToDelete} onOpenChange={() => setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Kế hoạch "{planToDelete?.name}" sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => planToDelete && deletePlanMutation.mutate(planToDelete.id)}
              disabled={deletePlanMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletePlanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfigurePromptDialog isOpen={isConfigureOpen} onOpenChange={setIsConfigureOpen} />
    </>
  );
};

export default TaoKeHoach;