import { useState } from "react";
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
import { Copy, Check } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Tên không được để trống"),
});

type CreateExtensionDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const CreateExtensionDialog = ({ isOpen, onOpenChange }: CreateExtensionDialogProps) => {
  const [newExtensionId, setNewExtensionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const { data, error } = await supabase
        .from("extension_instances")
        .insert({ name: values.name, user_id: user.id })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess("Tạo Extension thành công!");
      queryClient.invalidateQueries({ queryKey: ["extensions"] });
      setNewExtensionId(data.id);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate(values);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after a delay to allow for closing animation
    setTimeout(() => {
      form.reset();
      setNewExtensionId(null);
      setCopied(false);
    }, 300);
  };

  const handleCopy = () => {
    if (!newExtensionId) return;
    navigator.clipboard.writeText(newExtensionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{newExtensionId ? "Mã kết nối Extension" : "Thêm Extension mới"}</DialogTitle>
          <DialogDescription>
            {newExtensionId
              ? "Sao chép mã này và dán vào cài đặt Extension trên trình duyệt của bạn."
              : "Đặt tên cho kết nối Extension mới để dễ dàng nhận biết (ví dụ: Chrome máy tính công ty)."}
          </DialogDescription>
        </DialogHeader>
        {newExtensionId ? (
          <div className="pt-4">
            <div className="flex items-center gap-2">
              <Input readOnly value={newExtensionId} className="font-mono" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter className="mt-4">
              <Button onClick={handleClose}>Đã hiểu</Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên Extension</FormLabel>
                    <FormControl>
                      <Input placeholder="Ví dụ: Chrome máy tính công ty" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>Hủy</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Đang tạo..." : "Tạo"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};