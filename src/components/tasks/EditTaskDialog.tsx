import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileLibrary, UserFile } from "./FileLibrary";

const formSchema = z.object({
  name: z.string().min(1, "Tên bước không được để trống"),
  type: z.string().min(1, "Vui lòng chọn loại hành động"),
  url: z.string().optional(),
  selector: z.string().optional(),
  delayDuration: z.coerce.number().optional(),
  pasteText: z.string().optional(),
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
  const [selectedLibraryFile, setSelectedLibraryFile] = useState<UserFile | null>(null);
  const loadingToastId = useRef<string | number | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    if (task) {
      const baseValues: any = { name: task.name, type: task.type };
      switch (task.type) {
        case "NAVIGATE_TO_URL": baseValues.url = task.payload?.url; break;
        case "CLICK_ELEMENT": baseValues.selector = task.payload?.selector; break;
        case "DOWNLOAD_FILE": baseValues.selector = task.payload?.selector; break;
        case "UPLOAD_FILE":
          baseValues.selector = task.payload?.inputSelector;
          setCurrentFileName(task.payload?.fileName || null);
          break;
        case "DELAY": baseValues.delayDuration = task.payload?.duration; break;
        case "PASTE_TEXT":
          baseValues.selector = task.payload?.selector;
          baseValues.pasteText = task.payload?.text;
          break;
      }
      form.reset(baseValues);
      setNewFile(null);
      setSelectedLibraryFile(null);
    }
  }, [task, form]);

  const editTaskMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!task || !user || !projectId) throw new Error("Không có tác vụ, người dùng hoặc ID dự án");

      let payloadData: any = {};
      switch (values.type) {
        case "NAVIGATE_TO_URL":
          if (!values.url || !z.string().url().safeParse(values.url).success) throw new Error("Vui lòng nhập URL hợp lệ.");
          payloadData = { url: values.url };
          break;
        case "CLICK_ELEMENT":
          if (!values.selector) throw new Error("Vui lòng nhập CSS Selector.");
          payloadData = { selector: values.selector };
          break;
        case "DOWNLOAD_FILE":
          if (!values.selector) throw new Error("Vui lòng nhập CSS Selector của nút/link tải xuống.");
          payloadData = { selector: values.selector };
          break;
        case "UPLOAD_FILE":
          let fileUrl = task.payload?.fileUrl;
          let fileName = task.payload?.fileName;
          let fileType = task.payload?.fileType;

          if (newFile) {
            loadingToastId.current = showLoading("Đang tải tệp mới lên Cloudflare R2...");
            
            const formData = new FormData();
            formData.append("file", newFile);
            formData.append("userId", user.id);
            formData.append("projectId", projectId);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("User not authenticated for function call");

            const response = await fetch(
              "https://ypwupyjwwixgnwpohngd.supabase.co/functions/v1/upload-to-r2",
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'apikey': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3VweWp3d2l4Z253cG9obmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NDY3NDAsImV4cCI6MjA3MjAyMjc0MH0.J-NqLbR__Yq4RqGtRIPM5dYTmZZFVoBfZ3lwkTk_-rw",
                },
                body: formData,
              }
            );

            if (!response.ok) {
              const errorBody = await response.json();
              throw new Error(errorBody.error || `Lỗi máy chủ: ${response.statusText}`);
            }

            const newFileData = await response.json();
    
            fileUrl = newFileData.file_url;
            fileName = newFileData.file_name;
            fileType = newFile.type;
          } else if (selectedLibraryFile) {
            fileUrl = selectedLibraryFile.file_url;
            fileName = selectedLibraryFile.file_name;
            fileType = undefined;
          }

          if (!fileUrl) throw new Error("Không tìm thấy tệp. Vui lòng chọn một tệp mới hoặc chọn từ thư viện.");
          payloadData = { fileUrl, fileName, fileType, inputSelector: values.selector };
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
      const { error } = await supabase.from("tasks").update({
        name: values.name, type: values.type, payload: payloadData,
      }).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (loadingToastId.current) {
        dismissToast(loadingToastId.current);
        loadingToastId.current = null;
      }
      showSuccess("Cập nhật bước thành công!");
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
        queryClient.invalidateQueries({ queryKey: ["user_files", user?.id] });
      }
      onOpenChange(false);
      setNewFile(null);
      setSelectedLibraryFile(null);
    },
    onError: (error) => {
      if (loadingToastId.current) {
        dismissToast(loadingToastId.current);
        loadingToastId.current = null;
      }
      showError(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => { editTaskMutation.mutate(values); };
  const selectedType = form.watch("type");

  const activeFileName = newFile?.name || selectedLibraryFile?.file_name || currentFileName;
  const activeFileSource = newFile ? 'new' : selectedLibraryFile ? 'library' : currentFileName ? 'current' : 'none';

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
                <FormItem><FormLabel>URL Đích</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            {(selectedType === "CLICK_ELEMENT" || selectedType === "DOWNLOAD_FILE") && (
              <FormField control={form.control} name="selector" render={({ field }) => (
                <FormItem><FormLabel>CSS Selector của phần tử</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            {selectedType === "UPLOAD_FILE" && (
              <>
                <Tabs defaultValue="new" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="new">Tải lên tệp mới</TabsTrigger>
                    <TabsTrigger value="library">Chọn từ thư viện</TabsTrigger>
                  </TabsList>
                  <TabsContent value="new">
                    <FormItem className="mt-4">
                      <FormLabel>Tệp để tải lên</FormLabel>
                      {activeFileName && (
                        <div className="text-sm text-muted-foreground mb-2">
                          {activeFileSource === 'current' && 'Tệp hiện tại: '}
                          {activeFileSource === 'library' && 'Tệp đã chọn: '}
                          {activeFileSource === 'new' && 'Tệp mới: '}
                          <Badge variant={activeFileSource === 'library' ? 'default' : 'secondary'}>
                            {activeFileName}
                          </Badge>
                        </div>
                      )}
                      <FormControl>
                        <Input type="file" onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setNewFile(file);
                          if (file) setSelectedLibraryFile(null);
                        }} />
                      </FormControl>
                      <FormDescription>
                        {activeFileSource !== 'none' ? 'Chọn tệp mới để thay thế.' : 'Chọn một tệp để tải lên.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  </TabsContent>
                  <TabsContent value="library">
                    <div className="mt-4">
                      <FileLibrary
                        selectedFileUrl={selectedLibraryFile?.file_url || task?.payload?.fileUrl}
                        onFileSelect={(file) => {
                          setSelectedLibraryFile(file);
                          setNewFile(null);
                          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                          if (fileInput) fileInput.value = "";
                        }}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
                <FormField control={form.control} name="selector" render={({ field }) => (
                  <FormItem><FormLabel>CSS Selector của ô nhập tệp</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </>
            )}
            {selectedType === "DELAY" && (
              <FormField control={form.control} name="delayDuration" render={({ field }) => (
                <FormItem><FormLabel>Thời gian chờ (mili giây)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>1000 mili giây = 1 giây</FormDescription><FormMessage /></FormItem>
              )} />
            )}
            {selectedType === "PASTE_TEXT" && (
              <>
                <FormField control={form.control} name="pasteText" render={({ field }) => (
                  <FormItem><FormLabel>Nội dung cần dán</FormLabel><FormControl><Textarea className="resize-y" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="selector" render={({ field }) => (
                  <FormItem><FormLabel>CSS Selector của ô nhập liệu</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
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