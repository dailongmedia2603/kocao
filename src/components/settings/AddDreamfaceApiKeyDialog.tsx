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
import { ScrollArea } from "../ui/scroll-area";

const formSchema = z.object({
  name: z.string().min(1, "Tên không được để trống"),
  account_id: z.string().min(1, "Account ID không được để trống"),
  user_id_dreamface: z.string().min(1, "User ID không được để trống"),
  token_id: z.string().min(1, "Token ID không được để trống"),
  client_id: z.string().min(1, "Client ID không được để trống"),
});

type AddDreamfaceApiKeyDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const AddDreamfaceApiKeyDialog = ({ isOpen, onOpenChange }: AddDreamfaceApiKeyDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", account_id: "", user_id_dreamface: "", token_id: "", client_id: "" },
  });

  const addKeyMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from("user_dreamface_api_keys")
        .insert({ 
            user_id: user.id, 
            name: values.name, 
            account_id: values.account_id,
            user_id_dreamface: values.user_id_dreamface,
            token_id: values.token_id,
            client_id: values.client_id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Thêm API Key Tạo Video thành công!");
      queryClient.invalidateQueries({ queryKey: ["dreamface_api_keys", user?.id] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => addKeyMutation.mutate(values);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Thêm API Key Tạo Video</DialogTitle>
          <DialogDescription>Nhập các thông tin xác thực để kết nối với dịch vụ tạo video.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="pt-4">
            <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Tên gợi nhớ</FormLabel><FormControl><Input placeholder="Ví dụ: Key dự án A" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="account_id" render={({ field }) => (
                    <FormItem><FormLabel>Account ID</FormLabel><FormControl><Input placeholder="Dán Account ID của bạn" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="user_id_dreamface" render={({ field }) => (
                    <FormItem><FormLabel>User ID</FormLabel><FormControl><Input placeholder="Dán User ID của bạn" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="token_id" render={({ field }) => (
                    <FormItem><FormLabel>Token ID</FormLabel><FormControl><Input placeholder="Dán Token ID của bạn" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="client_id" render={({ field }) => (
                    <FormItem><FormLabel>Client ID</FormLabel><FormControl><Input placeholder="Dán Client ID của bạn" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={addKeyMutation.isPending}>{addKeyMutation.isPending ? "Đang thêm..." : "Thêm"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};