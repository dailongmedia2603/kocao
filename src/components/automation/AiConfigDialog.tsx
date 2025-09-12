import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  word_count: z.coerce.number().positive("Số từ phải là số dương.").optional(),
  writing_style: z.string().optional(),
  writing_method: z.string().optional(),
  tone_of_voice: z.string().optional(),
  ai_role: z.string().optional(),
  mandatory_requirements: z.string().optional(),
  presentation_structure: z.string().optional(),
  model: z.string().optional(),
});

type AiConfigDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const AiConfigDialog = ({ isOpen, onOpenChange }: AiConfigDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ['ai_prompt_template', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && isOpen,
  });

  useEffect(() => {
    if (config) {
      form.reset({
        word_count: config.word_count || undefined,
        writing_style: config.writing_style || "",
        writing_method: config.writing_method || "",
        tone_of_voice: config.tone_of_voice || "",
        ai_role: config.ai_role || "",
        mandatory_requirements: config.mandatory_requirements || "",
        presentation_structure: config.presentation_structure || "",
        model: config.model || "gemini-1.5-pro",
      });
    } else {
      form.reset({ model: "gemini-1.5-pro" });
    }
  }, [config, form]);

  const upsertMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from('ai_prompt_templates')
        .upsert({ ...values, user_id: user.id }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Lưu cấu hình AI thành công!");
      queryClient.invalidateQueries({ queryKey: ['ai_prompt_template', user?.id] });
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
          <DialogTitle>Cấu hình AI Prompt</DialogTitle>
          <DialogDescription>Thiết lập các thông số mặc định để AI tạo ra kịch bản chất lượng và nhất quán.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-4 pt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="word_count" render={({ field }) => (<FormItem><FormLabel>Số từ</FormLabel><FormControl><Input type="number" placeholder="Ví dụ: 300" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="tone_of_voice" render={({ field }) => (<FormItem><FormLabel>Tông giọng</FormLabel><FormControl><Input placeholder="Ví dụ: Hài hước, nghiêm túc" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <FormField control={form.control} name="model" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model AI</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Chọn model AI" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                          <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                          <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                          <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
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
                  {upsertMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...</> : "Lưu cấu hình"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};