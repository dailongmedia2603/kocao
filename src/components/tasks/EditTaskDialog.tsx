import { useState, useEffect, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KocFileSelector, KocFile } from "./KocFileSelector";
import { Skeleton } from "../ui/skeleton";

const formSchema = z.object({
  name: z.string().min(1, "Tên bước không được để trống"),
  type: z.string().min(1, "Vui lòng chọn loại hành động"),
  url: z.string().optional(),
  selector: z.string().optional(),
  delayDuration: z.coerce.number().optional(),
  pasteText: z.string().optional(),
  // Fields for CREATE_AND_AWAIT_VIDEO
  kocId: z.string().optional(),
  videoScriptId: z.string().optional(),
  script: z.string().optional(), // For backward compatibility
  inputSelector: z.string().optional(),
  submitButtonSelector: z.string().optional(),
  resultIdentifierSelector: z.string().optional(),
  resultDownloadSelector: z.string().optional(),
});

type Koc = { id: string; name: string; };
type VideoScript = { id: string; name: string; koc_id: string; script_content: string | null; };

type Task = {
  id: string; name: string; type: string; payload: any;
};

type EditTaskDialogProps = {
  isOpen: boolean; onOpenChange: (isOpen: boolean) => void; task: Task | null; projectId?: string;
};

