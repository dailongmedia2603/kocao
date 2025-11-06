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
import { Wand2, Loader2, User, ClipboardList, Hash, Users as UsersIcon, Smile, TrendingUp, Bot } from "lucide-react";
import { ContentPlan } from "@/types/contentPlan";

const formSchema = z.object({
  ai_model: z.enum(["gemini", "gpt"]).default("gemini"),
  koc_id: z.string().min(1, "Vui lòng chọn KOC."),
  name: z.string().min(1, "Tên kế hoạch không được để trống."),
  topic: z.string().min(1, "Chủ đề chính không được để trống."),
  target_audience: z.string().min(1, "Vui lòng mô tả đối tượng mục tiêu."),
  koc_persona: z.string().min(1, "Vui lòng mô tả chân dung KOC."),
  goals: z.string().optional(),
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
    },
  });

  useEffect(() => {
    if (plan && plan.inputs) {
      form.reset(plan.inputs as z.infer<typeof formSchema>);
    }
  }, [plan, form]);

  const createPlanMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated.");
      const selectedKoc = kocs?.find(koc => koc.id === values.koc_id);
      if (!selectedKoc) throw new Error("KOC not found.");

      const toastId = showLoading("AI đang phân tích và tạo kế hoạch...");

      try {
        const functionName = values.ai_model === 'gpt' 
          ? 'generate-content-plan-gpt' 
          : 'generate-content-plan';

        const { data: functionData, error: functionError } = await supabase.functions.invoke(functionName, {
          body: { inputs: values, kocName: selectedKoc.name }
        });

        if (functionError) throw functionError;
        if (!functionData.success) throw new Error(functionData.error);

        const { data: newPlan, error: insertError } = await supabase
          .from('content_plans')
          .insert({
            user_id: user.id,
            koc_id: values.koc_id,
            name: values.name,
            status: 'completed',
            inputs: values,
            results: functionData.results,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        dismissToast(toastId);
        showSuccess("Tạo kế hoạch thành công!");
        return newPlan;
      } catch (error) {
        dismissToast(toastId);
        showError((error as Error).message);
        throw error;
      }
    },
    onSuccess: (newPlan) => {
      queryClient.invalidateQueries({ queryKey: ['content_plans', user?.id] });
      if (newPlan) {
        navigate(`/tao-ke-hoach/${newPlan.id}`);
      }
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createPlanMutation.mutate(values);
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
                value={field.value}
                className="flex items-center space-x-4"
                disabled={!isNew}
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
                <Select onValueChange={field.onChange} value={field.value} disabled={!isNew}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Chọn một KOC" /></SelectTrigger></FormControl>
                  <SelectContent>{kocs?.map(koc => <SelectItem key={koc.id} value={koc.id}>{koc.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-blue-500" /> Tên kế hoạch</FormLabel><FormControl><Input placeholder="Ví dụ: Kế hoạch xây kênh review mỹ phẩm" {...field} disabled={!isNew} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField control={form.control} name="topic" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><Hash className="h-5 w-5 text-green-500" /> Chủ đề chính</FormLabel><FormControl><Input placeholder="Ví dụ: Review mỹ phẩm cho da dầu mụn" {...field} disabled={!isNew} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="goals" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-purple-500" /> Mục tiêu kênh (Tùy chọn)</FormLabel><FormControl><Input placeholder="Ví dụ: Đạt 10,000 followers trong 3 tháng" {...field} disabled={!isNew} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <FormField control={form.control} name="target_audience" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><UsersIcon className="h-5 w-5 text-green-500" /> Đối tượng mục tiêu</FormLabel><FormControl><Textarea placeholder="Mô tả độ tuổi, giới tính, sở thích, vấn đề họ gặp phải..." {...field} disabled={!isNew} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="koc_persona" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><Smile className="h-5 w-5 text-orange-500" /> Chân dung KOC</FormLabel><FormControl><Textarea placeholder="Mô tả tính cách, phong cách nói chuyện (hài hước, chuyên gia, gần gũi...)" {...field} disabled={!isNew} /></FormControl><FormMessage /></FormItem>)} />
        
        {isNew && (
          <Button type="submit" className="w-full" disabled={createPlanMutation.isPending}>
            {createPlanMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tạo...</> : <><Wand2 className="mr-2 h-4 w-4" /> Tạo kế hoạch bằng AI</>}
          </Button>
        )}
      </form>
    </Form>
  );
};