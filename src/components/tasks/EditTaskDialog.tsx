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
  name: z.string().min(1, "Tên tác vụ không được để trống"),
  type: z.string().min(1, "Vui lòng chọn loại tác vụ"),
  url: z.string().url("Vui lòng nhập URL hợp lệ").optional().or(z.literal('')),
  formInputs: z.string().optional(),
  submitSelector: z.string().optional(),
  inputSelector: z.string().optional(),
  fileName: z.string().optional(),
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
  projectId: string;
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
    defaultValues: {
      name: "",
      type: "",
      url: "",
      formInputs: "",
      submitSelector: "",
      inputSelector: "",
      fileName: "",
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        name: task.name,
        type: task.type,
        url: task.payload?.url || "",
        formInputs: task.type === 'FORM_FILL_AND_SUBMIT' ? JSON.stringify(task.payload.inputs || [], null, 2) : "",
        submitSelector: task.payload?.submitButton || "",
        inputSelector: task.payload?.inputSelector || "",
        fileName: task.payload?.fileName || "",
      });
    }
  }, [task, form]);

  const editTaskMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!task) throw new Error("No task selected");

      let payloadData = { ...task.payload };
      payloadData.url = values.url;
      payloadData.submitButton = values.submitSelector;

      if (values.type === "FORM_FILL_AND_SUBMIT") {
        payloadData.inputs = JSON.parse(values.formInputs || "[]");
      } else if (values.type === "FILE_UPLOAD_AND_SUBMIT") {
        payloadData.inputSelector = values.inputSelector;
      }

      const { error } = await supabase
        .from("tasks")
        .update({ name: values.name, type: values.type, payload: payloadData })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cập nhật tác vụ thành công!");
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa tác vụ</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Tên tác vụ</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="type" render={({ field }) => ( <FormItem> <FormLabel>Loại tác vụ</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl> <SelectTrigger><SelectValue placeholder="Chọn một loại tác vụ" /></SelectTrigger> </FormControl> <SelectContent> <SelectItem value="FORM_FILL_AND_SUBMIT">Điều hướng, Điền và Gửi Form</SelectItem> <SelectItem value="FILE_UPLOAD_AND_SUBMIT">Tải tệp lên & Gửi</SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem> )}/>
            
            {selectedType === "FORM_FILL_AND_SUBMIT" && (
              <>
                <FormField control={form.control} name="url" render={({ field }) => ( <FormItem> <FormLabel>URL đích</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="formInputs" render={({ field }) => ( <FormItem> <FormLabel>Dữ liệu Inputs (JSON)</FormLabel> <FormControl><Textarea className="resize-none h-24 font-mono" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="submitSelector" render={({ field }) => ( <FormItem> <FormLabel>CSS Selector của nút Gửi</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
              </>
            )}

            {selectedType === "FILE_UPLOAD_AND_SUBMIT" && (
              <>
                <FormField control={form.control} name="url" render={({ field }) => ( <FormItem> <FormLabel>URL trang tải lên</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="fileName" render={({ field }) => ( <FormItem> <FormLabel>Tệp đã tải lên</FormLabel> <FormControl><Input {...field} readOnly disabled /></FormControl> <FormDescription>Không thể thay đổi tệp khi chỉnh sửa.</FormDescription> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="inputSelector" render={({ field }) => ( <FormItem> <FormLabel>CSS Selector của ô chọn tệp</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="submitSelector" render={({ field }) => ( <FormItem> <FormLabel>CSS Selector của nút Gửi</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
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