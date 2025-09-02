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
  selector: z.string().optional(),
  delayDuration: z.coerce.number().optional(),
  pasteText: z.string().optional(),
  // Fields for EXTRACT_ATTRIBUTE
  extractSelector: z.string().optional(),
  extractAttribute: z.string().optional(),
  nextTaskName: z.string().optional(),
  nextTaskInputSelector: z.string().optional(),
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
      selector: "",
      delayDuration: 1000,
      pasteText: "",
      extractSelector: "",
      extractAttribute: "",
      nextTaskName: "",
      nextTaskInputSelector: "",
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
      let toastId: string | number | undefined;
      let taskType = values.type;
      let taskStatus = 'pending';

      try {
        if (taskType === 'EXTRACT_ATTRIBUTE') {
          if (!values.extractSelector || !values.extractAttribute || !values.nextTaskName || !values.nextTaskInputSelector) {
            throw new Error("Vui lòng điền đầy đủ thông tin cho chuỗi công việc.");
          }
          taskStatus = 'queued';
          payloadData = {
            selector: values.extractSelector,
            attribute: values.extractAttribute,
            webhookUrl: "https://ypwupyjwwixgnwpohngd.supabase.co/functions/v1/process-and-store-file",
            nextTask: {
              name: values.nextTaskName,
              type: 'UPLOAD_FILE',
              payload: {
                inputSelector: values.nextTaskInputSelector,
              }
            }
          };
        } else {
          switch (values.type) {
            case "NAVIGATE_TO_URL":
              if (!values.url || !z.string().url().safeParse(values.url).success) throw new Error("Vui lòng nhập URL hợp lệ.");
              payloadData = { url: values.url };
              break;
            case "CLICK_ELEMENT":
              if (!values.selector) throw new Error("Vui lòng nhập CSS Selector.");
              payloadData = { selector: values.selector };
              break;
            case "UPLOAD_FILE":
              if (!file) throw new Error("Vui lòng chọn một tệp để tải lên.");
              if (!values.selector) throw new Error("Vui lòng nhập CSS Selector cho ô nhập tệp.");
              toastId = showLoading("Đang tải tệp lên...");
              const filePath = `${user.id}/${projectId}/${Date.now()}-${file.name}`;
              const { error: uploadError } = await supabase.storage.from("task_files").upload(filePath, file);
              if (uploadError) throw new Error(`Lỗi tải tệp lên: ${uploadError.message}`);
              const { data: { publicUrl } } = supabase.storage.from("task_files").getPublicUrl(filePath);
              payloadData = {
                fileUrl: publicUrl,
                fileName: file.name,
                fileType: file.type,
                inputSelector: values.selector,
              };
              break;
            case "DELAY":
              if (!values.delayDuration || values.delayDuration <= 0) throw new Error("Vui lòng nhập thời gian chờ hợp lệ.");
              payloadData = { duration: values.delayDuration };
              break;
            case "PASTE_TEXT":
              if (!values.selector) throw new Error("Vui lòng nhập CSS Selector của ô nhập liệu.");
              if (!values.pasteText) throw new Error("Vui lòng nhập nội dung cần dán.");
              payloadData = { selector: values.selector, text: values.pasteText };
              break;
            default:
              throw new Error("Loại hành động không hợp lệ.");
          }
        }

        const { error } = await supabase.from("tasks").insert([{
          name: values.name, type: taskType, payload: payloadData,
          project_id: projectId, user_id: user.id, execution_order: newOrder, status: taskStatus,
        }]);
        if (error) throw error;

      } finally {
        if (toastId) dismissToast(String(toastId));
      }
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
                <FormLabel>Tên bước / Tên chuỗi công việc</FormLabel>
                <FormControl><Input placeholder="Ví dụ: Tải ảnh đại diện lên Facebook" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Loại hành động</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Chọn một loại hành động" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="EXTRACT_ATTRIBUTE">Trích xuất & Tải lên</SelectItem>
                    <SelectItem value="NAVIGATE_TO_URL">Điều hướng đến URL</SelectItem>
                    <SelectItem value="CLICK_ELEMENT">Bấm vào phần tử</SelectItem>
                    <SelectItem value="UPLOAD_FILE">Tải lên tệp</SelectItem>
                    <SelectItem value="DELAY">Chờ (Delay)</SelectItem>
                    <SelectItem value="PASTE_TEXT">Dán văn bản</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {selectedType === "NAVIGATE_TO_URL" && (
              <FormField control={form.control} name="url" render={({ field }) => (
                <FormItem>
                  <FormLabel>URL Đích</FormLabel>
                  <FormControl><Input placeholder="https://example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {selectedType === "CLICK_ELEMENT" && (
              <FormField control={form.control} name="selector" render={({ field }) => (
                <FormItem>
                  <FormLabel>CSS Selector của phần tử</FormLabel>
                  <FormControl><Input placeholder="button.submit-button" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {selectedType === "UPLOAD_FILE" && (
              <>
                <FormItem>
                  <FormLabel>Tệp để tải lên</FormLabel>
                  <FormControl><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></FormControl>
                  <FormMessage />
                </FormItem>
                <FormField control={form.control} name="selector" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CSS Selector của ô nhập tệp</FormLabel>
                    <FormControl><Input placeholder={`input[type="file"]`} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}

            {selectedType === "DELAY" && (
              <FormField control={form.control} name="delayDuration" render={({ field }) => (
                <FormItem>
                  <FormLabel>Thời gian chờ (mili giây)</FormLabel>
                  <FormControl><Input type="number" placeholder="1000" {...field} /></FormControl>
                  <FormDescription>1000 mili giây = 1 giây</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {selectedType === "PASTE_TEXT" && (
              <>
                <FormField control={form.control} name="pasteText" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nội dung cần dán</FormLabel>
                    <FormControl><Textarea placeholder="Nhập nội dung..." className="resize-y" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="selector" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CSS Selector của ô nhập liệu</FormLabel>
                    <FormControl><Input placeholder={`textarea[name="comment"]`} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}

            {selectedType === "EXTRACT_ATTRIBUTE" && (
              <div className="space-y-4">
                <div className="space-y-2 rounded-md border p-4">
                  <h4 className="font-semibold">Bước 1: Trích xuất dữ liệu</h4>
                  <p className="text-sm text-muted-foreground">
                    Chỉ định phần tử và thuộc tính để lấy dữ liệu (ví dụ: URL tệp).
                  </p>
                  <FormField control={form.control} name="extractSelector" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CSS Selector (để trích xuất)</FormLabel>
                      <FormControl><Input placeholder="img.avatar" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="extractAttribute" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tên thuộc tính (để trích xuất)</FormLabel>
                      <FormControl><Input placeholder="src" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="space-y-2 rounded-md border p-4">
                  <h4 className="font-semibold">Bước 2: Hành động Tải tệp</h4>
                  <p className="text-sm text-muted-foreground">
                    Dữ liệu trích xuất được sẽ được dùng để tải tệp lên ở bước này.
                  </p>
                  <FormField control={form.control} name="nextTaskName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tên cho bước tải tệp</FormLabel>
                      <FormControl><Input placeholder="Tải ảnh đại diện lên" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="nextTaskInputSelector" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CSS Selector (của ô nhập tệp)</FormLabel>
                      <FormControl><Input placeholder={`input[type="file"]`} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
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