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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Tên không được để trống"),
  model: z.string().optional(),
  word_count: z.coerce.number().positive("Số từ phải là số dương").optional(),
  tone_of_voice: z.string().optional(),
  writing_style: z.string().optional(),
  writing_method: z.string().optional(),
  ai_role: z.string().optional(),
  mandatory_requirements: z.string().optional(),
  example_dialogue: z.string().optional(),
});

type AddEditAiTemplateDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  template: { [key: string]: any } | null;
};

export const AddEditAiTemplateDialog = ({ isOpen, onOpenChange, template }: AddEditAiTemplateDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      model: "gemini-1.5-pro",
      word_count: 300,
      tone_of_voice: "",
      writing_style: "",
      writing_method: "",
      ai_role: "",
      mandatory_requirements: "",
      example_dialogue: "",
    },
  });

  useEffect(() => {
    if (template) {
      form.reset(template);
    } else {
      form.reset({
        name: "",
        model: "gemini-1.5-pro",
        word_count: 300,
        tone_of_voice: "",
        writing_style: "",
        writing_method: "",
        ai_role: "",
        mandatory_requirements: "",
        example_dialogue: "",
      });
    }
  }, [template, form, isOpen]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const dataToUpsert = { ...values, user_id: user.id };
      if (template) {
        const { error } = await supabase.from("ai_prompt_templates").update(dataToUpsert).eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_prompt_templates").insert(dataToUpsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showSuccess(`Template đã được ${template ? 'cập nhật' : 'tạo'} thành công!`);
      queryClient.invalidateQueries({ queryKey: ["ai_prompt_templates", user?.id] });
      onOpenChange(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? "Chỉnh sửa" : "Tạo mới"} Template AI</DialogTitle>
          <DialogDescription>Điền thông tin chi tiết cho prompt template của bạn.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] pr-4 -mr-4">
              <div className="space-y-4 p-1">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Tên Template</FormLabel><FormControl><Input placeholder="Ví dụ: Prompt Final" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="model" render={({ field }) => (<FormItem><FormLabel>Model AI</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Chọn model" /></SelectTrigger></FormControl><SelectContent><SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem><SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="word_count" render={({ field }) => (<FormItem><FormLabel>Số từ tối đa</FormLabel><FormControl><Input type="number" placeholder="300" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="tone_of_voice" render={({ field }) => (<FormItem><FormLabel>Tông giọng</FormLabel><FormControl><Input placeholder="Ví dụ: hài hước, chuyên nghiệp..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="writing_style" render={({ field }) => (<FormItem><FormLabel>Văn phong</FormLabel><FormControl><Textarea placeholder="Ví dụ: kể chuyện, sử dụng văn nói..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="writing_method" render={({ field }) => (<FormItem><FormLabel>Cách viết</FormLabel><FormControl><Textarea placeholder="Ví dụ: Sử dụng câu ngắn, đi thẳng vào vấn đề..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="ai_role" render={({ field }) => (<FormItem><FormLabel>Vai trò AI</FormLabel><FormControl><Textarea placeholder="Ví dụ: Đóng vai là 1 người tự quay video tiktok để nói chuyện..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="mandatory_requirements" render={({ field }) => (<FormItem><FormLabel>Yêu cầu bắt buộc</FormLabel><FormControl><Textarea placeholder="Ví dụ: Không nhắc đến đối thủ cạnh tranh..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="example_dialogue" render={({ field }) => (<FormItem><FormLabel>Lời thoại ví dụ</FormLabel><FormControl><Textarea placeholder="Ví dụ: 'Hello mọi người, lại là mình đây! Hôm nay có tin gì hot hòn họt nè...'" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </ScrollArea>
            <DialogFooter className="pt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lưu Template"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};