export const EditTaskDialog = ({ isOpen, onOpenChange, task, projectId }: EditTaskDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [selectedKocFile, setSelectedKocFile] = useState<KocFile | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema) });

  const { data: kocs, isLoading: isLoadingKocs } = useQuery<Koc[]>({
    queryKey: ['kocs_for_script', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('kocs').select('id, name').eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user && isOpen && task?.type === 'CREATE_AND_AWAIT_VIDEO',
  });

  const { data: videoScripts, isLoading: isLoadingScripts } = useQuery<VideoScript[]>({
    queryKey: ['video_scripts_for_task', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('video_scripts').select('id, name, koc_id, script_content').eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user && isOpen && task?.type === 'CREATE_AND_AWAIT_VIDEO',
  });

  const selectedKocId = form.watch("kocId");

  const filteredScripts = useMemo(() => {
    if (!selectedKocId || !videoScripts) return [];
    return videoScripts.filter(script => script.koc_id === selectedKocId);
  }, [selectedKocId, videoScripts]);

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
        case "CREATE_AND_AWAIT_VIDEO":
          baseValues.inputSelector = task.payload?.inputSelector;
          baseValues.submitButtonSelector = task.payload?.submitButtonSelector;
          baseValues.resultIdentifierSelector = task.payload?.resultIdentifierSelector;
          baseValues.resultDownloadSelector = task.payload?.resultDownloadSelector;
          if (task.payload?.videoScriptId) {
            baseValues.kocId = task.payload.kocId;
            baseValues.videoScriptId = task.payload.videoScriptId;
          } else {
            baseValues.script = task.payload?.script;
          }
          break;
      }
      form.reset(baseValues);
      setSelectedKocFile(null);
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
        case "DOWNLOAD_FILE":
          if (!values.selector) throw new Error("Vui lòng nhập CSS Selector.");
          payloadData = { selector: values.selector };
          break;
        case "UPLOAD_FILE":
          if (selectedKocFile) {
            payloadData = {
              fileName: selectedKocFile.display_name,
              inputSelector: values.selector,
              storagePath: selectedKocFile.r2_key,
            };
          } else {
            if (!task.payload?.storagePath) throw new Error("Không có tệp nào được chọn. Vui lòng chọn một tệp từ thư viện KOC.");
            payloadData = { ...task.payload, inputSelector: values.selector };
            delete payloadData.fileUrl;
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
        case "CREATE_AND_AWAIT_VIDEO":
          const commonPayload = {
            inputSelector: values.inputSelector,
            submitButtonSelector: values.submitButtonSelector,
            resultIdentifierSelector: values.resultIdentifierSelector,
            resultDownloadSelector: values.resultDownloadSelector,
          };
          if (values.videoScriptId) {
            const selectedScript = videoScripts?.find(s => s.id === values.videoScriptId);
            if (!selectedScript) throw new Error("Vui lòng chọn một kịch bản hợp lệ.");
            payloadData = {
              ...commonPayload,
              script: selectedScript.script_content,
              videoScriptId: selectedScript.id,
              kocId: values.kocId,
            };
          } else {
            payloadData = { ...commonPayload, script: values.script };
          }
          break;
        default: throw new Error("Loại hành động không hợp lệ.");
      }
      const { error } = await supabase.from("tasks").update({
        name: values.name, type: values.type, payload: payloadData,
      }).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cập nhật bước thành công!");
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      }
      onOpenChange(false);
      setSelectedKocFile(null);
    },
    onError: (error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => { editTaskMutation.mutate(values); };
  const selectedType = form.watch("type");
  const activeFileName = selectedKocFile?.display_name || currentFileName;

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
                    <SelectItem value="CREATE_AND_AWAIT_VIDEO">Tạo và Chờ Video từ Web</SelectItem>
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
              <div className="pt-2 space-y-4">
                <div>
                  {activeFileName && (
                    <div className="text-sm text-muted-foreground mb-2">
                      Tệp hiện tại: <Badge variant="secondary">{activeFileName}</Badge>
                    </div>
                  )}
                  <KocFileSelector
                    onFileSelect={setSelectedKocFile}
                  />
                   <FormDescription className="mt-2">
                      Chọn một tệp mới để thay thế tệp hiện tại.
                    </FormDescription>
                </div>
                <FormField control={form.control} name="selector" render={({ field }) => (
                  <FormItem><FormLabel>3. CSS Selector của ô nhập tệp</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
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
            {selectedType === "CREATE_AND_AWAIT_VIDEO" && (
              <div className="space-y-4">
                {task?.payload?.videoScriptId ? (
                  <>
                    <FormField control={form.control} name="kocId" render={({ field }) => (
                      <FormItem><FormLabel>Chọn KOC</FormLabel>
                        {isLoadingKocs ? <Skeleton className="h-10 w-full" /> : (
                          <Select onValueChange={(value) => { field.onChange(value); form.setValue("videoScriptId", ""); }} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Chọn một KOC" /></SelectTrigger></FormControl>
                            <SelectContent>{kocs?.map(koc => <SelectItem key={koc.id} value={koc.id}>{koc.name}</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                      <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="videoScriptId" render={({ field }) => (
                      <FormItem><FormLabel>Chọn kịch bản (voice)</FormLabel>
                        {isLoadingScripts ? <Skeleton className="h-10 w-full" /> : (
                          <Select onValueChange={field.onChange} value={field.value} disabled={!selectedKocId || filteredScripts.length === 0}>
                            <FormControl><SelectTrigger><SelectValue placeholder={!selectedKocId ? "Vui lòng chọn KOC trước" : "Chọn một kịch bản"} /></SelectTrigger></FormControl>
                            <SelectContent>{filteredScripts.map(script => <SelectItem key={script.id} value={script.id}>{script.name}</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                      <FormMessage /></FormItem>
                    )} />
                  </>
                ) : (
                  <FormField control={form.control} name="script" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kịch bản Video (cũ)</FormLabel>
                      <FormControl><Textarea {...field} disabled /></FormControl>
                      <FormDescription>Tác vụ này được tạo theo định dạng cũ. Để thay đổi kịch bản, vui lòng tạo một bước mới.</FormDescription>
                    </FormItem>
                  )} />
                )}
                <FormField control={form.control} name="inputSelector" render={({ field }) => (
                  <FormItem><FormLabel>Selector ô nhập kịch bản</FormLabel><FormControl><Input placeholder="Selector của ô nhập kịch bản" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="submitButtonSelector" render={({ field }) => (
                  <FormItem><FormLabel>Selector của nút tạo video</FormLabel><FormControl><Input placeholder="Selector của nút tạo video" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="resultIdentifierSelector" render={({ field }) => (
                  <FormItem><FormLabel>Selector để lấy ID/tên video</FormLabel><FormControl><Input placeholder="Selector để lấy ID/tên video" {...field} /></FormControl><FormDescription className="text-xs">Selector để tìm định danh duy nhất (tên file, ID) của video sau khi bắt đầu tạo.</FormDescription><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="resultDownloadSelector" render={({ field }) => (
                  <FormItem><FormLabel>Selector của nút tải xuống</FormLabel><FormControl><Input placeholder="Selector của nút tải xuống" {...field} /></FormControl><FormDescription className="text-xs">Selector của nút 'Tải xuống' tương ứng với video đã hoàn thành.</FormDescription><FormMessage /></FormItem>
                )} />
              </div>
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