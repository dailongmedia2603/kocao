import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  name: z.string().min(1, "Tên bước không được để trống"),
  type: z.string().optional(),
  payload: z.string().refine((val) => {
    if (!val || val.trim() === "") return true;
    try {
      JSON.parse(val);
      return true;
    } catch (e) {
      return false;
    }
  }, { message: "Payload phải là một chuỗi JSON hợp lệ" }).optional(),
});

type CreateTaskDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  projectId: string;
  taskCount: number;
};

export const CreateTaskDialog = ({
  isOpen,
  onOpenChange,
  projectId,
  taskCount,
}: CreateTaskDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "",
      payload: "",
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");

      const execution_order = taskCount + 1;

      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          name: values.name,
          type: values.type || null,
          payload: values.payload ? JSON.parse(values.payload) : null,
          project_id: projectId,
          user_id: user.id,
          status: 'pending',
          execution_order: execution_order,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      showSuccess("Thêm bước thành công!");
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createTaskMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Thêm bước mới</DialogTitle>
          <DialogDescription>
            Cấu hình một bước mới cho quy trình tự động của bạn.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên bước</FormLabel>
                  <FormControl>
                    <Input placeholder="Ví dụ: Lấy dữ liệu từ API" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loại bước (Tùy chọn)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ví dụ: data_extraction" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payload"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payload (JSON, Tùy chọn)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='{ "key": "value" }'
                      className="font-mono"
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={createTaskMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {createTaskMutation.isPending ? "Đang thêm..." : "Thêm bước"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};