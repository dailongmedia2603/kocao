import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { callVoiceApi } from "@/lib/voiceApi";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  name: z.string().min(1, "Tên chiến dịch không được để trống"),
  description: z.string().optional(),
  kocId: z.string().min(1, "Vui lòng chọn KOC"),
  clonedVoiceId: z.string().min(1, "Vui lòng chọn giọng nói"),
});

type CreateCampaignDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

type Koc = { id: string; name: string; };
type ClonedVoice = { voice_id: string; voice_name: string; };

export const CreateCampaignDialog = ({ isOpen, onOpenChange }: CreateCampaignDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const { data: kocs, isLoading: isLoadingKocs } = useQuery<Koc[]>({
    queryKey: ['kocs_for_automation', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('kocs').select('id, name').eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: voices, isLoading: isLoadingVoices } = useQuery<ClonedVoice[]>({
    queryKey: ['cloned_voices'],
    queryFn: async () => {
      const response = await callVoiceApi({ path: "v1m/voice/clone", method: "GET" });
      if (response && response.data) {
        return response.data.filter((v: any) => v.voice_status === 2);
      }
      return [];
    },
    enabled: !!user,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "" },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const selectedVoice = voices?.find(v => v.voice_id === values.clonedVoiceId);
      if (!selectedVoice) throw new Error("Giọng nói đã chọn không hợp lệ.");

      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .insert({ user_id: user.id, name: `Project for: ${values.name}` })
        .select("id")
        .single();

      if (projectError) throw new Error(`Lỗi tạo project: ${projectError.message}`);

      // Gửi dữ liệu, trigger sẽ tự động điền ai_prompt_template_id và ai_prompt
      const { error: campaignError } = await supabase.from("automation_campaigns").insert({
        user_id: user.id,
        project_id: newProject.id,
        name: values.name,
        description: values.description,
        koc_id: values.kocId,
        cloned_voice_id: values.clonedVoiceId,
        cloned_voice_name: selectedVoice.voice_name,
      });

      if (campaignError) {
        // Nếu có lỗi (ví dụ: trigger báo không tìm thấy prompt), xóa project đã tạo
        await supabase.from("projects").delete().eq("id", newProject.id);
        throw new Error(campaignError.message);
      }
    },
    onSuccess: () => {
      showSuccess("Tạo chiến dịch thành công!");
      queryClient.invalidateQueries({ queryKey: ["automation_campaigns", user?.id] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => showError(error.message),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createCampaignMutation.mutate(values);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo chiến dịch tự động mới</DialogTitle>
            <DialogDescription>Thiết lập một chiến dịch để tự động hóa quy trình làm việc của bạn.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Tên chiến dịch</FormLabel><FormControl><Input placeholder="Ví dụ: Chiến dịch tin tức hàng ngày" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Mô tả</FormLabel><FormControl><Textarea placeholder="Mô tả ngắn về mục tiêu của chiến dịch..." {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="kocId" render={({ field }) => (<FormItem><FormLabel>KOC</FormLabel>{isLoadingKocs ? <Skeleton className="h-10 w-full" /> : (<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Chọn KOC" /></SelectTrigger></FormControl><SelectContent>{kocs?.map(koc => <SelectItem key={koc.id} value={koc.id}>{koc.name}</SelectItem>)}</SelectContent></Select>)}<FormMessage /></FormItem>)} />
              <FormField control={form.control} name="clonedVoiceId" render={({ field }) => (<FormItem><FormLabel>Giọng nói</FormLabel>{isLoadingVoices ? <Skeleton className="h-10 w-full" /> : (<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Chọn giọng nói đã clone" /></SelectTrigger></FormControl><SelectContent>{voices?.map(voice => <SelectItem key={voice.voice_id} value={voice.voice_id}>{voice.voice_name}</SelectItem>)}</SelectContent></Select>)}<FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                <Button type="submit" disabled={createCampaignMutation.isPending}>{createCampaignMutation.isPending ? "Đang tạo..." : "Tạo"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};