import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const formSchema = z.object({
  voice_name: z.string().min(1, "Tên giọng nói không được để trống."),
  preview_text: z.string().min(10, "Văn bản xem trước phải có ít nhất 10 ký tự.").max(300, "Văn bản không được quá 300 ký tự."),
  file: z
    .instanceof(FileList)
    .refine((files) => files?.length === 1, "Vui lòng chọn một file.")
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Kích thước file tối đa là 20MB.`)
    .refine(
      (files) => files?.[0]?.type.startsWith('audio/'),
      "Vui lòng chọn một file âm thanh."
    ),
});

export const VoiceCloneForm = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      voice_name: "",
      preview_text: "Xin chào, tôi rất vui được hỗ trợ bạn với các dịch vụ giọng nói của chúng tôi. Hãy chọn một giọng nói phù hợp với bạn và cùng bắt đầu hành trình âm thanh sáng tạo của chúng ta",
    },
  });

  const cloneVoiceMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const formData = new FormData();
      formData.append("voice_name", values.voice_name);
      formData.append("preview_text", values.preview_text);
      formData.append("file", values.file[0]);

      const { data, error } = await supabase.functions.invoke("voice-clone-proxy", { body: formData });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      if (!data.success) throw new Error(data.message || "Clone voice thất bại.");
      return data;
    },
    onSuccess: () => {
      showSuccess("Gửi yêu cầu clone thành công! Giọng nói sẽ sớm xuất hiện trong danh sách.");
      queryClient.invalidateQueries({ queryKey: ["cloned_voices_db", user?.id] });
      form.reset();
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    cloneVoiceMutation.mutate(values);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tạo Giọng Nói Mới</CardTitle>
        <CardDescription>Tải lên một file âm thanh (tối đa 20MB) để tạo ra một giọng nói tùy chỉnh.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="voice_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Tên giọng nói</FormLabel>
                <FormControl><Input placeholder="Ví dụ: Giọng đọc của tôi" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
             <FormField control={form.control} name="preview_text" render={({ field }) => (
              <FormItem>
                <FormLabel>Văn bản xem trước</FormLabel>
                <FormControl><Textarea placeholder="Văn bản dùng để tạo file âm thanh mẫu..." className="min-h-[80px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField
              control={form.control}
              name="file"
              render={({ field: { value, onChange, ...fieldProps } }) => (
                <FormItem>
                  <FormLabel>File âm thanh</FormLabel>
                  <FormControl>
                    <Input
                      {...fieldProps}
                      type="file"
                      accept="audio/*"
                      onChange={(event) => onChange(event.target.files)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={cloneVoiceMutation.isPending}>
              {cloneVoiceMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Bắt đầu Clone
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};