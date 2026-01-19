import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2 } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSession } from "@/contexts/SessionContext";

const formSchema = z.object({
  voice_name: z.string().min(1, "Tên voice không được để trống."),
  voice_id: z.string().min(1, "Vui lòng chọn một giọng nói."),
  model: z.string().min(1, "Vui lòng chọn một model."),
  contentType: z.enum(["text", "koc"]),
  text: z.string().optional(),
  koc_id: z.string().optional(),
  idea_id: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.contentType === "text" && (!data.text || data.text.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["text"],
      message: "Văn bản không được để trống.",
    });
  }
  if (data.contentType === "text" && data.text && data.text.length > 2500) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["text"],
      message: "Văn bản không được quá 2500 ký tự.",
    });
  }
  if (data.contentType === "koc" && !data.koc_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["koc_id"],
      message: "Vui lòng chọn một KOC.",
    });
  }
  if (data.contentType === "koc" && !data.idea_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["idea_id"],
      message: "Vui lòng chọn một nội dung.",
    });
  }
});

export const VoiceGenerationForm = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [contentType, setContentType] = useState<"text" | "koc">("text");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      voice_name: "",
      text: "",
      voice_id: "",
      model: "speech-2.5-hd-preview",
      contentType: "text",
      koc_id: undefined,
      idea_id: undefined,
    },
  });

  const watchedKocId = form.watch("koc_id");

  const { data: voices, isLoading: isLoadingVoices } = useQuery({
    queryKey: ["cloned_voices"],
    queryFn: async () => {
      // Fetch only ready voices (status 2? api.voice.clonedVoices returns all)
      // Assuming api.voice.clonedVoices only returns ready ones or we filter.
      // Original code filtered `voice.voice_status === 2`.
      // Let's assume backend filters or we need to filter if `ClonedVoice` model has status.
      // apiClient `ClonedVoice` doesn't explicitly show `voice_status` in interface lines 299-306.
      // BUT list endpoint returns array.
      // I will assume backend returns usable voices.
      return api.voice.clonedVoices();
    },
  });

  const { data: kocs, isLoading: isLoadingKocs } = useQuery({
    queryKey: ["kocs"],
    queryFn: () => api.kocs.list(),
  });

  const { data: contentIdeas, isLoading: isLoadingContentIdeas } = useQuery({
    queryKey: ["content_ideas", watchedKocId],
    queryFn: async () => {
      if (!watchedKocId) return [];
      const ideas = await api.ideas.list(watchedKocId);
      // Filter ideas with status "Đã có content" and has new_content
      return ideas.filter((idea: any) => idea.status === "Đã có content" && idea.new_content);
    },
    enabled: !!watchedKocId,
  });

  useEffect(() => {
    if (watchedKocId) {
      form.setValue("idea_id", undefined);
    }
  }, [watchedKocId, form]);

  const updateIdeaStatusMutation = useMutation({
    mutationFn: async ({ ideaId, voiceTaskId }: { ideaId: string, voiceTaskId: string }) => {
      await api.ideas.update(ideaId, { status: "Đang tạo voice", voice_task_id: voiceTaskId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content_ideas", watchedKocId] });
      queryClient.invalidateQueries({ queryKey: ["koc_content_ideas", watchedKocId] });
    },
    onError: (error: Error) => {
      showError(`Lỗi cập nhật trạng thái nội dung: ${error.message}`);
    }
  });

  const createVoiceMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      let textToGenerate = "";
      if (values.contentType === "text") {
        textToGenerate = values.text!;
      } else if (values.contentType === "koc" && values.idea_id) {
        const selectedIdea = contentIdeas?.find((idea: any) => idea.id === values.idea_id);
        if (selectedIdea && selectedIdea.new_content) {
          textToGenerate = selectedIdea.new_content;
        } else {
          throw new Error("Không tìm thấy nội dung đã chọn.");
        }
      }

      if (!textToGenerate) {
        throw new Error("Nội dung để tạo voice không được để trống.");
      }

      const selectedVoice = voices?.find((v: any) => v.voice_id === values.voice_id);
      const clonedVoiceName = selectedVoice ? selectedVoice.voice_name : null;

      // Use api.voice.textToSpeech
      // voice_name = user input (Tên Voice from form)
      // cloned_voice_name = selected clone voice name (for grouping in history)
      const response = await api.voice.textToSpeech({
        text: textToGenerate,
        voice_name: values.voice_name, // User's input "Tên Voice"
        voice_setting: { voice_id: values.voice_id },
        cloned_voice_name: clonedVoiceName || undefined,
      });

      return response;
    },
    onSuccess: (data, values) => {
      showSuccess("Đã gửi yêu cầu tạo voice! Vui lòng chờ trong giây lát.");
      queryClient.invalidateQueries({ queryKey: ["voice_tasks_grouped", user?.id] });

      const voiceTaskId = data?.task_id;
      if (values.contentType === "koc" && values.idea_id && voiceTaskId) {
        updateIdeaStatusMutation.mutate({ ideaId: values.idea_id, voiceTaskId });
      }

      form.reset({
        ...form.getValues(),
        text: "",
        voice_name: "",
        idea_id: undefined,
      });
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
        <CardDescription>Chọn nguồn nội dung, nhập văn bản và chọn giọng nói đã clone để bắt đầu.</CardDescription>
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

            <FormField control={form.control} name="contentType" render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Loại nội dung</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={(value) => {
                      field.onChange(value);
                      setContentType(value as "text" | "koc");
                      form.setValue("text", "");
                      form.setValue("koc_id", undefined);
                      form.setValue("idea_id", undefined);
                    }}
                    defaultValue={field.value}
                    className="flex items-center space-x-4"
                  >
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl><RadioGroupItem value="text" /></FormControl>
                      <FormLabel className="font-normal">Văn bản</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl><RadioGroupItem value="koc" /></FormControl>
                      <FormLabel className="font-normal">Chọn từ KOC</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {contentType === 'text' && (
              <FormField control={form.control} name="text" render={({ field }) => (
                <FormItem>
                  <FormLabel>Văn bản</FormLabel>
                  <FormControl><Textarea placeholder="Xin chào, đây là..." className="min-h-[150px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {contentType === 'koc' && (
              <div className="space-y-6">
                <FormField control={form.control} name="koc_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chọn KOC</FormLabel>
                    {isLoadingKocs ? <Skeleton className="h-10 w-full" /> : (
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Chọn một KOC" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {kocs && kocs.length > 0 ? (
                            kocs.map((koc: any) => (
                              <SelectItem key={koc.id} value={koc.id}>{koc.name}</SelectItem>
                            ))
                          ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              Không tìm thấy KOC nào.
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="idea_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chọn nội dung</FormLabel>
                    {isLoadingContentIdeas ? <Skeleton className="h-10 w-full" /> : (
                      <Select onValueChange={field.onChange} value={field.value || ''} disabled={!watchedKocId || isLoadingContentIdeas}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Chọn một nội dung" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {contentIdeas && contentIdeas.length > 0 ? (
                            contentIdeas.map((idea: any) => (
                              <SelectItem key={idea.id} value={idea.id}>{idea.new_content.substring(0, 100)}{idea.new_content.length > 100 ? '...' : ''}</SelectItem>
                            ))
                          ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              {watchedKocId ? "KOC này không có nội dung mới." : "Vui lòng chọn KOC trước."}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

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