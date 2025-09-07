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

const formSchema = z.object({
  input: z.string().min(1, "Văn bản không được để trống.").max(2500, "Văn bản không được quá 2500 ký tự."),
  voice_id: z.string().min(1, "Vui lòng chọn một giọng nói."),
  model_id: z.string().min(1, "Vui lòng chọn một model."),
});

const fetchVoices = async () => {
  const data = await callVoiceApi({ path: "voices", method: "GET" });
  return data.voices;
};

export const VoiceGenerationForm = () => {
  const queryClient = useQueryClient();
  const { data: voices, isLoading: isLoadingVoices } = useQuery({
    queryKey: ["voices"],
    queryFn: fetchVoices,
    staleTime: Infinity,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { input: "", voice_id: "", model_id: "eleven_multilingual_v2" },
  });

  const createVoiceMutation = useMutation({
    mutationFn: (values: z.infer<typeof formSchema>) => callVoiceApi({ path: "task", method: "POST", body: values }),
    onSuccess: () => {
      showSuccess("Đã gửi yêu cầu tạo voice! Vui lòng chờ trong giây lát.");
      queryClient.invalidateQueries({ queryKey: ["voice_tasks"] });
      form.reset({ ...form.getValues(), input: "" });
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
        <CardDescription>Nhập văn bản và chọn giọng nói để bắt đầu.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="input" render={({ field }) => (
              <FormItem>
                <FormLabel>Văn bản</FormLabel>
                <FormControl><Textarea placeholder="Xin chào, đây là GenAIPro..." className="min-h-[150px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="voice_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Giọng nói</FormLabel>
                {isLoadingVoices ? <Skeleton className="h-10 w-full" /> : (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Chọn một giọng nói" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {voices?.map((voice: any) => (
                        <SelectItem key={voice.voice_id} value={voice.voice_id}>{voice.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="model_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Chọn một model" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="eleven_multilingual_v2">Eleven Multilingual v2</SelectItem>
                    <SelectItem value="eleven_turbo_v2_5">Eleven Turbo v2.5</SelectItem>
                    <SelectItem value="eleven_flash_v2_5">Eleven Flash v2.5</SelectItem>
                    <SelectItem value="eleven_v3">Eleven v3</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={createVoiceMutation.isPending}>
              {createVoiceMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Tạo Voice
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};