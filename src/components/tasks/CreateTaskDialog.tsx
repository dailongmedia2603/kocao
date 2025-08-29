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

type CreateTaskDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  projectId: string;
};

export const CreateTaskDialog = ({
  isOpen,
  onOpenChange,
  projectId,
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
      
      // Parse payload into a JSON object
      const payloadData = values.payload ? { data: values.payload.split('\n').filter(line => line.trim() !== '') } : null;

      const { error } = await supabase.from("tasks").insert([
        {
          name: values.name,
          type: values.type,
          payload: payloadData,
          project_id: projectId,
          user_id: user.id,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Tạo tác vụ thành công!");
      // No need to invalidate here, realtime will handle it
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thêm tác vụ mới</DialogTitle>
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
                    <Input placeholder="Ví dụ: Bình luận bài viết nhóm A" {...field} />
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn một loại tác vụ" />
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
                      placeholder="Nhập dữ liệu, mỗi dòng một mục (ví dụ: nội dung các bình luận)"
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
              <Button type="submit" disabled={createTaskMutation.isPending}>
                {createTaskMutation.isPending ? "Đang thêm..." : "Thêm tác vụ"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};