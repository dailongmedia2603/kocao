import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

// UI Components
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AddEditPlanDialog } from "./AddEditPlanDialog";

// Icons
import { Plus, MoreHorizontal, Trash2, Edit, Loader2 } from "lucide-react";

// Utils
import { showSuccess, showError } from "@/utils/toast";

// Type
export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string | null;
  monthly_video_limit: number;
  monthly_voice_limit: number;
  price: number;
  is_active: boolean;
  created_at: string;
};

const SubscriptionPlans = () => {
  const [isAddEditOpen, setAddEditOpen] = useState(false);
  const [planToEdit, setPlanToEdit] = useState<SubscriptionPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null);
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["subscription_plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_plans").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.from("subscription_plans").delete().eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa gói cước thành công!");
      queryClient.invalidateQueries({ queryKey: ["subscription_plans"] });
      setPlanToDelete(null);
    },
    onError: (error: Error) => showError(error.message),
  });

  const handleAddNew = () => {
    setPlanToEdit(null);
    setAddEditOpen(true);
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setPlanToEdit(plan);
    setAddEditOpen(true);
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Quản lý Gói cước</h1>
            <p className="text-muted-foreground mt-1">Tạo và quản lý các gói đăng ký cho người dùng.</p>
          </div>
          <Button onClick={handleAddNew} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Tạo gói mới
          </Button>
        </header>

        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên gói</TableHead>
                <TableHead>Giới hạn Video/Tháng</TableHead>
                <TableHead>Giới hạn Voice/Tháng</TableHead>
                <TableHead>Giá</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : plans.length > 0 ? (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>{plan.monthly_video_limit}</TableCell>
                    <TableCell>{plan.monthly_voice_limit}</TableCell>
                    <TableCell>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(plan.price)}</TableCell>
                    <TableCell>
                      <Badge variant={plan.is_active ? "default" : "outline"} className={plan.is_active ? "bg-green-100 text-green-800" : ""}>
                        {plan.is_active ? "Hoạt động" : "Không hoạt động"}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(plan.created_at), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(plan)}><Edit className="mr-2 h-4 w-4" /> Sửa</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setPlanToDelete(plan)}><Trash2 className="mr-2 h-4 w-4" /> Xóa</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">Chưa có gói cước nào.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddEditPlanDialog isOpen={isAddEditOpen} onOpenChange={setAddEditOpen} plan={planToEdit} />

      <AlertDialog open={!!planToDelete} onOpenChange={() => setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác. Gói cước "{planToDelete?.name}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => planToDelete && deletePlanMutation.mutate(planToDelete.id)} disabled={deletePlanMutation.isPending} className="bg-destructive hover:bg-destructive/90">
              {deletePlanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SubscriptionPlans;