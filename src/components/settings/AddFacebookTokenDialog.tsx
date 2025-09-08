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
  name: z.string().min(1, "Tên không được để trống"),
  access_token: z.string().min(10, "Access Token không hợp lệ"),
});

type AddFacebookTokenDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const AddFacebookTokenDialog = ({ isOpen, onOpenChange }: AddFacebookTokenDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", access_token: "" },
  });

  const addTokenMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from("user_facebook_tokens")
        .insert({ user_id: user.id, name: values.name, access_token: values.access_token });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Thêm Access Token thành công!");
      queryClient.invalidateQueries({ queryKey: ["facebook_tokens", user?.id] });
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
          <DialogTitle>Thêm Access Token Facebook mới</DialogTitle>
          <DialogDescription>
            Nhập tên gợi nhớ và Access Token để kết nối với Facebook.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên gợi nhớ</FormLabel>
                  <FormControl>
                    <Input placeholder="Ví dụ: Token cho tài khoản chính" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="access_token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Facebook Access Token</FormLabel>
                  <FormControl>
                    <Input placeholder="Dán Access Token của bạn ở đây" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={addTokenMutation.isPending}>
                {addTokenMutation.isPending ? "Đang thêm..." : "Thêm Token"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};