import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  name: z.string().min(1, "Tên KOC không được để trống"),
  field: z.string().min(1, "Lĩnh vực không được để trống"),
  channel_url: z.string().url("Link kênh không hợp lệ").optional().or(z.literal('')),
  default_cloned_voice_id: z.string().optional(),
});

const slugify = (text: string) => {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

type CreateKocDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

type ClonedVoice = { voice_id: string; voice_name: string; };

export const CreateKocDialog = ({ isOpen, onOpenChange }: CreateKocDialogProps) => {
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
    defaultValues: { name: "", field: "", channel_url: "", default_cloned_voice_id: undefined },
  });

  const createKocMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");

      const selectedVoice = voices?.find(v => v.voice_id === values.default_cloned_voice_id);

      const { data: newKoc, error: dbError } = await supabase
        .from("kocs")
        .insert({ 
          user_id: user.id, 
          name: values.name, 
          field: values.field, 
          avatar_url: null,
          channel_url: values.channel_url || null,
          default_cloned_voice_id: selectedVoice?.voice_id || null,
          default_cloned_voice_name: selectedVoice?.voice_name || null,
        })
        .select("id")
        .single();

      if (dbError) {
        throw new Error(`Lỗi tạo KOC: ${dbError.message}`);
      }

      const folderPath = `${slugify(values.name)}-${newKoc.id.substring(0, 8)}`;
      
      const { error: functionError } = await supabase.functions.invoke("create-r2-folder", {
        body: { folderPath },
      });

      if (functionError) {
        await supabase.from("kocs").delete().eq("id", newKoc.id);
        throw new Error(`Lỗi tạo thư mục R2: ${functionError.message}`);
      }

      const { error: updateError } = await supabase
        .from("kocs")
        .update({ folder_path: folderPath })
        .eq("id", newKoc.id);

      if (updateError) {
        // Rollback: Attempt to delete folder and KOC record
        await supabase.functions.invoke("delete-r2-folder", { body: { folderPath } });
        await supabase.from("kocs").delete().eq("id", newKoc.id);
        throw new Error(`Lỗi cập nhật KOC: ${updateError.message}`);
      }
    },
    onSuccess: () => {
      showSuccess("Tạo KOC và thư mục trên R2 thành công!");
      queryClient.invalidateQueries({ queryKey: ["kocs", user?.id] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createKocMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo KOC mới</DialogTitle>
          <DialogDescription>
            Tạo hồ sơ quản lý KOC của bạn.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Tên KOC</FormLabel><FormControl><Input placeholder="Ví dụ: Nguyễn Văn A" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="field" render={({ field }) => (
              <FormItem><FormLabel>Lĩnh vực</FormLabel><FormControl><Input placeholder="Ví dụ: Beauty, Food,..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="channel_url" render={({ field }) => (
              <FormItem><FormLabel>Link Kênh</FormLabel><FormControl><Input placeholder="Ví dụ: https://www.tiktok.com/@channelname" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="default_cloned_voice_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Giọng nói mặc định (Tùy chọn)</FormLabel>
                {isLoadingVoices ? <Skeleton className="h-10 w-full" /> : (
                  <Select
                    onValueChange={(value) => field.onChange(value === "__NULL__" ? undefined : value)}
                    value={field.value || ""}
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
              <Button type="submit" disabled={createKocMutation.isPending || isLoadingVoices}>
                {createKocMutation.isPending ? "Đang tạo..." : "Tạo KOC"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};