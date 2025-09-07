import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  name: z.string().min(1, "Tên không được để trống"),
  group_id: z.string().min(1, "Group ID không được để trống"),
  api_key: z.string().min(1, "API Key không được để trống"),
});

type AddMinimaxCredentialsDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const AddMinimaxCredentialsDialog = ({ isOpen, onOpenChange }: AddMinimaxCredentialsDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", group_id: "", api_key: "" },
  });

  const addKeyMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from("user_minimax_credentials")
        .insert({ user_id: user.id, name: values.name, group_id: values.group_id, api_key: values.api_key });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Thêm thông tin thành công!");
      queryClient.invalidateQueries({ queryKey: ["minimax_credentials", user?.id] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => addKeyMutation.mutate(values);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm thông tin API Minimax</DialogTitle>
          <DialogDescription>Nhập Group ID và API Key của bạn từ Minimax.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Tên gợi nhớ</FormLabel><FormControl><Input placeholder="Ví dụ: Key dự án A" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="group_id" render={({ field }) => (
              <FormItem><FormLabel>Group ID</FormLabel><FormControl><Input placeholder="Dán Group ID của bạn" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="api_key" render={({ field }) => (
              <FormItem><FormLabel>API Key</FormLabel><FormControl><Input placeholder="Dán API Key của bạn" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={addKeyMutation.isPending}>{addKeyMutation.isPending ? "Đang thêm..." : "Thêm"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};