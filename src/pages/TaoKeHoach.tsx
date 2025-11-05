import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { Link, useNavigate } from "react-router-dom";

// UI Components
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PlanCard } from "@/components/content/PlanCard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Icons
import { Plus, AlertCircle, ClipboardList, Loader2 } from "lucide-react";

// Type Definitions
import { ContentPlanWithKoc } from "@/types/contentPlan";
import { showSuccess, showError } from "@/utils/toast";

const TaoKeHoach = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [planToDelete, setPlanToDelete] = useState<ContentPlanWithKoc | null>(null);

  const { data: plans = [], isLoading, isError, error } = useQuery<ContentPlanWithKoc[]>({
    queryKey: ["content_plans", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("content_plans")
        .select("*, kocs(name, avatar_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.from("content_plans").delete().eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa kế hoạch thành công!");
      queryClient.invalidateQueries({ queryKey: ["content_plans", user?.id] });
      setPlanToDelete(null);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
      setPlanToDelete(null);
    },
  });

  const handleEdit = (plan: ContentPlanWithKoc) => {
    navigate(`/tao-ke-hoach/${plan.id}`);
  };

  const handleDelete = (plan: ContentPlanWithKoc) => {
    setPlanToDelete(plan);
  };

  const confirmDelete = () => {
    if (planToDelete) {
      deletePlanMutation.mutate(planToDelete.id);
    }
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Lên Kế Hoạch Nội Dung</h1>
            <p className="text-muted-foreground mt-1">Xây dựng chiến lược và định hướng nội dung cho kênh KOC của bạn.</p>
          </div>
          <Button asChild className="bg-red-600 hover:bg-red-700 text-white w-full md:w-auto">
            <Link to="/tao-ke-hoach/new">
              <Plus className="mr-2 h-4 w-4" /> Tạo kế hoạch mới
            </Link>
          </Button>
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

        {!isLoading && !isError && plans.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {!isLoading && !isError && plans.length === 0 && (
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
            <AlertDialogAction onClick={confirmDelete} disabled={deletePlanMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletePlanMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xóa...</> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TaoKeHoach;