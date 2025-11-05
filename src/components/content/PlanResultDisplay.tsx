import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentPlan } from "@/types/contentPlan";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bot, Loader2, AlertCircle, Target, ClipboardList, TrendingUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "tailwindcss/tailwind.css";
import "@tailwindcss/typography";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type PlanResultDisplayProps = {
  planId: string | null;
};

const PlanSection = ({ title, content, icon: Icon, value }: { title: string, content: string, icon: React.ElementType, value: string }) => (
  <AccordionItem value={value} className="border rounded-lg bg-white shadow-sm overflow-hidden">
    <AccordionTrigger className="p-4 hover:no-underline bg-gray-50/50">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-semibold text-left text-gray-800">{title}</h3>
      </div>
    </AccordionTrigger>
    <AccordionContent className="p-6 pt-4">
      <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-700 prose-strong:text-gray-700">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </AccordionContent>
  </AccordionItem>
);

export const PlanResultDisplay = ({ planId }: PlanResultDisplayProps) => {
  const isNew = planId === null;

  const { data: plan, isLoading, isError, error } = useQuery<ContentPlan | null>({
    queryKey: ['content_plan_detail', planId],
    queryFn: async () => {
      if (!planId) return null;
      const { data, error } = await supabase
        .from('content_plans')
        .select('*')
        .eq('id', planId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
    refetchInterval: (query) => {
      const data = query.state.data as ContentPlan | undefined;
      return data?.status === 'generating' ? 5000 : false;
    },
  });

  const parsedContent = useMemo(() => {
    const results = plan?.results as { generatedPlan?: string } | null;
    const generatedPlan = results?.generatedPlan;
    if (!generatedPlan) return { introText: null, sections: [], fallbackContent: null };

    const sections = [];
    let introText = generatedPlan;
    const sectionRegex = /\*\*PHẦN (\d+): (.*?)\*\*\n([\s\S]*?)(?=\*\*PHẦN \d+:|\s*$)/g;
    let match;
    let lastIndex = 0;

    while ((match = sectionRegex.exec(generatedPlan)) !== null) {
      if (lastIndex === 0 && match.index > 0) {
        introText = generatedPlan.substring(0, match.index).trim();
      } else if (lastIndex === 0 && match.index === 0) {
        introText = null; // No intro text if the first thing is a section
      }
      lastIndex = sectionRegex.lastIndex;

      const partNumber = match[1];
      const title = match[2].trim();
      const content = match[3].trim();

      let Icon = ClipboardList;
      if (title.includes('PHÂN TÍCH')) Icon = Target;
      if (title.includes('NỘI DUNG')) Icon = ClipboardList;
      if (title.includes('TĂNG TRƯỞNG')) Icon = TrendingUp;

      sections.push({
        title: `PHẦN ${partNumber}: ${title}`,
        content,
        Icon,
        value: `item-${partNumber}`
      });
    }

    if (sections.length === 0) {
      return { introText: null, sections: [], fallbackContent: generatedPlan };
    }

    return { introText, sections, fallbackContent: null };
  }, [plan]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Lỗi tải dữ liệu</AlertTitle>
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  if (isNew) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-96 border-2 border-dashed rounded-lg">
        <Bot className="h-12 w-12 mb-4" />
        <p className="font-semibold">Chờ bạn nhập thông tin</p>
        <p className="text-sm">Hãy điền vào biểu mẫu và bấm "Tạo kế hoạch" để xem kết quả.</p>
      </div>
    );
  }

  if (plan && (plan.status === 'generating' || !plan.results)) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-96 border-2 border-dashed rounded-lg">
        <Loader2 className="h-12 w-12 mb-4 animate-spin" />
        <p className="font-semibold">Kế hoạch đang được xử lý...</p>
        <p className="text-sm">Kết quả sẽ sớm được hiển thị ở đây. Trang sẽ tự động làm mới.</p>
      </div>
    );
  }

  if (parsedContent.fallbackContent) {
    return (
      <div className="prose prose-sm max-w-none p-4 border rounded-lg bg-background">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {parsedContent.fallbackContent}
        </ReactMarkdown>
      </div>
    );
  }

  if (parsedContent.sections.length > 0) {
    return (
      <div className="space-y-6">
        {parsedContent.introText && (
          <div className="prose prose-sm max-w-none p-4 border rounded-lg bg-background">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsedContent.introText}
            </ReactMarkdown>
          </div>
        )}
        <Accordion type="multiple" defaultValue={parsedContent.sections.map(s => s.value)} className="w-full space-y-4">
          {parsedContent.sections.map(section => (
            <PlanSection key={section.value} {...section} />
          ))}
        </Accordion>
      </div>
    );
  }

  return null;
};