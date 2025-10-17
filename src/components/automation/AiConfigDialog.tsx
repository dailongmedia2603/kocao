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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  ai_prompt: z.string().min(10, "Yêu cầu phải có ít nhất 10 ký tự."),
  model: z.string().min(1, "Vui lòng chọn model."),
  max_words: z.coerce.number().positive("Số từ phải là số dương.").optional(),
});

type AiConfigDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export const AiConfigDialog = ({ isOpen, onOpenChange }: AiConfigDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ['ai_config', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ai_prompt: "",
      model: "gemini-1.5-pro-latest",
      max_words: 300,
    },
  });

  useEffect(() => {
    if (currentConfig) {
      form.reset({
        ai_prompt: currentConfig.mandatory_requirements || "",
        model: currentConfig.model || "gemini-1.5-pro-latest",
        max_words: currentConfig.word_count || 300,
      });
    }
  }, [currentConfig, form]);

  const upsertMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase.from('ai_prompt_templates').upsert({
        id: currentConfig?.id,
        user_id: user.id,
        name: 'Default Automation Prompt',
        mandatory_requirements: values.ai_prompt,
        model: values.model,
        word_count: values.max_words,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Lưu cấu hình AI thành công!");
      queryClient.invalidateQueries({ queryKey: ['ai_config', user?.id] });
      onOpenChange(false);
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    upsertMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cấu hình AI cho Automation</DialogTitle>
          <DialogDescription>Thiết lập yêu cầu mặc định cho AI khi tự động tạo kịch bản.</DialogDescription>
        </DialogHeader>
        {isLoading ? <Skeleton className="h-64 w-full" /> : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField control={form.control} name="ai_prompt" render={({ field }) => (<FormItem><FormLabel>Yêu cầu chung cho AI</FormLabel><FormControl><Textarea placeholder="Ví dụ: Tóm tắt tin tức thành kịch bản video ngắn, hài hước..." className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="model" render={({ field }) => (<FormItem><FormLabel>Model AI</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Chọn model" /></SelectTrigger></FormControl><SelectContent><SelectItem value="gemini-1.5-pro-latest">Gemini 1.5 Pro</SelectItem><SelectItem value="gemini-1.5-flash-latest">Gemini 1.5 Flash</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="max_words" render={({ field }) => (<FormItem><FormLabel>Số từ tối đa</FormLabel><FormControl><Input type="number" placeholder="300" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
                <Button type="submit" disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}</Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};