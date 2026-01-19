import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ContentPlan, api } from "@/lib/apiClient";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

// UI Components
import { ArrowLeft, History, RefreshCw, Loader2, PencilLine, Sparkles } from "lucide-react";
import { PlanInputForm } from "@/components/content/PlanInputForm";
import { PlanResultDisplay } from "@/components/content/PlanResultDisplay";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const TaoKeHoachDetail = () => {
  const { planId } = useParams<{ planId: string }>();
  const isNew = planId === 'new';
  const [isLogVisible, setIsLogVisible] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useSession();

  const { data: plan } = useQuery<ContentPlan | null>({
    queryKey: ['content_plan_detail', planId],
    queryFn: async () => {
      if (!planId) return null;
      return api.contentPlan.get(planId);
    },
    enabled: !isNew && !!planId,
  });

  const { data: template } = useQuery({
    queryKey: ['prompt_template', 'content_plan_gpt'],
    queryFn: async () => {
      try {
        return await api.aiTemplates.get('content_plan_gpt');
      } catch (e) {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!plan || !plan.content?.inputs || !user) {
        throw new Error("Dữ liệu kế hoạch không đầy đủ để tạo lại.");
      }

      const kocId = plan.content.kocId || plan.content.koc_id;
      if (!kocId) throw new Error("Không tìm thấy KOC ID trong kế hoạch.");

      // Fetch KOC name
      const koc = await api.kocs.get(kocId);
      if (!koc) throw new Error("Không tìm thấy KOC liên quan đến kế hoạch này.");

      const toastId = showLoading("AI đang phân tích và tạo lại kế hoạch...");

      try {
        const values = plan.content.inputs;

        // Construct Prompt
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
          .replace('{{KOC_NAME}}', koc.name)
          .replace('{{TOPIC}}', values.topic)
          .replace('{{TARGET_AUDIENCE}}', values.target_audience)
          .replace('{{KOC_PERSONA}}', values.koc_persona)
          .replace('{{GOALS}}', values.goals || 'Xây dựng thương hiệu');

        // Call AI API
        const aiResponse = await api.ai.generateText(prompt, {
          provider: (template as any)?.api_provider || 'troll-llm'
        });

        if (!aiResponse.text) throw new Error("AI không trả về kết quả.");

        // Parse JSON
        let aiResults;
        try {
          const cleanText = aiResponse.text.replace(/```json/g, '').replace(/```/g, '').trim();
          aiResults = JSON.parse(cleanText);
        } catch (e) {
          console.error("JSON Parse Error:", e, aiResponse.text);
          throw new Error("Lỗi xử lý dữ liệu từ AI.");
        }

        const newContent = aiResults;

        const newLogEntry = {
          action: 'regenerate',
          timestamp: new Date().toISOString(),
          prompt: prompt,
          model_used: (template as any)?.api_provider || 'troll-llm'
        };

        const oldLogs = plan.content.results?.logs || [];
        const combinedLogs = [...oldLogs, newLogEntry];

        const updatedResults = {
          ...plan.content.results,
          content: newContent,
          logs: combinedLogs,
        };

        // Update plan via API
        await api.contentPlan.update(plan.id, {
          status: 'completed',
          content: {
            ...plan.content,
            results: updatedResults
          }
        });

        dismissToast(toastId);
        showSuccess("Tạo lại kế hoạch thành công!");
      } catch (error) {
        dismissToast(toastId);
        showError((error as Error).message);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_plan_detail', planId] });
    },
  });

  const generateMoreIdeasMutation = useMutation({
    mutationFn: async () => {
      if (!planId || !plan) throw new Error("Dữ liệu kế hoạch không đầy đủ.");

      const toastId = showLoading("AI đang tạo thêm ý tưởng...");
      try {
        await api.contentPlan.generateMoreIdeas(planId);

        dismissToast(toastId);
        showSuccess("Đã tạo thêm 10 ý tưởng mới!");
      } catch (error) {
        dismissToast(toastId);
        showError(`Lỗi: ${(error as Error).message}`);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_plan_detail', planId] });
    },
  });

  const logs = plan?.content?.results?.logs || [];

  return (
    <div className="p-6 lg:p-8">
      <Link to="/tao-ke-hoach" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách
      </Link>
      <header className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{isNew ? "Tạo Kế Hoạch Nội Dung Mới" : "Chi Tiết Kế Hoạch"}</h1>
          <p className="text-muted-foreground mt-1">
            {isNew ? "Điền thông tin để AI phân tích và đề xuất chiến lược nội dung." : "Xem lại thông tin và kết quả phân tích của kế hoạch."}
          </p>
        </div>
        {!isNew && (
          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <Button variant="outline" onClick={() => setIsLogVisible(true)}>
                <History className="mr-2 h-4 w-4" />
                Xem Log Prompt
              </Button>
            )}
            <Button onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
              {regenerateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Tạo lại
            </Button>
          </div>
        )}
      </header>

      <div className="space-y-8">
        <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
          <AccordionItem value="item-1" className="border rounded-lg">
            <AccordionTrigger className="p-4 text-xl font-semibold hover:no-underline">
              <div className="flex items-center gap-3">
                <PencilLine className="h-6 w-6 text-blue-500" />
                1. Nhập thông tin
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-6 border-t">
              <PlanInputForm planId={isNew ? null : planId} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-purple-500" />
              2. Kết quả & Đề xuất
            </CardTitle>
            <CardDescription>Chiến lược nội dung do AI đề xuất sẽ được hiển thị ở đây.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanResultDisplay
              planId={isNew ? null : planId}
              onGenerateMore={() => generateMoreIdeasMutation.mutate()}
              isGeneratingMore={generateMoreIdeasMutation.isPending}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={isLogVisible} onOpenChange={setIsLogVisible}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Nhật ký Prompt AI
            </DialogTitle>
            <DialogDescription>
              Lịch sử các prompt đã được gửi đến AI để tạo kế hoạch nội dung này.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4 pr-4">
            {logs.length > 0 ? (
              <Accordion type="single" collapsible className="w-full space-y-2">
                {logs.slice().reverse().map((log: any, index: number) => (
                  <AccordionItem value={`item-${index}`} key={index} className="border rounded-lg">
                    <AccordionTrigger className="p-4 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{log.model_used || 'N/A'}</Badge>
                          <span className="font-medium text-sm capitalize">{log.action.replace('_', ' ')}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm", { locale: vi })}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border-t">
                      <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-md">
                        <code>{log.prompt}</code>
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <p className="text-center text-muted-foreground py-8">Không có log nào để hiển thị.</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaoKeHoachDetail;