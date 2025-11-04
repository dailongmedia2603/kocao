import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useRef } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Tên không được để trống"),
  file: z
    .instanceof(FileList)
    .refine((files) => files?.length === 1, "Vui lòng chọn một tệp JSON.")
    .refine((files) => files?.[0]?.type === 'application/json', "Tệp phải có định dạng .json"),
});

type AddVertexAiKeyDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const AddVertexAiKeyDialog = ({ isOpen, onOpenChange }: AddVertexAiKeyDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const loadingToastId = useRef<string | number | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const addKeyMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");

      const file = values.file[0];
      const credentialsJson = await file.text();
      let credentials;
      try {
        credentials = JSON.parse(credentialsJson);
      } catch (e) {
        throw new Error("Tệp JSON không hợp lệ.");
      }

      const projectId = credentials.project_id;
      if (!projectId) {
        throw new Error("Tệp JSON không chứa 'project_id'.");
      }

      loadingToastId.current = showLoading("Đang kiểm tra kết nối với Vertex AI...");
      const { data: checkData, error: checkError } = await supabase.functions.invoke("check-vertex-ai-key", {
        body: { credentialsJson, projectId },
      });

      if (checkError) throw new Error(checkError.message);
      if (!checkData.success) throw new Error(checkData.error);
      
      dismissToast(loadingToastId.current!);
      showSuccess(checkData.message);

      loadingToastId.current = showLoading("Đang lưu thông tin xác thực...");
      const { error: insertError } = await supabase
        .from("user_vertex_ai_credentials")
        .insert({
          user_id: user.id,
          name: values.name,
          project_id: projectId,
          credentials_json: credentials,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      if (loadingToastId.current) dismissToast(loadingToastId.current);
      showSuccess("Thêm thông tin xác thực Vertex AI thành công!");
      queryClient.invalidateQueries({ queryKey: ["vertex_ai_keys", user?.id] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      if (loadingToastId.current) dismissToast(loadingToastId.current);
      showError(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    addKeyMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm thông tin xác thực Vertex AI</DialogTitle>
          <DialogDescription>
            Tải lên tệp JSON Service Account của bạn từ Google Cloud.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên gợi nhớ</FormLabel>
                  <FormControl>
                    <Input placeholder="Ví dụ: Dự án AI Marketing" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="file"
              render={({ field: { value, onChange, ...fieldProps } }) => (
                <FormItem>
                  <FormLabel>Tệp JSON Service Account</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept=".json"
                      {...fieldProps}
                      onChange={(event) => onChange(event.target.files)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={addKeyMutation.isPending}>
                {addKeyMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xử lý...</> : "Thêm và Kiểm tra"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};