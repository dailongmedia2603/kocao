import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
  folder_path: string | null;
};

const formSchema = z.object({
  name: z.string().min(1, "Tên KOC không được để trống"),
  field: z.string().min(1, "Lĩnh vực không được để trống"),
  avatar_url: z.string().url("URL ảnh đại diện không hợp lệ").optional().or(z.literal('')),
});

const slugify = (text: string) => {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

type EditKocDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  koc: Koc | null;
};

export const EditKocDialog = ({ isOpen, onOpenChange, koc }: EditKocDialogProps) => {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (koc) {
      form.reset({
        name: koc.name,
        field: koc.field || "",
        avatar_url: koc.avatar_url || "",
      });
    }
  }, [koc, form, isOpen]);

  const editKocMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!koc) throw new Error("KOC không tồn tại.");

      let newFolderPath = koc.folder_path;
      const nameChanged = values.name !== koc.name;

      if (nameChanged && koc.folder_path) {
        newFolderPath = `${slugify(values.name)}-${koc.id.substring(0, 8)}`;
        const { error: renameError } = await supabase.functions.invoke("rename-r2-folder", {
          body: { oldFolderPath: koc.folder_path, newFolderPath },
        });
        if (renameError) throw new Error(`Lỗi đổi tên thư mục R2: ${renameError.message}`);
      }

      const { error: updateError } = await supabase
        .from("kocs")
        .update({
          name: values.name,
          field: values.field,
          avatar_url: values.avatar_url,
          folder_path: newFolderPath,
        })
        .eq("id", koc.id);

      if (updateError) throw new Error(`Lỗi cập nhật KOC: ${updateError.message}`);
    },
    onSuccess: () => {
      showSuccess("Cập nhật KOC thành công!");
      queryClient.invalidateQueries({ queryKey: ["kocs"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    editKocMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa KOC</DialogTitle>
          <DialogDescription>Cập nhật thông tin cho KOC. Tên thư mục trên R2 sẽ được tự động cập nhật nếu bạn đổi tên.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Tên KOC</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="field" render={({ field }) => (
              <FormItem><FormLabel>Lĩnh vực</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="avatar_url" render={({ field }) => (
              <FormItem><FormLabel>URL Ảnh đại diện</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
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