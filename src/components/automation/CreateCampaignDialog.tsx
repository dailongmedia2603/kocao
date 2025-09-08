import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { callVoiceApi } from "@/lib/voiceApi";
import { showSuccess, showError } from "@/utils/toast";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  name: z.string().min(1, "Tên chiến dịch không được để trống."),
  koc_id: z.string().min(1, "Vui lòng chọn KOC."),
  voice: z.string().min(1, "Vui lòng chọn giọng nói."),
  project_id: z.string().min(1, "Vui lòng chọn kịch bản (project)."),
  model: z.string().min(1, "Vui lòng chọn model AI."),
  max_words: z.coerce.number().positive("Số từ phải là số dương.").optional(),
  ai_prompt: z.string().min(1, "Yêu cầu cho AI không được để trống."),
});

type CreateCampaignDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const CreateCampaignDialog = ({ isOpen, onOpenChange }: CreateCampaignDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      koc_id: "",
      voice: "",
      project_id: "",
      model: "gemini-1.5-pro-latest",
      max_words: 300,
      ai_prompt: "Từ tin tức được cung cấp, hãy tạo một kịch bản video ngắn, với giọng văn hấp dẫn, phù hợp với giới trẻ trên nền tảng TikTok. Kịch bản cần có mở đầu lôi cuốn, thân bài cung cấp thông tin chính và kết thúc kêu gọi hành động.",
    },
  });

  const { data: kocs, isLoading: isLoadingKocs } = useQuery({
    queryKey: ['kocs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('kocs').select('id, name').eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: voices, isLoading: isLoadingVoices } = useQuery({
    queryKey: ['cloned_voices'],
    queryFn: async () => {
      const data = await callVoiceApi({ path: "v1m/voice/clone", method: "GET" });
      return data.data.filter((voice: any) => voice.voice_status === 2);
    },
  });

  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('projects').select('id, name').eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const selectedVoice = JSON.parse(values.voice);
      const { error } = await supabase.from("automation_campaigns").insert({
        user_id: user.id,
        name: values.name,
        koc_id: values.koc_id,
        cloned_voice_id: selectedVoice.id,
        cloned_voice_name: selectedVoice.name,
        project_id: values.project_id,
        ai_prompt: values.ai_prompt,
        model: values.model,
        max_words: values.max_words,
        status: 'paused',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Tạo chiến dịch thành công!");
      queryClient.invalidateQueries({ queryKey: ["automation_campaigns", user?.id] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createCampaignMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Tạo chiến dịch Automation mới</DialogTitle>
          <DialogDescription>Thiết lập một quy trình tự động để tạo video từ tin tức mới.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Tên chiến dịch</FormLabel><FormControl><Input placeholder="Ví dụ: Chiến dịch tin tức hàng ngày" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="koc_id" render={({ field }) => (
                <FormItem><FormLabel>Áp dụng cho KOC</FormLabel>{isLoadingKocs ? <Skeleton className="h-10 w-full" /> : <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Chọn KOC" /></SelectTrigger></FormControl><SelectContent>{kocs?.map(koc => <SelectItem key={koc.id} value={koc.id}>{koc.name}</SelectItem>)}</SelectContent></Select>}<FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="voice" render={({ field }) => (
                <FormItem><FormLabel>Sử dụng giọng nói</FormLabel>{isLoadingVoices ? <Skeleton className="h-10 w-full" /> : <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Chọn giọng nói" /></SelectTrigger></FormControl><SelectContent>{voices?.map((voice: any) => <SelectItem key={voice.voice_id} value={JSON.stringify({ id: voice.voice_id, name: voice.voice_name })}>{voice.voice_name}</SelectItem>)}</SelectContent></Select>}<FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="project_id" render={({ field }) => (
              <FormItem><FormLabel>Kịch bản Extension</FormLabel>{isLoadingProjects ? <Skeleton className="h-10 w-full" /> : <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Chọn kịch bản (project)" /></SelectTrigger></FormControl><SelectContent>{projects?.map(project => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select>}<FormMessage /></FormItem>
            )} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="model" render={({ field }) => (
                <FormItem>
                  <FormLabel>Model AI</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Chọn model AI" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="gemini-1.5-pro-latest">Gemini 1.5 Pro</SelectItem>
                      <SelectItem value="gemini-1.5-flash-latest">Gemini 1.5 Flash</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="max_words" render={({ field }) => (
                <FormItem>
                  <FormLabel>Số từ tối đa</FormLabel>
                  <FormControl><Input type="number" placeholder="Ví dụ: 300" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="ai_prompt" render={({ field }) => (
              <FormItem><FormLabel>Yêu cầu cho AI (Script Generation)</FormLabel><FormControl><Textarea className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={createCampaignMutation.isPending}>{createCampaignMutation.isPending ? "Đang tạo..." : "Tạo chiến dịch"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};