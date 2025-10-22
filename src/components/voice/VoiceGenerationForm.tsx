import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { callVoiceApi } from "@/lib/voiceApi";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2 } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  voice_name: z.string().min(1, "Tên voice không được để trống."),
  text: z.string().min(1, "Văn bản không được để trống.").max(2500, "Văn bản không được quá 2500 ký tự."),
  voice_id: z.string().min(1, "Vui lòng chọn một giọng nói."),
  model: z.string().min(1, "Vui lòng chọn một model."),
});

const fetchClonedVoices = async () => {
  const data = await callVoiceApi({ path: "v1m/voice/clone", method: "GET" });
  // Chỉ lấy những giọng nói đã clone thành công (status = 2)
  return data.data.filter((voice: any) => voice.voice_status === 2);
};

export const VoiceGenerationForm = () => {
  const queryClient = useQueryClient();
  const { data: voices, isLoading: isLoadingVoices } = useQuery({
    queryKey: ["cloned_voices"],
    queryFn: fetchClonedVoices,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { voice_name: "", text: "", voice_id: "", model: "speech-2.5-hd-preview" },
  });

  const createVoiceMutation = useMutation({
    mutationFn: (values: z.infer<typeof formSchema>) => {
      const body = {
        voice_name: values.voice_name,
        text: values.text,
        model: values.model,
        voice_setting: { voice_id: values.voice_id }
      };
      return callVoiceApi({ path: "v1m/task/text-to-speech", method: "POST", body });
    },
    onSuccess: () => {
      showSuccess("Đã gửi yêu cầu tạo voice! Vui lòng chờ trong giây lát.");
      queryClient.invalidateQueries({ queryKey: ["voice_tasks"] });
      form.reset({ ...form.getValues(), text: "", voice_name: "" });
    },
    onError: (error: Error) => {
      showError(`Tạo voice thất bại: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createVoiceMutation.mutate(values);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tạo Giọng Nói Mới</CardTitle>
        <CardDescription>Nhập văn bản và chọn giọng nói đã clone để bắt đầu.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="voice_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Tên Voice</FormLabel>
                <FormControl><Input placeholder="Ví dụ: Voice quảng cáo sản phẩm A" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="text" render={({ field }) => (
              <FormItem>
                <FormLabel>Văn bản</FormLabel>
                <FormControl><Textarea placeholder="Xin chào, đây là..." className="min-h-[150px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="voice_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Giọng nói đã Clone</FormLabel>
                {isLoadingVoices ? <Skeleton className="h-10 w-full" /> : (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Chọn một giọng nói đã clone" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {voices && voices.length > 0 ? (
                        voices.map((voice: any) => (
                          <SelectItem key={voice.voice_id} value={voice.voice_id}>{voice.voice_name}</SelectItem>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Bạn chưa có giọng nói nào được clone thành công.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                )}
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="model" render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Chọn một model" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="speech-2.5-hd-preview">Speech 2.5 HD Preview</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={createVoiceMutation.isPending || !voices || voices.length === 0}>
              {createVoiceMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Tạo Voice
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};