import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { FilePickerDialog, UserFile } from "./FilePickerDialog";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  name: z.string().min(1, "Tên bước không được để trống"),
  type: z.string().min(1, "Vui lòng chọn loại hành động"),
  url: z.string().optional(),
  selector: z.string().optional(),
  delayDuration: z.coerce.number().optional(),
  pasteText: z.string().optional(),
  extractSelector: z.string().optional(),
  extractAttribute: z.string().optional(),
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
  const [selectedLibraryFile, setSelectedLibraryFile] = useState<UserFile | null>(null);
  const [fileSource, setFileSource] = useState("upload");
  const [isPickerDialogOpen, setPickerDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", type: "", url: "", selector: "", delayDuration: 1000, pasteText: "", extractSelector: "", extractAttribute: "" },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");

      const { data: lastTask, error: orderError } = await supabase.from("tasks").select("execution_order").eq("project_id", projectId).order("execution_order", { ascending: false }).limit(1).single();
      if (orderError && orderError.code !== 'PGRST116') throw orderError;
      const newOrder = lastTask ? (lastTask.execution_order || 0) + 1 : 1;

      let payloadData: any = {};
      let toastId: string | number | undefined;

      try {
        switch (values.type) {
          case "EXTRACT_DATA":
            if (!values.extractSelector || !values.extractAttribute) throw new Error("Vui lòng điền đầy đủ thông tin trích xuất.");
            payloadData = { selector: values.extractSelector, attribute: values.extractAttribute };
            break;
          case "NAVIGATE_TO_URL":
            if (!values.url || !z.string().url().safeParse(values.url).success) throw new Error("Vui lòng nhập URL hợp lệ.");
            payloadData = { url: values.url };
            break;
          case "CLICK_ELEMENT":
            if (!values.selector) throw new Error("Vui lòng nhập CSS Selector.");
            payloadData = { selector: values.selector };
            break;
          case "UPLOAD_FILE":
            if (!values.selector) throw new Error("Vui lòng nhập CSS Selector cho ô nhập tệp.");
            payloadData = { inputSelector: values.selector };
            if (fileSource === 'previous_step') {
              payloadData.fileSource = 'previous_step_output';
            } else if (fileSource === 'library') {
              if (!selectedLibraryFile) throw new Error("Vui lòng chọn một tệp từ thư viện.");
              payloadData.fileUrl = selectedLibraryFile.file_url;
              payloadData.fileName = selectedLibraryFile.file_name;
            } else { // 'upload'
              if (!file) throw new Error("Vui lòng chọn một tệp để tải lên.");
              toastId = showLoading("Đang tải tệp lên...");
              const filePath = `${user.id}/${projectId}/${Date.now()}-${file.name}`;
              const { error: uploadError } = await supabase.storage.from("task_files").upload(filePath, file);
              if (uploadError) throw new Error(`Lỗi tải tệp lên: ${uploadError.message}`);
              const { data: { publicUrl } } = supabase.storage.from("task_files").getPublicUrl(filePath);
              
              const { error: dbError } = await supabase.from("user_files").insert({ user_id: user.id, project_id: projectId, file_name: file.name, file_url: publicUrl, storage_path: filePath, source: 'upload' });
              if (dbError) throw new Error(`Lỗi lưu tệp vào thư viện: ${dbError.message}`);
              queryClient.invalidateQueries({ queryKey: ["user_files", user.id] });

              payloadData.fileUrl = publicUrl;
              payloadData.fileName = file.name;
              payloadData.fileType = file.type;
            }
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
        const { error } = await supabase.from("tasks").insert([{ name: values.name, type: values.type, payload: payloadData, project_id: projectId, user_id: user.id, execution_order: newOrder, status: 'pending' }]);
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
      setSelectedLibraryFile(null);
      setFileSource("upload");
    },
    onError: (error) => { showError(`Lỗi: ${error.message}`); },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => { createTaskMutation.mutate(values); };
  const selectedType = form.watch("type");

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Thêm bước mới vào kịch bản</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Tên bước</FormLabel><FormControl><Input placeholder="Ví dụ: Đăng nhập vào tài khoản" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem><FormLabel>Loại hành động</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Chọn một loại hành động" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="EXTRACT_DATA">Trích xuất dữ liệu</SelectItem>
                      <SelectItem value="UPLOAD_FILE">Tải lên tệp</SelectItem>
                      <SelectItem value="NAVIGATE_TO_URL">Điều hướng đến URL</SelectItem>
                      <SelectItem value="CLICK_ELEMENT">Bấm vào phần tử</SelectItem>
                      <SelectItem value="DELAY">Chờ (Delay)</SelectItem>
                      <SelectItem value="PASTE_TEXT">Dán văn bản</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {selectedType === "EXTRACT_DATA" && (
                <div className="space-y-4 rounded-md border p-4">
                  <FormField control={form.control} name="extractSelector" render={({ field }) => (
                    <FormItem><FormLabel>CSS Selector (để trích xuất)</FormLabel><FormControl><Input placeholder="img.avatar" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="extractAttribute" render={({ field }) => (
                    <FormItem><FormLabel>Tên thuộc tính (để trích xuất)</FormLabel><FormControl><Input placeholder="src" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              )}

              {selectedType === "UPLOAD_FILE" && (
                <div className="space-y-4 rounded-md border p-4">
                  <FormItem>
                    <FormLabel>Nguồn tệp</FormLabel>
                    <RadioGroup value={fileSource} onValueChange={setFileSource} className="flex space-x-4">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="upload" id="r1" /><label htmlFor="r1">Tải mới</label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="library" id="r2" /><label htmlFor="r2">Thư viện</label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="previous_step" id="r3" /><label htmlFor="r3">Bước trước</label></div>
                    </RadioGroup>
                  </FormItem>
                  {fileSource === 'upload' && <FormItem><FormLabel>Tệp để tải lên</FormLabel><FormControl><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></FormControl><FormMessage /></FormItem>}
                  {fileSource === 'library' && (
                    <FormItem>
                      <FormLabel>Tệp đã chọn</FormLabel>
                      {selectedLibraryFile ? <Badge variant="secondary">{selectedLibraryFile.file_name}</Badge> : <p className="text-sm text-muted-foreground">Chưa có tệp nào được chọn.</p>}
                      <Button type="button" variant="outline" className="w-full mt-2" onClick={() => setPickerDialogOpen(true)}>Chọn từ thư viện</Button>
                    </FormItem>
                  )}
                  {fileSource === 'previous_step' && <FormDescription>Tệp sẽ được tự động lấy từ kết quả của bước trích xuất dữ liệu trước đó.</FormDescription>}
                  <FormField control={form.control} name="selector" render={({ field }) => (
                    <FormItem><FormLabel>CSS Selector của ô nhập tệp</FormLabel><FormControl><Input placeholder={`input[type="file"]`} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              )}

              {selectedType === "NAVIGATE_TO_URL" && <FormField control={form.control} name="url" render={({ field }) => (<FormItem><FormLabel>URL Đích</FormLabel><FormControl><Input placeholder="https://example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />}
              {selectedType === "CLICK_ELEMENT" && <FormField control={form.control} name="selector" render={({ field }) => (<FormItem><FormLabel>CSS Selector của phần tử</FormLabel><FormControl><Input placeholder="button.submit" {...field} /></FormControl><FormMessage /></FormItem>)} />}
              {selectedType === "DELAY" && <FormField control={form.control} name="delayDuration" render={({ field }) => (<FormItem><FormLabel>Thời gian chờ (mili giây)</FormLabel><FormControl><Input type="number" placeholder="1000" {...field} /></FormControl><FormMessage /></FormItem>)} />}
              {selectedType === "PASTE_TEXT" && (<>
                  <FormField control={form.control} name="pasteText" render={({ field }) => (<FormItem><FormLabel>Nội dung cần dán</FormLabel><FormControl><Textarea placeholder="Nhập nội dung..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="selector" render={({ field }) => (<FormItem><FormLabel>CSS Selector của ô nhập liệu</FormLabel><FormControl><Input placeholder={`textarea[name="comment"]`} {...field} /></FormControl><FormMessage /></FormItem>)} />
              </>)}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                <Button type="submit" disabled={createTaskMutation.isPending}>{createTaskMutation.isPending ? "Đang xử lý..." : "Thêm bước"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <FilePickerDialog isOpen={isPickerDialogOpen} onOpenChange={setPickerDialogOpen} projectId={projectId} onFileSelect={setSelectedLibraryFile} />
    </>
  );
};