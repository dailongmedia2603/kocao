import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  FormDescription,
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
  name: z.string().min(1, "Tên bước không được để trống"),
  type: z.string().min(1, "Vui lòng chọn loại hành động"),
  url: z.string().url("Vui lòng nhập URL hợp lệ").optional().or(z.literal('')),
  formInputs: z.string().optional(),
  submitSelector: z.string().optional(),
});

type Task = {
  id: string;
  name: string;
  type: string;
  payload: any;
};

type EditTaskDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  task: Task | null;
  projectId?: string;
};

export const EditTaskDialog = ({
  isOpen,
  onOpenChange,
  task,
  projectId,
}: EditTaskDialogProps) => {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (task) {
      form.reset({
        name: task.name,
        type: task.type,
        url: task.payload?.url || "",
        formInputs: task.payload?.inputs ? JSON.stringify(task.payload.inputs, null, 2) : "[]",
        submitSelector: task.payload?.submitButton || "",
      });
    }
  }, [task, form]);

  const editTaskMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!task) throw new Error("No task selected");

      let payloadData: any = {};
      if (values.type === "NAVIGATE_TO_URL") {
        if (!values.url) {
          throw new Error("Vui lòng nhập URL cho hành động điều hướng.");
        }
        payloadData = { url: values.url };
      } else if (values.type === "FORM_FILL_AND_SUBMIT") {
        try {
          const inputs = values.formInputs ? JSON.parse(values.formInputs) : [];
          if (!Array.isArray(inputs)) throw new Error("Inputs phải là một mảng JSON.");
          if (!values.submitSelector) throw new Error("Vui lòng nhập CSS Selector cho nút gửi.");
          payloadData = {
            inputs: inputs,
            submitButton: values.submitSelector,
          };
        } catch (e: any) {
          showError(`Lỗi dữ liệu payload: ${e.message}`);
          throw e;
        }
      }

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
      showSuccess("Cập nhật bước thành công!");
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      }
      onOpenChange(false);
    },
    onError: (error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    editTaskMutation.mutate(values);
  };

  const selectedType = form.watch("type");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa bước</DialogTitle>
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
                  <FormLabel>Loại hành động</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="NAVIGATE_TO_URL">Điều hướng đến URL</SelectItem>
                      <SelectItem value="FORM_FILL_AND_SUBMIT">Điền và Gửi Form</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedType === "NAVIGATE_TO_URL" && (
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Đích</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {selectedType === "FORM_FILL_AND_SUBMIT" && (
              <>
                <FormField
                  control={form.control}
                  name="formInputs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dữ liệu Inputs (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          className="resize-none h-24 font-mono"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Một mảng JSON. Để trống `[]` nếu không cần điền form.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="submitSelector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CSS Selector của nút Gửi/Bấm</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormDescription>
                        Selector của nút để bấm sau khi điền form (hoặc để bấm ngay).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
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