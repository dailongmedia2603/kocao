import { useState, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { KocFileSelector, KocFile } from "./KocFileSelector";

const formSchema = z.object({
  name: z.string().min(1, "Tên bước không được để trống"),
  type: z.string().min(1, "Vui lòng chọn loại hành động"),
  url: z.string().optional(),
  selector: z.string().optional(),
  delayDuration: z.coerce.number().optional(),
  pasteText: z.string().optional(),
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
  const [selectedKocFile, setSelectedKocFile] = useState<KocFile | null>(null);
  const loadingToastId = useRef<string | number | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", type: "" },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");

      let payloadData: any = {};
      switch (values.type) {
        case "NAVIGATE_TO_URL":
          if (!values.url || !z.string().url().safeParse(values.url).success) throw new Error("Vui lòng nhập URL hợp lệ.");
          payloadData = { url: values.url };
          break;
        case "CLICK_ELEMENT":
        case "DOWNLOAD_FILE":
          if (!values.selector) throw new Error("Vui lòng nhập CSS Selector.");
          payloadData = { selector: values.selector };
          break;
        case "UPLOAD_FILE":
          if (!values.selector) throw new Error("Vui lòng nhập CSS Selector của ô nhập tệp.");
          if (!selectedKocFile) throw new Error("Vui lòng chọn một tệp từ thư viện KOC.");
          
          payloadData = {
            fileUrl: selectedKocFile.url,
            fileName: selectedKocFile.display_name,
            inputSelector: values.selector,
            storagePath: selectedKocFile.r2_key,
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
        default: throw new Error("Loại hành động không hợp lệ.");
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert([{
          name: values.name,
          type: values.type,
          payload: payloadData,
          project_id: projectId,
          user_id: user.id,
          status: 'pending',
          execution_order: taskCount + 1,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (loadingToastId.current) {
        dismissToast(loadingToastId.current);
        loadingToastId.current = null;
      }
      showSuccess("Thêm bước thành công!");
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      onOpenChange(false);
      form.reset();
      setSelectedKocFile(null);
    },
    onError: (error) => {
      if (loadingToastId.current) {
        dismissToast(loadingToastId.current);
        loadingToastId.current = null;
      }
      showError(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createTaskMutation.mutate(values);
  };

  const selectedType = form.watch("type");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Thêm bước mới</DialogTitle>
          <DialogDescription>
            Chọn một hành động và cấu hình các thông số cho bước này.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Tên bước</FormLabel><FormControl><Input placeholder="Ví dụ: Đăng nhập vào tài khoản" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Loại hành động</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Chọn một hành động" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="NAVIGATE_TO_URL">Điều hướng đến URL</SelectItem>
                    <SelectItem value="CLICK_ELEMENT">Bấm vào phần tử</SelectItem>
                    <SelectItem value="DOWNLOAD_FILE">Tải xuống tệp và lưu</SelectItem>
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
                <FormItem><FormLabel>URL Đích</FormLabel><FormControl><Input placeholder="https://example.com" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            {(selectedType === "CLICK_ELEMENT" || selectedType === "DOWNLOAD_FILE") && (
              <FormField control={form.control} name="selector" render={({ field }) => (
                <FormItem><FormLabel>CSS Selector của phần tử</FormLabel><FormControl><Input placeholder="#submit-button" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            {selectedType === "UPLOAD_FILE" && (
              <>
                <div className="pt-2">
                  <KocFileSelector
                    selectedFileUrl={selectedKocFile?.url}
                    onFileSelect={setSelectedKocFile}
                  />
                </div>
                <FormField control={form.control} name="selector" render={({ field }) => (
                  <FormItem><FormLabel>3. CSS Selector của ô nhập tệp</FormLabel><FormControl><Input placeholder="input[type='file']" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </>
            )}
            {selectedType === "DELAY" && (
              <FormField control={form.control} name="delayDuration" render={({ field }) => (
                <FormItem><FormLabel>Thời gian chờ (mili giây)</FormLabel><FormControl><Input type="number" placeholder="1000" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            {selectedType === "PASTE_TEXT" && (
              <>
                <FormField control={form.control} name="pasteText" render={({ field }) => (
                  <FormItem><FormLabel>Nội dung cần dán</FormLabel><FormControl><Textarea placeholder="Nhập văn bản ở đây..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="selector" render={({ field }) => (
                  <FormItem><FormLabel>CSS Selector của ô nhập liệu</FormLabel><FormControl><Input placeholder="input[name='username']" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={createTaskMutation.isPending} className="bg-red-600 hover:bg-red-700 text-white">
                {createTaskMutation.isPending ? "Đang thêm..." : "Thêm bước"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};