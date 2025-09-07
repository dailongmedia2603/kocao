import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageUploadInput } from "./ImageUploadInput";

type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
  channel_url: string | null;
};

const formSchema = z.object({
  name: z.string().min(1, "Tên KOC không được để trống"),
  field: z.string().min(1, "Lĩnh vực không được để trống"),
  channel_url: z.string().url("Link kênh không hợp lệ").optional().or(z.literal('')),
  avatar_file: z.instanceof(FileList).optional(),
});

type EditKocDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  koc: Koc | null;
};

export const EditKocDialog = ({ isOpen, onOpenChange, koc }: EditKocDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", field: "", channel_url: "" },
  });

  useEffect(() => {
    if (koc) {
      form.reset({
        name: koc.name,
        field: koc.field || "",
        channel_url: koc.channel_url || "",
      });
    }
  }, [koc, form]);

  const editKocMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user || !koc) throw new Error("Dữ liệu không hợp lệ");

      let newAvatarUrl = koc.avatar_url;
      const avatarFile = values.avatar_file?.[0];

      if (avatarFile) {
        if (koc.avatar_url) {
          const oldFilePath = koc.avatar_url.split('/koc_avatars/')[1];
          if (oldFilePath) {
            await supabase.storage.from('koc_avatars').remove([oldFilePath]);
          }
        }

        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('koc_avatars')
          .upload(filePath, avatarFile);

        if (uploadError) throw new Error(`Lỗi tải ảnh lên: ${uploadError.message}`);

        const { data: urlData } = supabase.storage.from('koc_avatars').getPublicUrl(filePath);
        newAvatarUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("kocs")
        .update({
          name: values.name,
          field: values.field,
          channel_url: values.channel_url || null,
          avatar_url: newAvatarUrl,
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
            <ImageUploadInput form={form} name="avatar_file" label="Ảnh đại diện" initialImageUrl={koc.avatar_url} />
            <DialogFooter>
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