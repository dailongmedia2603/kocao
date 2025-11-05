import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentPlan } from "@/types/contentPlan";
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
      const { data, error } = await supabase.from('content_plans').select('*').eq('id', planId).single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (!plan || !plan.inputs || !user) {
        throw new Error("Dữ liệu kế hoạch không đầy đủ để tạo lại.");
      }
      const { data: koc, error: kocError } = await supabase.from('kocs').select('name').eq('id', plan.koc_id).single();
      if (kocError || !koc) throw new Error("Không tìm thấy KOC liên quan đến kế hoạch này.");

      const toastId = showLoading("AI đang phân tích và tạo lại kế hoạch...");

      try {
        const functionName = (plan.inputs as any).ai_model === 'gpt' ? 'generate-content-plan-gpt' : 'generate-content-plan';
        const { data: functionData, error: functionError } = await supabase.functions.invoke(functionName, {
          body: { inputs: plan.inputs, kocName: koc.name }
        });

        if (functionError) throw functionError;
        if (!functionData.success) throw new Error(functionData.error);

        const newResults = functionData.results;
        const newLogEntry = newResults.logs[0];
        newLogEntry.action = 'regenerate';
        newLogEntry.timestamp = new Date().toISOString();

        const oldLogs = plan.results?.logs || [];
        const combinedLogs = [...oldLogs, newLogEntry];

        const updatedResults = { ...newResults, logs: combinedLogs };

        const { error: updateError } = await supabase.from('content_plans').update({ results: updatedResults, status: 'completed' }).eq('id', plan.id);
        if (updateError) throw updateError;

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

  const logs = plan?.results?.logs || [];

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
            <PlanResultDisplay planId={isNew ? null : planId} />
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