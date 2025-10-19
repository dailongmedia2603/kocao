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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Tên template không được để trống."),
  general_prompt: z.string().optional(),
  model: z.string().min(1, "Vui lòng chọn model AI."),
  word_count: z.coerce.number().positive("Số từ phải là số dương.").optional(),
  tone_of_voice: z.string().optional(),
  writing_style: z.string().optional(),
  writing_method: z.string().optional(),
  ai_role: z.string().optional(),
  mandatory_requirements: z.string().optional(),
  example_dialogue: z.string().optional(),
});

type PromptTemplate = {
  id: string;
  name: string;
  general_prompt?: string | null;
  model?: string | null;
  word_count?: number | null;
  tone_of_voice?: string | null;
  writing_style?: string | null;
  writing_method?: string | null;
  ai_role?: string | null;
  mandatory_requirements?: string | null;
  example_dialogue?: string | null;
};

type AddEditPromptTemplateDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  template: PromptTemplate | null;
};

export const AddEditPromptTemplateDialog = ({ isOpen, onOpenChange, template }: AddEditPromptTemplateDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      general_prompt: "",
      model: "gemini-2.5-pro",
      word_count: 300,
      tone_of_voice: "hài hước",
      writing_style: "kể chuyện, sử dụng văn nói",
      writing_method: "Sử dụng câu ngắn, đi thẳng vào vấn đề",
      ai_role: "Đóng vai là 1 người tự quay video tiktok để nói chuyện, chia sẻ tự nhiên, nghĩ gì nói đó.",
      mandatory_requirements: "",
      example_dialogue: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (template) {
        form.reset({
          name: template.name,
          general_prompt: template.general_prompt || "",
          model: template.model || "gemini-2.5-pro",
          word_count: template.word_count || 300,
          tone_of_voice: template.tone_of_voice || "",
          writing_style: template.writing_style || "",
          writing_method: template.writing_method || "",
          ai_role: template.ai_role || "",
          mandatory_requirements: template.mandatory_requirements || "",
          example_dialogue: template.example_dialogue || "",
        });
      } else {
        form.reset({
          name: "",
          general_prompt: "",
          model: "gemini-2.5-pro",
          word_count: 300,
          tone_of_voice: "hài hước",
          writing_style: "kể chuyện, sử dụng văn nói",
          writing_method: "Sử dụng câu ngắn, đi thẳng vào vấn đề",
          ai_role: "Đóng vai là 1 người tự quay video tiktok để nói chuyện, chia sẻ tự nhiên, nghĩ gì nói đó.",
          mandatory_requirements: "",
          example_dialogue: "",
        });
      }
    }
  }, [template, form, isOpen]);

  const upsertMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const payload = {
        ...values,
        id: template?.id,
        user_id: user.id,
      };
      const { error } = await supabase.from("ai_prompt_templates").upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(template ? "Cập nhật template thành công!" : "Thêm template thành công!");
      queryClient.invalidateQueries({ queryKey: ["ai_prompt_templates", user?.id] });
      onOpenChange(false);
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    upsertMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Chỉnh sửa Template" : "Tạo Template AI mới"}</DialogTitle>
          <DialogDescription>
            {template ? "Chỉnh sửa thông tin cho template prompt của bạn." : "Tạo một template mới để tái sử dụng trong các chiến dịch."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Tên Template</FormLabel><FormControl><Input placeholder="Ví dụ: Template tin tức hài hước" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="general_prompt" render={({ field }) => (<FormItem><FormLabel>Yêu cầu chung cho AI</FormLabel><FormControl><Textarea placeholder="Ví dụ: Tóm tắt lại tin tức, chỉ lấy ý chính..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="model" render={({ field }) => (<FormItem><FormLabel>Model AI</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Chọn model AI" /></SelectTrigger></FormControl><SelectContent><SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem><SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem><SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="word_count" render={({ field }) => (<FormItem><FormLabel>Số từ tối đa</FormLabel><FormControl><Input type="number" placeholder="Ví dụ: 300" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="tone_of_voice" render={({ field }) => (<FormItem><FormLabel>Tông giọng</FormLabel><FormControl><Input placeholder="Ví dụ: hài hước, chuyên nghiệp..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="writing_style" render={({ field }) => (<FormItem><FormLabel>Văn phong</FormLabel><FormControl><Textarea placeholder="Ví dụ: kể chuyện, sử dụng văn nói..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="writing_method" render={({ field }) => (<FormItem><FormLabel>Cách viết</FormLabel><FormControl><Textarea placeholder="Ví dụ: Sử dụng câu ngắn, đi thẳng vào vấn đề..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="ai_role" render={({ field }) => (<FormItem><FormLabel>Vai trò AI</FormLabel><FormControl><Textarea placeholder="Ví dụ: Đóng vai là 1 người tự quay video tiktok..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="mandatory_requirements" render={({ field }) => (<FormItem><FormLabel>Yêu cầu bắt buộc</FormLabel><FormControl><Textarea placeholder="Ví dụ: Không nhắc đến đối thủ cạnh tranh..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="example_dialogue" render={({ field }) => (<FormItem><FormLabel>Lời thoại ví dụ</FormLabel><FormControl><Textarea placeholder="Ví dụ: 'Hello mọi người, lại là mình đây!...'" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...</> : "Lưu Template"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};