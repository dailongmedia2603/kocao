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
  api_key: z.string().min(10, "API Key không hợp lệ"),
});

type AddVoiceApiKeyDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const AddVoiceApiKeyDialog = ({ isOpen, onOpenChange }: AddVoiceApiKeyDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", api_key: "" },
  });

  const addKeyMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from("user_voice_api_keys")
        .insert({ user_id: user.id, name: values.name, api_key: values.api_key });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Thêm API Key thành công!");
      queryClient.invalidateQueries({ queryKey: ["voice_api_keys", user?.id] });
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
          <DialogTitle>Thêm API Key GenAIPro Voice</DialogTitle>
          <DialogDescription>Nhập API Key bạn nhận được từ Vivoo.work.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Tên gợi nhớ</FormLabel><FormControl><Input placeholder="Ví dụ: Key dự án B" {...field} /></FormControl><FormMessage /></FormItem>
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