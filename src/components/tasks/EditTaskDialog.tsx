import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

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
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  name: z.string().min(1, "Tên bước không được để trống"),
  type: z.string().min(1, "Vui lòng chọn loại hành động"),
  url: z.string().optional(),
  formInputs: z.string().optional(),
  submitSelector: z.string().optional(),
  inputSelector: z.string().optional(),
});

type Task = {
  id: string; name: string; type: string; payload: any;
};

type EditTaskDialogProps = {
  isOpen: boolean; onOpenChange: (isOpen: boolean) => void; task: Task | null; projectId?: string;
};

export const EditTaskDialog = ({ isOpen, onOpenChange, task, projectId }: EditTaskDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [newFile, setNewFile] = useState<File | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    if (task) {
      form.reset({
        name: task.name, type: task.type,
        url: task.payload?.url || "",
        formInputs: task.payload?.inputs ? JSON.stringify(task.payload.inputs, null, 2) : "[]",
        submitSelector: task.payload?.submitButton || "",
        inputSelector: task.payload?.inputSelector || "",
      });
      setCurrentFileName(task.payload?.fileName || null);
    }
  }, [task, form]);

  const editTaskMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!task || !user) throw new Error("Không có tác vụ hoặc người dùng");

      let toastId: string | number | undefined;
      try {
        let payloadData: any = {};
        if (values.type === "NAVIGATE_TO_URL") {
          if (!values.url || !z.string().url().safeParse(values.url).success) throw new Error("Vui lòng nhập URL hợp lệ.");
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
        } else if (values.type === "FILE_UPLOAD_AND_SUBMIT") {
          let { fileUrl, fileName, fileType } = task.payload || {};
          if (newFile) {
            toastId = showLoading("Đang tải tệp mới lên...");
            const filePath = `${user.id}/${projectId}/${Date.now()}-${newFile.name}`;
            const { error: uploadError } = await supabase.storage.from("task_files").upload(filePath, newFile);
            if (uploadError) throw new Error(`Lỗi tải tệp lên: ${uploadError.message}`);
            
            const { data: { publicUrl } } = supabase.storage.from("task_files").getPublicUrl(filePath);
            fileUrl = publicUrl;
            fileName = newFile.name;
            fileType = newFile.type;
          }
          
          if (!fileUrl) throw new Error("Không tìm thấy tệp. Vui lòng chọn một tệp mới để tải lên.");

          payloadData = {
            url: values.url, fileUrl, fileName, fileType,
            inputSelector: values.inputSelector, submitButton: values.submitSelector,
          };
        }

        const { error } = await supabase.from("tasks").update({
          name: values.name, type: values.type, payload: payloadData,
        }).eq("id", task.id);
        if (error) throw error;
      } finally {
        if (toastId) {
          dismissToast(String(toastId));
        }
      }
    },
    onSuccess: () => {
      showSuccess("Cập nhật bước thành công!");
      if (projectId) queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      onOpenChange(false);
      setNewFile(null);
    },
    onError: (error) => { showError(`Lỗi: ${error.message}`); },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => { editTaskMutation.mutate(values); };
  const selectedType = form.watch("type");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader><DialogTitle>Chỉnh sửa bước</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Tên bước</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Loại hành động</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="NAVIGATE_TO_URL">Điều hướng đến URL</SelectItem>
                    <SelectItem value="FORM_FILL_AND_SUBMIT">Điền và Gửi Form</SelectItem>
                    <SelectItem value="FILE_UPLOAD_AND_SUBMIT">Tải tệp và Gửi</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {(selectedType === "NAVIGATE_TO_URL" || selectedType === "FILE_UPLOAD_AND_SUBMIT") && (
              <FormField control={form.control} name="url" render={({ field }) => (
                <FormItem><FormLabel>URL Đích</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}

            {selectedType === "FILE_UPLOAD_AND_SUBMIT" && (
              <>
                <FormItem>
                  <FormLabel>Tệp để tải lên</FormLabel>
                  {currentFileName && !newFile && <div className="text-sm text-muted-foreground mb-2">Tệp hiện tại: <Badge variant="secondary">{currentFileName}</Badge></div>}
                  <FormControl><Input type="file" onChange={(e) => setNewFile(e.target.files?.[0] || null)} /></FormControl>
                  <FormDescription>Chọn tệp mới để thay thế tệp hiện tại.</FormDescription>
                  <FormMessage />
                </FormItem>
                <FormField control={form.control} name="inputSelector" render={({ field }) => (
                  <FormItem><FormLabel>CSS Selector của ô nhập tệp</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </>
            )}

            {selectedType === "FORM_FILL_AND_SUBMIT" && (
               <FormField control={form.control} name="formInputs" render={({ field }) => (
                <FormItem><FormLabel>Dữ liệu Inputs (JSON)</FormLabel><FormControl><Textarea className="resize-none h-24 font-mono" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}

            {(selectedType === "FORM_FILL_AND_SUBMIT" || selectedType === "FILE_UPLOAD_AND_SUBMIT") && (
              <FormField control={form.control} name="submitSelector" render={({ field }) => (
                <FormItem><FormLabel>CSS Selector của nút Gửi/Bấm</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
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