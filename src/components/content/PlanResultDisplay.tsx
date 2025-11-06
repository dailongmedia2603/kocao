import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentPlan } from "@/types/contentPlan";
import ReactMarkdown from "react-markdown";
import { parseContentPlan } from "@/lib/contentPlanParser";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

// Icons
import { Bot, Loader2, AlertCircle, Target, Columns, Calendar, Lightbulb, Sparkles } from "lucide-react";

type PlanResultDisplayProps = {
  planId: string | null;
  onGenerateMore: () => void;
  isGeneratingMore: boolean;
};

export const PlanResultDisplay = ({ planId, onGenerateMore, isGeneratingMore }: PlanResultDisplayProps) => {
  const isNew = planId === null;

  const { data: plan, isLoading, isError, error } = useQuery<ContentPlan | null>({
    queryKey: ['content_plan_detail', planId],
    queryFn: async () => {
      if (!planId) return null;
      const { data, error } = await supabase.from('content_plans').select('*').eq('id', planId).single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  const parsedContent = useMemo(() => {
    if (plan?.results?.content) {
      try {
        return parseContentPlan(plan.results.content);
      } catch (e) {
        console.error("Failed to parse content plan:", e);
        return null;
      }
    }
    return null;
  }, [plan?.results?.content]);

  const allIdeas = useMemo(() => {
    const initialIdeas = parsedContent?.ideas.map(idea => ({
      title: idea.title,
      script: idea.script,
    })) || [];

    const additionalIdeas = (plan?.results?.video_ideas || []).map((idea: any) => ({
      title: idea.topic,
      script: idea.description,
    }));

    return [...initialIdeas, ...additionalIdeas];
  }, [parsedContent, plan?.results?.video_ideas]);

  const renderContent = () => {
    if (isLoading) {
      return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>;
    }

    if (isError) {
      return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Lỗi tải dữ liệu</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert>;
    }

    if (isNew) {
      return <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-96 border-2 border-dashed rounded-lg"><Bot className="h-12 w-12 mb-4" /><p className="font-semibold">Chờ bạn nhập thông tin</p><p className="text-sm">Hãy điền vào biểu mẫu và bấm "Tạo kế hoạch" để xem kết quả.</p></div>;
    }

    if (plan && (plan.status === 'generating' || !parsedContent)) {
      return <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-96 border-2 border-dashed rounded-lg"><Loader2 className="h-12 w-12 mb-4 animate-spin" /><p className="font-semibold">Kế hoạch đang được xử lý...</p><p className="text-sm">Kết quả sẽ sớm được hiển thị ở đây.</p></div>;
    }

    if (parsedContent) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">{parsedContent.title}</h2>
          
          <Card><CardHeader><CardTitle className="flex items-center gap-3"><Target className="h-6 w-6 text-blue-500" />Chiến lược tổng thể</CardTitle></CardHeader><CardContent><article className="prose prose-sm max-w-none"><ReactMarkdown>{parsedContent.strategy}</ReactMarkdown></article></CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-3"><Columns className="h-6 w-6 text-green-500" />Các trụ cột nội dung chính</CardTitle></CardHeader><CardContent><Accordion type="single" collapsible className="w-full space-y-2">{parsedContent.pillars.map((pillar, index) => (<AccordionItem value={`pillar-${index}`} key={index} className="border rounded-lg"><AccordionTrigger className="p-4 font-semibold hover:no-underline">{pillar.title}</AccordionTrigger><AccordionContent className="p-4 border-t"><article className="prose prose-sm max-w-none"><ReactMarkdown>{pillar.content}</ReactMarkdown></article></AccordionContent></AccordionItem>))}</Accordion></CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-3"><Calendar className="h-6 w-6 text-orange-500" />Lịch đăng đề xuất</CardTitle></CardHeader><CardContent><article className="prose prose-sm max-w-none"><ReactMarkdown>{parsedContent.schedule}</ReactMarkdown></article></CardContent></Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <Lightbulb className="h-6 w-6 text-purple-500" />
                Chủ đề video chi tiết ({allIdeas.length})
              </CardTitle>
              <Button onClick={onGenerateMore} disabled={isGeneratingMore}>
                {isGeneratingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Tạo thêm 10 idea
              </Button>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full space-y-2">
                {allIdeas.map((idea, index) => (
                  <AccordionItem value={`idea-${index}`} key={index} className="border rounded-lg">
                    <AccordionTrigger className="p-4 font-semibold text-left hover:no-underline">{idea.title}</AccordionTrigger>
                    <AccordionContent className="p-4 border-t">
                      <article className="prose prose-sm max-w-none"><ReactMarkdown>{idea.script}</ReactMarkdown></article>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      );
    }

    return null;
  };

  return <div>{renderContent()}</div>;
};