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

const formSchema = z.object({
  name: z.string().min(1, "Tên KOC không được để trống"),
  field: z.string().min(1, "Lĩnh vực không được để trống"),
  avatar_url: z.string().url("URL ảnh đại diện không hợp lệ").optional().or(z.literal('')),
});

type CreateKocDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const CreateKocDialog = ({ isOpen, onOpenChange }: CreateKocDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", field: "", avatar_url: "" },
  });

  const createKocMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");

      // Bước 1: Tạo KOC trong database và lấy về ID
      const { data: newKoc, error: dbError } = await supabase
        .from("kocs")
        .insert({ user_id: user.id, ...values })
        .select("id")
        .single();

      if (dbError) {
        throw new Error(`Lỗi tạo KOC trong database: ${dbError.message}`);
      }

      // Bước 2: Gọi Edge Function để tạo thư mục trên R2
      const { error: functionError } = await supabase.functions.invoke("create-r2-folder", {
        body: { kocId: newKoc.id },
      });

      if (functionError) {
        // Nếu tạo thư mục lỗi, thông báo cho người dùng biết
        // KOC vẫn được tạo thành công trong DB
        throw new Error(`Tạo KOC thành công, nhưng không thể tạo thư mục trên R2: ${functionError.message}. Vui lòng tạo thư mục thủ công với ID: ${newKoc.id}`);
      }

      return newKoc;
    },
    onSuccess: () => {
      showSuccess("Tạo KOC và thư mục trên R2 thành công!");
      queryClient.invalidateQueries({ queryKey: ["kocs", user?.id] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      // Hiển thị lỗi đã được tùy chỉnh ở trên
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
            Thêm một KOC vào danh sách quản lý của bạn. Một thư mục tương ứng sẽ được tạo trên Cloudflare R2.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Tên KOC</FormLabel>
                <FormControl><Input placeholder="Ví dụ: Nguyễn Văn A" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="field" render={({ field }) => (
              <FormItem>
                <FormLabel>Lĩnh vực</FormLabel>
                <FormControl><Input placeholder="Ví dụ: Beauty, Food,..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="avatar_url" render={({ field }) => (
              <FormItem>
                <FormLabel>URL Ảnh đại diện</FormLabel>
                <FormControl><Input placeholder="https://example.com/avatar.png" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
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