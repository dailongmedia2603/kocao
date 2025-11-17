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
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Tên không được để trống"),
  credentials: z.string().refine((val) => {
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === 'object' && parsed !== null && 'project_id' in parsed;
    } catch (e) {
      return false;
    }
  }, { message: "Nội dung credentials phải là một chuỗi JSON hợp lệ và chứa 'project_id'." }),
});

type AddVertexAiDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const AddVertexAiDialog = ({ isOpen, onOpenChange }: AddVertexAiDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", credentials: "" },
  });

  const addKeyMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from("user_vertex_ai_credentials")
        .insert({ 
            user_id: user.id, 
            name: values.name, 
            credentials: JSON.parse(values.credentials),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Thêm thông tin xác thực Vertex AI thành công!");
      queryClient.invalidateQueries({ queryKey: ["vertex_ai_credentials", user?.id] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => addKeyMutation.mutate(values);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Thêm thông tin xác thực Vertex AI</DialogTitle>
          <DialogDescription>Dán nội dung file JSON của Service Account từ Google Cloud.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Tên gợi nhớ</FormLabel><FormControl><Input placeholder="Ví dụ: Key dự án KOC" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="credentials" render={({ field }) => (
              <FormItem><FormLabel>Nội dung file JSON</FormLabel><FormControl><Textarea placeholder='{ "type": "service_account", "project_id": "...", ... }' className="h-48 font-mono text-xs" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={addKeyMutation.isPending}>
                {addKeyMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang thêm...</> : "Thêm"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};