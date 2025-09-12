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
  ai_role: z.string().optional(),
  business_field: z.string().optional(),
  writing_style: z.string().optional(),
  tone_of_voice: z.string().optional(),
  goal: z.string().optional(),
  word_count: z.coerce.number().positive("Số từ phải là số dương.").optional(),
  mandatory_requirements: z.string().optional(),
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
        ai_role: "Đóng vai là 1 người trẻ (GenZ) thường hay hoạt động tương tác như đăng bài / comment trên các nhóm cộng đồng facebook. Có sở thích sử dụng iphone và luôn mới lên đời mới nhất.",
        business_field: "Công nghệ / Iphone",
        writing_style: "Phong cách giới trẻ (GenZ), phong cách mạng xã hội, có phần trẻ trâu, nghĩa gì nói đó không có bất kì cấu trúc gì cả.",
        tone_of_voice: "Vui vẻ, hài hước, nói 1 cách tự nhiên gần gũi.",
        goal: "Viết tự nhiên như 1 người thật chứ không có dấu hiệu AI hay seeding.",
        word_count: 70,
        mandatory_requirements: "- Phải có viết tắt theo phong cách giới trẻ trên mạng xã hội.\n- Nói cụt ngũn, không chào hỏi và đi thẳng vào vấn đề\n- Xưng hô theo vùng miền miền nam\n- không có dấu câu rõ ràng\n- Có phần trẻ trâu, thẳng thắng\n- Tuyệt đối không có các câu mở đầu giả tạo như: Chời ơi, ôi, chào mọi người,...\n- Quan trọng: Iphone 17 chưa ra mắt, nên tuyệt đối không xin review ai đã dùng rồi hoặc ai đã lên rồi nhé.\n- Quan trọng: Iphone 17 thông tin gần như đã có hết rồi, nên trong nội dung không được hỏi hay nói có gì mới không nhé.",
        model: "gemini-1.5-pro-latest",
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
                <FormField control={form.control} name="ai_role" render={({ field }) => (<FormItem><FormLabel>Vai trò của bạn</FormLabel><FormControl><Textarea placeholder="Ví dụ: Đóng vai một chuyên gia marketing..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="business_field" render={({ field }) => (<FormItem><FormLabel>Lĩnh vực kinh doanh</FormLabel><FormControl><Input placeholder="Ví dụ: Công nghệ / Iphone" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="writing_style" render={({ field }) => (<FormItem><FormLabel>Phong cách</FormLabel><FormControl><Input placeholder="Ví dụ: Phong cách giới trẻ (GenZ)" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="tone_of_voice" render={({ field }) => (<FormItem><FormLabel>Tông giọng</FormLabel><FormControl><Input placeholder="Ví dụ: Hài hước, nghiêm túc" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="word_count" render={({ field }) => (<FormItem><FormLabel>Độ dài bài viết (số từ)</FormLabel><FormControl><Input type="number" placeholder="Ví dụ: 70" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="goal" render={({ field }) => (<FormItem><FormLabel>Mục tiêu cần đạt</FormLabel><FormControl><Textarea placeholder="Ví dụ: Viết tự nhiên như 1 người thật..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="mandatory_requirements" render={({ field }) => (<FormItem><FormLabel>Điều kiện bắt buộc</FormLabel><FormControl><Textarea className="min-h-[150px]" placeholder="Ví dụ: Phải có viết tắt theo phong cách giới trẻ..." {...field} /></FormControl><FormMessage /></FormItem>)} />
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