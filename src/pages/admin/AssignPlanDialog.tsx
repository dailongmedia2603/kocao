import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { SubscriptionPlan } from "./SubscriptionPlans";

type UserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  subscription_plan_id: string | null;
};

type AssignPlanDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: UserProfile | null;
};

const formSchema = z.object({
  plan_id: z.string().nullable(),
});

export const AssignPlanDialog = ({ isOpen, onOpenChange, user }: AssignPlanDialogProps) => {
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading: isLoadingPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["subscription_plans_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_plans").select("*").eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { plan_id: null },
  });

  useEffect(() => {
    if (user) {
      form.reset({ plan_id: user.subscription_plan_id || null });
    }
  }, [user, form]);

  const assignPlanMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("Không có người dùng nào được chọn");

      if (!values.plan_id) {
        const { error } = await supabase.from('user_subscriptions').delete().eq('user_id', user.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('user_subscriptions').upsert({
        user_id: user.id,
        plan_id: values.plan_id,
        status: 'active',
        current_period_videos_used: 0, // Reset khi gán gói mới
      }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Gán gói cước thành công!");
      queryClient.invalidateQueries({ queryKey: ["all_users"] });
      onOpenChange(false);
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    assignPlanMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gán gói cước</DialogTitle>
          <DialogDescription>
            Chọn một gói cước để gán cho người dùng "{user?.first_name} {user?.last_name}".
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="plan_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gói cước</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={isLoadingPlans}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn một gói cước..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Không có gói nào</SelectItem>
                      {plans.map(plan => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} ({plan.monthly_video_limit} video/tháng)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={assignPlanMutation.isPending}>
                {assignPlanMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...</> : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};