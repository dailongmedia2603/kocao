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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  name: z.string().min(1, "Tên mẫu không được để trống."),
  word_count: z.coerce.number().positive("Số từ phải là số dương.").optional(),
  writing_style: z.string().optional(),
  writing_method: z.string().optional(),
  tone_of_voice: z.string().optional(),
  ai_role: z.string().optional(),
  mandatory_requirements: z.string().optional(),
  presentation_structure: z.string().optional(),
  model: z.string().optional(),
});

type Template = z.infer<typeof formSchema> & { id?: string };

type CreateOrEditPromptTemplateDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  template?: Template | null;
};

export const CreateOrEditPromptTemplateDialog = ({ isOpen, onOpenChange, template }: CreateOrEditPromptTemplateDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (template) {
      form.reset(template);
    } else {
      form.reset({
        name: "",
        word_count: 300,
        model: "gemini-1.5-pro-latest",
        writing_style: "",
        writing_method: "",
        tone_of_voice: "",
        ai_role: "",
        mandatory_requirements: "",
        presentation_structure: "",
      });
    }
  }, [template, form, isOpen]);

  const upsertMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const upsertData = {
        ...(template?.id && { id: template.id }),
        user_id: user.id,
        ...values,
      };
      const { error } = await supabase.from('ai_prompt_templates').upsert(upsertData);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(`Đã ${template ? 'cập nhật' : 'tạo'} mẫu thành công!`);
      queryClient.invalidateQueries({ queryKey: ['ai_prompt_templates', user?.id] });
      onOpenChange(false);
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    upsertMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>{template ? "Chỉnh sửa mẫu Prompt" : "Tạo mẫu Prompt mới"}</DialogTitle>
          <DialogDescription>Tùy chỉnh các thông số để AI tạo ra kịch bản chất lượng và nhất quán.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Tên mẫu</FormLabel><FormControl><Input placeholder="Ví dụ: Mẫu tin tức TikTok" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="word_count" render={({ field }) => (<FormItem><FormLabel>Số từ</FormLabel><FormControl><Input type="number" placeholder="Ví dụ: 300" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="tone_of_voice" render={({ field }) => (<FormItem><FormLabel>Tông giọng</FormLabel><FormControl><Input placeholder="Ví dụ: Hài hước, nghiêm túc" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="model" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model AI</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Chọn model AI" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="gemini-1.5-pro-latest">Gemini 1.5 Pro</SelectItem>
                        <SelectItem value="gemini-1.5-flash-latest">Gemini 1.5 Flash</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="writing_style" render={({ field }) => (<FormItem><FormLabel>Văn phong</FormLabel><FormControl><Textarea placeholder="Ví dụ: Trẻ trung, chuyên nghiệp, kể chuyện..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="writing_method" render={({ field }) => (<FormItem><FormLabel>Cách viết</FormLabel><FormControl><Textarea placeholder="Ví dụ: Sử dụng câu ngắn, đi thẳng vào vấn đề..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="ai_role" render={({ field }) => (<FormItem><FormLabel>Vai trò AI</FormLabel><FormControl><Textarea placeholder="Ví dụ: Đóng vai một chuyên gia marketing..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="mandatory_requirements" render={({ field }) => (<FormItem><FormLabel>Yêu cầu bắt buộc</FormLabel><FormControl><Textarea placeholder="Ví dụ: Luôn có câu kêu gọi hành động ở cuối..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="presentation_structure" render={({ field }) => (<FormItem><FormLabel>Cấu trúc trình bày</FormLabel><FormControl><Textarea placeholder="Ví dụ: Mở đầu (3 giây), Thân bài (20 giây), Kết bài (5 giây)..." {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...</> : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};