import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentPlan } from "@/types/contentPlan";

// UI Components
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const TaoKeHoachDetail = () => {
  const { planId } = useParams<{ planId: string }>();
  const isNew = planId === 'new';
  const [isLogVisible, setIsLogVisible] = useState(false);

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

  const promptLog = plan?.results?.prompt_log;

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
        {!isNew && promptLog && (
          <Button variant="outline" onClick={() => setIsLogVisible(true)}>
            <History className="mr-2 h-4 w-4" />
            Xem Log Prompt
          </Button>
        )}
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

      <Dialog open={isLogVisible} onOpenChange={setIsLogVisible}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Nhật ký Prompt AI
            </DialogTitle>
            <DialogDescription>
              Đây là prompt đầy đủ đã được gửi đến AI để tạo kế hoạch nội dung này.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4 pr-4">
            <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-md">
              <code>{promptLog}</code>
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaoKeHoachDetail;