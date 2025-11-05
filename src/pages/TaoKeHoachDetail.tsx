import { useParams, Link } from "react-router-dom";
import { ArrowLeft, History } from "lucide-react";
import { PlanInputForm } from "@/components/content/PlanInputForm";
import { PlanResultDisplay } from "@/components/content/PlanResultDisplay";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentPlan } from "@/types/contentPlan";
import { Skeleton } from "@/components/ui/skeleton";

const TaoKeHoachDetail = () => {
  const { planId } = useParams<{ planId: string }>();
  const isNew = planId === 'new';

  const { data: plan, isLoading: isLoadingPlan } = useQuery<ContentPlan | null>({
    queryKey: ['content_plan_detail', planId],
    queryFn: async () => {
      if (!planId || isNew) return null;
      const { data, error } = await supabase.from('content_plans').select('*').eq('id', planId).single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  const fullPrompt = (plan?.results as any)?.fullPrompt as string | undefined;

  return (
    <div className="p-6 lg:p-8">
      <Link to="/tao-ke-hoach" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{isNew ? "Tạo Kế Hoạch Nội Dung Mới" : "Chi Tiết Kế Hoạch"}</h1>
        <p className="text-muted-foreground mt-1">
          {isNew ? "Điền thông tin để AI phân tích và đề xuất chiến lược nội dung." : "Xem lại thông tin và kết quả phân tích của kế hoạch."}
        </p>
      </header>

      <div className="space-y-8">
        <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
          <AccordionItem value="item-1" className="border rounded-lg">
            <AccordionTrigger className="p-4 text-xl font-semibold hover:no-underline">
              1. Nhập thông tin
            </AccordionTrigger>
            <AccordionContent className="p-6 border-t">
              <PlanInputForm planId={isNew ? null : planId} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {!isNew && (isLoadingPlan ? <Skeleton className="h-20 w-full" /> : fullPrompt && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="prompt-log" className="border rounded-lg">
              <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
                <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-gray-500" />
                  <span>Xem Prompt đã gửi cho AI</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 border-t">
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md font-mono">
                  <code>{fullPrompt}</code>
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">2. Kết quả & Đề xuất</CardTitle>
            <CardDescription>Chiến lược nội dung do AI đề xuất sẽ được hiển thị ở đây.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanResultDisplay planId={isNew ? null : planId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaoKeHoachDetail;