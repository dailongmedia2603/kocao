import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageUploadInput } from "./ImageUploadInput";

const formSchema = z.object({
  name: z.string().min(1, "Tên KOC không được để trống"),
  field: z.string().min(1, "Lĩnh vực không được để trống"),
  channel_url: z.string().url("Link kênh không hợp lệ").optional().or(z.literal('')),
  avatar_file: z.instanceof(FileList).optional(),
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

export const CreateKocDialog = ({ isOpen, onOpenChange }: CreateKocDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", field: "", channel_url: "" },
  });

  const createKocMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");

      let avatarUrl: string | null = null;
      const avatarFile = values.avatar_file?.[0];

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('koc_avatars')
          .upload(filePath, avatarFile);

        if (uploadError) throw new Error(`Lỗi tải ảnh lên: ${uploadError.message}`);

        const { data: urlData } = supabase.storage.from('koc_avatars').getPublicUrl(filePath);
        avatarUrl = urlData.publicUrl;
      }

      const { data: newKoc, error: dbError } = await supabase
        .from("kocs")
        .insert({ 
          user_id: user.id, 
          name: values.name, 
          field: values.field, 
          avatar_url: avatarUrl,
          channel_url: values.channel_url || null 
        })
        .select("id")
        .single();

      if (dbError) {
        if (avatarUrl) {
          const filePath = avatarUrl.split('/').slice(-2).join('/');
          await supabase.storage.from('koc_avatars').remove([filePath]);
        }
        throw new Error(`Lỗi tạo KOC: ${dbError.message}`);
      }

      const folderPath = `${slugify(values.name)}-${newKoc.id.substring(0, 8)}`;
      
      const { error: functionError } = await supabase.functions.invoke("create-r2-folder", {
        body: { folderPath },
      });

      if (functionError) {
        await supabase.from("kocs").delete().eq("id", newKoc.id);
        if (avatarUrl) {
          const filePath = avatarUrl.split('/').slice(-2).join('/');
          await supabase.storage.from('koc_avatars').remove([filePath]);
        }
        throw new Error(`Lỗi tạo thư mục R2: ${functionError.message}`);
      }

      const { error: updateError } = await supabase
        .from("kocs")
        .update({ folder_path: folderPath })
        .eq("id", newKoc.id);

      if (updateError) {
        await supabase.functions.invoke("delete-r2-folder", { body: { folderPath } });
        await supabase.from("kocs").delete().eq("id", newKoc.id);
        if (avatarUrl) {
          const filePath = avatarUrl.split('/').slice(-2).join('/');
          await supabase.storage.from('koc_avatars').remove([filePath]);
        }
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
            Một thư mục tương ứng sẽ được tạo trên Cloudflare R2.
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
            <ImageUploadInput form={form} name="avatar_file" label="Ảnh đại diện" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={createKocMutation.isPending}>
                {createKocMutation.isPending ? "Đang tạo..." : "Tạo KOC"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};