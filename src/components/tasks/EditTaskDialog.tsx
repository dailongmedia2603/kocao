import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  name: z.string().min(1, "Tên tác vụ không được để trống"),
  type: z.string().min(1, "Vui lòng chọn loại tác vụ"),
  payload: z.string().optional(),
});

type Task = {
  id: string;
  name: string;
  type: string;
  payload: { data: string[] } | null;
};

type EditTaskDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  task: Task | null;
};

export const EditTaskDialog = ({
  isOpen,
  onOpenChange,
  task,
}: EditTaskDialogProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (task) {
      form.reset({
        name: task.name,
        type: task.type,
        payload: task.payload?.data?.join("\n") || "",
      });
    }
  }, [task, form]);

  const editTaskMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!task) throw new Error("No task selected");
      const payloadData = values.payload
        ? { data: values.payload.split("\n").filter((line) => line.trim() !== "") }
        : null;
      const { error } = await supabase
        .from("tasks")
        .update({
          name: values.name,
          type: values.type,
          payload: payloadData,
        })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cập nhật tác vụ thành công!");
      onOpenChange(false);
    },
    onError: (error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    editTaskMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa tác vụ</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên tác vụ</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Loại tác vụ</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="comment">Đăng bình luận</SelectItem>
                      <SelectItem value="like">Thích bài viết</SelectItem>
                      <SelectItem value="share">Chia sẻ bài viết</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payload"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dữ liệu</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Nhập dữ liệu, mỗi dòng một mục"
                      className="resize-none"
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
              <Button type="submit" disabled={editTaskMutation.isPending}>
                {editTaskMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};