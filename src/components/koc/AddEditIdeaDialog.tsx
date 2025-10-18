import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  idea_content: z.string().min(1, "Nội dung idea không được để trống."),
  new_content: z.string().optional(),
});

type Idea = {
  id: string;
  idea_content: string;
  new_content?: string | null;
};

type AddEditIdeaDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  kocId: string;
  idea: Idea | null;
};

export const AddEditIdeaDialog = ({ isOpen, onOpenChange, kocId, idea }: AddEditIdeaDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      idea_content: "",
      new_content: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (idea) {
        form.reset({
          idea_content: idea.idea_content,
          new_content: idea.new_content || "",
        });
      } else {
        form.reset({
          idea_content: "",
          new_content: "",
        });
      }
    }
  }, [idea, form, isOpen]);

  const upsertMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");

      const payload = {
        id: idea?.id,
        koc_id: kocId,
        user_id: user.id,
        idea_content: values.idea_content,
        new_content: values.new_content,
      };

      const { error } = await supabase.from("koc_content_ideas").upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(idea ? "Cập nhật idea thành công!" : "Thêm idea thành công!");
      queryClient.invalidateQueries({ queryKey: ["koc_content_ideas", kocId] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    upsertMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{idea ? "Chỉnh sửa Idea Content" : "Thêm Idea Content mới"}</DialogTitle>
          <DialogDescription>
            {idea ? "Chỉnh sửa thông tin cho idea content của bạn." : "Thêm một idea content mới cho KOC này."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="idea_content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Idea Content</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Nhập ý tưởng content của bạn ở đây..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="new_content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content mới (Tùy chọn)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Nhập nội dung chi tiết đã phát triển từ idea..." className="min-h-[120px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};