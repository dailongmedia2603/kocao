import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
  channel_url: string | null;
  default_cloned_voice_id?: string | null;
};

const formSchema = z.object({
  name: z.string().min(1, "Tên KOC không được để trống"),
  field: z.string().min(1, "Lĩnh vực không được để trống"),
  channel_url: z.string().url("Link kênh không hợp lệ").optional().or(z.literal('')),
  default_cloned_voice_id: z.string().optional(),
});

type EditKocDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  koc: Koc | null;
};

type ClonedVoice = { voice_id: string; voice_name: string; };

export const EditKocDialog = ({ isOpen, onOpenChange, koc }: EditKocDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const { data: voices, isLoading: isLoadingVoices } = useQuery<ClonedVoice[]>({
    queryKey: ['cloned_voices_for_user', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('cloned_voices')
        .select('voice_id, voice_name')
        .eq('user_id', user.id);
      if (error) throw error;
      return data as ClonedVoice[];
    },
    enabled: !!user && isOpen,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", field: "", channel_url: "", default_cloned_voice_id: "" },
  });

  useEffect(() => {
    if (koc) {
      form.reset({
        name: koc.name,
        field: koc.field || "",
        channel_url: koc.channel_url || "",
        default_cloned_voice_id: koc.default_cloned_voice_id || "",
      });
    }
  }, [koc, form]);

  const editKocMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user || !koc) throw new Error("Dữ liệu không hợp lệ");

      const selectedVoice = voices?.find(v => v.voice_id === values.default_cloned_voice_id);

      const { error } = await supabase
        .from("kocs")
        .update({
          name: values.name,
          field: values.field,
          channel_url: values.channel_url || null,
          default_cloned_voice_id: selectedVoice?.voice_id || null,
          default_cloned_voice_name: selectedVoice?.voice_name || null,
        })
        .eq("id", koc.id);

      if (error) throw new Error(`Lỗi cập nhật KOC: ${error.message}`);
    },
    onSuccess: () => {
      showSuccess("Cập nhật KOC thành công!");
      queryClient.invalidateQueries({ queryKey: ["kocs", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["koc", koc?.id] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    editKocMutation.mutate(values);
  };

  if (!koc) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa KOC</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Tên KOC</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="field" render={({ field }) => (
              <FormItem><FormLabel>Lĩnh vực</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="channel_url" render={({ field }) => (
              <FormItem><FormLabel>Link Kênh</FormLabel><FormControl><Input placeholder="Ví dụ: https://www.tiktok.com/@channelname" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="default_cloned_voice_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Giọng nói mặc định</FormLabel>
                {isLoadingVoices ? <Skeleton className="h-10 w-full" /> : (
                  <Select
                    onValueChange={(value) => field.onChange(value === "__NULL__" ? undefined : value)}
                    value={field.value}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Chọn giọng nói mặc định" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__NULL__">Không chọn</SelectItem>
                      {voices?.map(voice => <SelectItem key={voice.voice_id} value={voice.voice_id}>{voice.voice_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={editKocMutation.isPending}>
                {editKocMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};