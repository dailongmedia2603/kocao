import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/contexts/SessionContext";
import { useNavigate } from "react-router-dom";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { api, ContentPlan } from "@/lib/apiClient";

// UI Components
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Wand2, Loader2, User, ClipboardList, Hash, Users as UsersIcon, Smile, TrendingUp } from "lucide-react";

const formSchema = z.object({
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
    queryFn: () => api.kocs.list(),
    enabled: !!user,
  });

  const { data: plan, isLoading: isLoadingPlan } = useQuery<ContentPlan | null>({
    queryKey: ['content_plan_detail', planId],
    queryFn: async () => {
      // If planId provided, we assume it's already fetched or fetch it now
      // Note: This component is usually used inside TaoKeHoachDetail which passes inputs?
      // Actually TaoKeHoachDetail passes planId.
      // We should use api.contentPlan.get(planId)
      if (!planId) return null;
      return api.contentPlan.get(planId);
    },
    enabled: !isNew && !!user,
  });

  // Since api.ContentPlan.content has inputs, we map it back
  const planInputs = plan?.content?.inputs;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      koc_id: "",
      name: "",
      topic: "",
      target_audience: "",
      koc_persona: "",
      goals: "",
    },
  });

  useEffect(() => {
    if (planInputs) {
      form.reset(planInputs as z.infer<typeof formSchema>);
    }
  }, [planInputs, form]);

  const { data: template } = useQuery({
    queryKey: ['prompt_template', 'content_plan_gpt'],
    queryFn: async () => {
      try {
        return await api.aiTemplates.get('content_plan_gpt');
      } catch (e) {
        return null; // Fallback to default
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const createPlanMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated.");
      const selectedKoc = kocs?.find(koc => koc.id === values.koc_id);
      if (!selectedKoc) throw new Error("KOC not found.");

      const toastId = showLoading("AI đang phân tích và tạo kế hoạch...");

      try {
        // Construct Prompt from Template or Default
        let promptTemplate = template?.content;

        if (!promptTemplate) {
          promptTemplate = `
**ROLE:** You are a top-tier content strategist for TikTok.

**CONTEXT:** You are creating a content plan for a KOC named "{{KOC_NAME}}". Here is the provided information:
- **Main Topic:** {{TOPIC}}
- **Target Audience:** {{TARGET_AUDIENCE}}
- **KOC Persona (Personality & Style):** {{KOC_PERSONA}}
- **Channel Goals:** {{GOALS}}

**TASK:** Based on the context above, create a comprehensive, detailed, and easy-to-read content plan.

**OUTPUT REQUIREMENTS:**
You MUST format the output to be a valid JSON object.
Do NOT use Markdown.
Structure:
{
  "analysis": "string",
  "strategy": { "direction": "string", "tone_mood": "string" },
  "content_pillars": [ { "name": "string", "ratio": "string", "description": "string" } ],
  "schedule": "string",
  "ideas": [ { "title": "string", "format": "string", "description": "string" } ]
}
`.trim();
        }

        const prompt = promptTemplate
          .replace('{{KOC_NAME}}', selectedKoc.name)
          .replace('{{TOPIC}}', values.topic)
          .replace('{{TARGET_AUDIENCE}}', values.target_audience)
          .replace('{{KOC_PERSONA}}', values.koc_persona)
          .replace('{{GOALS}}', values.goals || 'Xây dựng thương hiệu');

        // Call AI API with provider
        const aiResponse = await api.ai.generateText(prompt, {
          provider: (template as any)?.api_provider || 'troll-llm'
        });

        if (!aiResponse.text) throw new Error("AI không trả về kết quả.");

        // Parse JSON
        let aiResults;
        try {
          // Cleanup markdown code blocks if present
          const cleanText = aiResponse.text.replace(/```json/g, '').replace(/```/g, '').trim();
          aiResults = JSON.parse(cleanText);
        } catch (e) {
          console.error("JSON Parse Error:", e, aiResponse.text);
          throw new Error("Lỗi xử lý dữ liệu từ AI.");
        }

        // Format results as expected structure
        const results = {
          success: true,
          content: aiResults,
          logs: [{
            action: 'generate_plan',
            timestamp: new Date().toISOString(),
            prompt,
            model_used: (template as any)?.api_provider || 'troll-llm'
          }]
        };

        // Create Plan via API
        const newPlan = await api.contentPlan.create({
          name: values.name,
          content: {
            type: 'plan',
            kocId: values.koc_id,
            inputs: values,
            results: results,
            ...values
          }
        });

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