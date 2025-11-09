import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { SubscriptionPlan } from "./SubscriptionPlans";

const formSchema = z.object({
  name: z.string().min(1, "Tên gói không được để trống"),
  description: z.string().optional(),
  monthly_video_limit: z.coerce.number().min(0, "Giới hạn phải là số không âm"),
  price: z.coerce.number().min(0, "Giá phải là số không âm"),
  is_active: z.boolean().default(true),
});

type AddEditPlanDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  plan: SubscriptionPlan | null;
};

export const AddEditPlanDialog = ({ isOpen, onOpenChange, plan }: AddEditPlanDialogProps) => {
  const queryClient = useQueryClient();
  const isEditMode = !!plan;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      monthly_video_limit: 0,
      price: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (plan) {
        form.reset(plan);
      } else {
        form.reset({ name: "", description: "", monthly_video_limit: 0, price: 0, is_active: true });
      }
    }
  }, [plan, form, isOpen]);

  const upsertMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const payload = { ...values, id: plan?.id };
      const { error } = await supabase.from("subscription_plans").upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(isEditMode ? "Cập nhật gói cước thành công!" : "Tạo gói cước thành công!");
      queryClient.invalidateQueries({ queryKey: ["subscription_plans"] });
      onOpenChange(false);
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    upsertMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Chỉnh sửa Gói cước" : "Tạo Gói cước mới"}</DialogTitle>
          <DialogDescription>Điền thông tin chi tiết cho gói cước.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Tên gói</FormLabel><FormControl><Input placeholder="Ví dụ: Gói Cơ bản" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Mô tả</FormLabel><FormControl><Textarea placeholder="Mô tả ngắn về gói cước..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="monthly_video_limit" render={({ field }) => (<FormItem><FormLabel>Giới hạn Video/Tháng</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="price" render={({ field }) => (<FormItem><FormLabel>Giá (VND)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="is_active" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Kích hoạt</FormLabel><FormDescription>Gói cước này có thể được gán cho người dùng.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...</> : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};