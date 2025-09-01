import { useState } from "react";
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

const formSchema = z.object({
  name: z.string().min(1, "Tên bước không được để trống"),
  type: z.string().min(1, "Vui lòng chọn loại hành động"),
  url: z.string().optional(),
  formInputs: z.string().optional(),
  submitSelector: z.string().optional(),
  inputSelector: z.string().optional(),
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
  const [file, setFile] = useState<File | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "",
      url: "",
      formInputs: "[]",
      submitSelector: "",
      inputSelector: "",
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");

      const { data: lastTask, error: orderError } = await supabase
        .from("tasks")
        .select("execution_order")
        .eq("project_id", projectId)
        .order("execution_order", { ascending: false })
        .limit(1)
        .single();

      if (orderError && orderError.code !== 'PGRST116') throw orderError;
      const newOrder = lastTask ? (lastTask.execution_order || 0) + 1 : 1;

      let payloadData: any = {};
      if (values.type === "NAVIGATE_TO_URL") {
        if (!values.url || !z.string().url().safeParse(values.url).success) throw new Error("Vui lòng nhập URL hợp lệ.");
        payloadData = { url: values.url };
      } else if (values.type === "FORM_FILL_AND_SUBMIT") {
        // ... (logic for form fill)
      } else if (values.type === "FILE_UPLOAD_AND_SUBMIT") {
        if (!file) throw new Error("Vui lòng chọn một tệp để tải lên.");
        if (!values.url || !z.string().url().safeParse(values.url).success) throw new Error("Vui lòng nhập URL đích hợp lệ.");
        if (!values.inputSelector) throw new Error("Vui lòng nhập CSS Selector cho ô nhập tệp.");
        if (!values.submitSelector) throw new Error("Vui lòng nhập CSS Selector cho nút gửi.");

        const toastId = showLoading("Đang tải tệp lên...");
        const filePath = `${user.id}/${projectId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("task_files").upload(filePath, file);
        dismissToast(String(toastId));
        if (uploadError) throw new Error(`Lỗi tải tệp lên: ${uploadError.message}`);
        
        const { data: { publicUrl } } = supabase.storage.from("task_files").getPublicUrl(filePath);
        payloadData = {
          url: values.url,
          fileUrl: publicUrl,
          fileName: file.name,
          fileType: file.type,
          inputSelector: values.inputSelector,
          submitButton: values.submitSelector,
        };
      }

      const { error } = await supabase.from("tasks").insert([{
        name: values.name, type: values.type, payload: payloadData,
        project_id: projectId, user_id: user.id, execution_order: newOrder, status: 'pending',
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Thêm bước thành công!");
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      onOpenChange(false);
      form.reset();
      setFile(null);
    },
    onError: (error) => { showError(`Lỗi: ${error.message}`); },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => { createTaskMutation.mutate(values); };
  const selectedType = form.watch("type");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader><DialogTitle>Thêm bước mới vào kịch bản</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Tên bước</FormLabel>
                <FormControl><Input placeholder="Ví dụ: Tải file nhạc lên Soundcloud" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Loại hành động</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Chọn một loại hành động" /></SelectTrigger></FormControl>
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
                <FormItem>
                  <FormLabel>URL Đích</FormLabel>
                  <FormControl><Input placeholder="https://example.com/upload" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {selectedType === "FILE_UPLOAD_AND_SUBMIT" && (
              <>
                <FormItem>
                  <FormLabel>Tệp để tải lên</FormLabel>
                  <FormControl><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></FormControl>
                  <FormMessage />
                </FormItem>
                <FormField control={form.control} name="inputSelector" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CSS Selector của ô nhập tệp</FormLabel>
                    <FormControl><Input placeholder={`input[type="file"]`} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}

            {selectedType === "FORM_FILL_AND_SUBMIT" && (
              <FormField control={form.control} name="formInputs" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dữ liệu Inputs (JSON)</FormLabel>
                  <FormControl><Textarea placeholder='[{"selector": "#email", "value": "test@example.com"}]' className="resize-none h-24 font-mono" {...field} /></FormControl>
                  <FormDescription>Một mảng JSON. Để trống `[]` nếu không cần điền form.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {(selectedType === "FORM_FILL_AND_SUBMIT" || selectedType === "FILE_UPLOAD_AND_SUBMIT") && (
              <FormField control={form.control} name="submitSelector" render={({ field }) => (
                <FormItem>
                  <FormLabel>CSS Selector của nút Gửi/Bấm</FormLabel>
                  <FormControl><Input placeholder="button[type='submit']" {...field} /></FormControl>
                  <FormDescription>Selector của nút để bấm sau khi đã chọn/điền xong.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={createTaskMutation.isPending}>
                {createTaskMutation.isPending ? "Đang xử lý..." : "Thêm bước"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};