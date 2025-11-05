import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useNavigate } from "react-router-dom";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

// UI Components
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Wand2, Loader2, User, ClipboardList, Hash, Users as UsersIcon, Smile, TrendingUp, Link as LinkIcon, Bot, Sparkles } from "lucide-react";
import { ContentPlan } from "@/types/contentPlan";

const formSchema = z.object({
  ai_model: z.enum(["gemini", "gpt"]).default("gemini"),
  koc_id: z.string().min(1, "Vui lòng chọn KOC."),
  name: z.string().min(1, "Tên kế hoạch không được để trống."),
  topic: z.string().min(1, "Chủ đề chính không được để trống."),
  target_audience: z.string().min(1, "Vui lòng mô tả đối tượng mục tiêu."),
  koc_persona: z.string().min(1, "Vui lòng mô tả chân dung KOC."),
  goals: z.string().optional(),
  strengths: z.string().optional(),
  competitors: z.string().optional(),
});

type PlanInputFormProps = {
  planId: string | null;
};

export const PlanInputForm = ({ planId }: PlanInputFormProps) => {
  const { user } = useSession();
  const isNew = planId === null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: kocs, isLoading: isLoadingKocs } = useQuery({
    queryKey: ['kocs_for_plan', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('kocs').select('id, name').eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: plan, isLoading: isLoadingPlan } = useQuery<ContentPlan | null>({
    queryKey: ['content_plan_detail', planId],
    queryFn: async () => {
      if (!planId) return null;
      const { data, error } = await supabase.from('content_plans').select('*').eq('id', planId).single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ai_model: "gemini",
      koc_id: "",
      name: "",
      topic: "",
      target_audience: "",
      koc_persona: "",
      goals: "",
      strengths: "",
      competitors: "",
    },
  });

  useEffect(() => {
    if (plan && plan.inputs) {
      form.reset(plan.inputs as z.infer<typeof formSchema>);
    }
  }, [plan, form]);

  const upsertPlanMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated.");
      const selectedKoc = kocs?.find(koc => koc.id === values.koc_id);
      if (!selectedKoc) throw new Error("KOC not found.");

      const toastId = showLoading(`AI đang ${isNew ? 'phân tích và tạo' : 'cập nhật'} kế hoạch...`);

      try {
        const functionName = values.ai_model === 'gpt' 
          ? 'generate-content-plan-gpt' 
          : 'generate-content-plan';

        const { data: functionData, error: functionError } = await supabase.functions.invoke(functionName, {
          body: { inputs: values, kocName: selectedKoc.name }
        });

        if (functionError) throw functionError;
        if (!functionData.success) throw new Error(functionData.error);

        const payload = {
          user_id: user.id,
          koc_id: values.koc_id,
          name: values.name,
          status: 'completed',
          inputs: values,
          results: functionData.results,
        };

        if (isNew) {
          const { data: newPlan, error: insertError } = await supabase
            .from('content_plans')
            .insert(payload)
            .select('id')
            .single();
          if (insertError) throw insertError;
          return { newPlanId: newPlan.id };
        } else {
          const { error: updateError } = await supabase
            .from('content_plans')
            .update(payload)
            .eq('id', planId!);
          if (updateError) throw updateError;
          return { newPlanId: null };
        }
      } catch (error) {
        dismissToast(toastId);
        showError((error as Error).message);
        throw error;
      }
    },
    onSuccess: ({ newPlanId }) => {
      const message = isNew ? "Tạo kế hoạch thành công!" : "Cập nhật kế hoạch thành công!";
      showSuccess(message);
      queryClient.invalidateQueries({ queryKey: ['content_plans', user?.id] });
      if (isNew && newPlanId) {
        navigate(`/tao-ke-hoach/${newPlanId}`);
      } else {
        queryClient.invalidateQueries({ queryKey: ['content_plan_detail', planId] });
      }
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    upsertPlanMutation.mutate(values);
  };

  if (isLoadingPlan) {
    return <Skeleton className="h-[700px] w-full" />;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="ai_model" render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2"><Bot className="h-5 w-5 text-blue-500" /> Chọn AI</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                defaultValue={field.value}
                className="flex items-center space-x-4"
              >
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl><RadioGroupItem value="gemini" /></FormControl>
                  <FormLabel className="font-normal">Gemini</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl><RadioGroupItem value="gpt" /></FormControl>
                  <FormLabel className="font-normal">GPT</FormLabel>
                </FormItem>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField control={form.control} name="koc_id" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2"><User className="h-5 w-5 text-blue-500" /> Dành cho KOC</FormLabel>
              {isLoadingKocs ? <Skeleton className="h-10 w-full" /> : (
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Chọn một KOC" /></SelectTrigger></FormControl>
                  <SelectContent>{kocs?.map(koc => <SelectItem key={koc.id} value={koc.id}>{koc.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-blue-500" /> Tên kế hoạch</FormLabel><FormControl><Input placeholder="Ví dụ: Kế hoạch xây kênh review mỹ phẩm" {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <FormField control={form.control} name="topic" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><Hash className="h-5 w-5 text-green-500" /> Lĩnh vực hoạt động/Chủ đề chính</FormLabel><FormControl><Input placeholder="Ví dụ: Marketing Online, Đầu tư Chứng khoán, Chăm sóc da..." {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="target_audience" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><UsersIcon className="h-5 w-5 text-green-500" /> Đối tượng người xem</FormLabel><FormControl><Textarea placeholder="Mô tả độ tuổi, giới tính, sở thích, vấn đề họ gặp phải..." {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="koc_persona" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><Smile className="h-5 w-5 text-orange-500" /> Tính cách/Phong cách của KOC</FormLabel><FormControl><Textarea placeholder="Ví dụ: Hài hước, gần gũi; Chuyên nghiệp, điềm đạm; Năng động, truyền cảm hứng..." {...field} /></FormControl><FormMessage /></FormItem>)} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField control={form.control} name="goals" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-purple-500" /> Mục tiêu chính (Tùy chọn)</FormLabel><FormControl><Input placeholder="Ví dụ: Tăng follow, bán sản phẩm, xây dựng thương hiệu cá nhân..." {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="strengths" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-500" /> Điểm mạnh/Độc đáo (Tùy chọn)</FormLabel><FormControl><Input placeholder="Ví dụ: 10 năm kinh nghiệm, sản phẩm thủ công..." {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <FormField control={form.control} name="competitors" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><LinkIcon className="h-5 w-5 text-purple-500" /> Kênh tham khảo (Tùy chọn)</FormLabel><FormControl><Textarea placeholder="Liệt kê một vài tên kênh TikTok đối thủ hoặc kênh bạn muốn học hỏi" {...field} /></FormControl><FormMessage /></FormItem>)} />
        
        <Button type="submit" className="w-full" disabled={upsertPlanMutation.isPending}>
          {isNew ? (
              upsertPlanMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tạo...</> : <><Wand2 className="mr-2 h-4 w-4" /> Tạo kế hoạch bằng AI</>
          ) : (
              upsertPlanMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang cập nhật...</> : <><Wand2 className="mr-2 h-4 w-4" /> Cập nhật với AI</>
          )}
        </Button>
      </form>
    </Form>
  );
};