import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  access_token: z.string().min(10, "Access Token không hợp lệ"),
  check_url: z.string().url("URL kiểm tra không hợp lệ").min(1, "URL kiểm tra không được để trống"),
});

type AddTiktokTokenDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const AddTiktokTokenDialog = ({ isOpen, onOpenChange }: AddTiktokTokenDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { access_token: "", check_url: "https://api.akng.io.vn/tiktok/user/info/" },
  });

  const addTokenMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      await api.settings.saveTiktok(values.access_token, values.check_url);
    },
    onSuccess: () => {
      showSuccess("Cập nhật Access Token thành công!");
      queryClient.invalidateQueries({ queryKey: ["tiktok_status", user?.id] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    addTokenMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cấu hình Access Token TikTok</DialogTitle>
          <DialogDescription>
            Nhập thông tin chi tiết và URL để kiểm tra kết nối cho token của bạn. Token cũ sẽ bị ghi đè.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="access_token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TikTok Access Token</FormLabel>
                  <FormControl>
                    <Input placeholder="Dán Access Token của bạn ở đây" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="check_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL Kiểm tra</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.example.com/check" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={addTokenMutation.isPending}>
                {addTokenMutation.isPending ? "Đang lưu..." : "Lưu Cấu Hình"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};