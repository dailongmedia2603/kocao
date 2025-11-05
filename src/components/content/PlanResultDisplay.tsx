import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentPlan } from "@/types/contentPlan";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Icons
import { Bot, Loader2, ClipboardCheck, ListVideo, CalendarClock, Lightbulb, AlertCircle } from "lucide-react";

type PlanResultDisplayProps = {
  planId: string | null;
};

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
  });

  const results = plan?.results;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-6 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-6 w-1/5" />
          <Skeleton className="h-32 w-full" />
        </div>
      );
    }

    if (isError) {
      return (
        <Alert variant="destructive" className="m-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Lỗi tải dữ liệu</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      );
    }

    if (isNew) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-96 border-2 border-dashed rounded-lg m-6">
          <Bot className="h-12 w-12 mb-4" />
          <p className="font-semibold">Chờ bạn nhập thông tin</p>
          <p className="text-sm">Hãy điền vào biểu mẫu bên cạnh và bấm "Tạo kế hoạch" để xem kết quả.</p>
        </div>
      );
    }

    if (plan && !results) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-96 border-2 border-dashed rounded-lg m-6">
          <Loader2 className="h-12 w-12 mb-4 animate-spin" />
          <p className="font-semibold">Kế hoạch đang được xử lý...</p>
          <p className="text-sm">Kết quả sẽ sớm được hiển thị ở đây.</p>
        </div>
      );
    }

    if (plan && results) {
      return (
        <div className="space-y-8">
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-2"><ClipboardCheck className="h-5 w-5 text-blue-500" /> Chiến lược tổng thể</h3>
            <p className="text-sm text-muted-foreground bg-muted p-4 rounded-md">{results.overall_strategy}</p>
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-2"><ListVideo className="h-5 w-5 text-green-500" /> Trụ cột nội dung</h3>
            <div className="flex flex-wrap gap-2">
              {results.content_pillars.map((pillar: string) => <Badge key={pillar} variant="secondary" className="text-base py-1 px-3">{pillar}</Badge>)}
            </div>
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-2"><CalendarClock className="h-5 w-5 text-orange-500" /> Lịch đăng đề xuất</h3>
            <Table>
              <TableHeader><TableRow><TableHead>Giai đoạn</TableHead><TableHead>Tần suất</TableHead><TableHead>Ghi chú</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Triển khai</TableCell>
                  <TableCell>{results.posting_schedule.launch_phase.videos_per_day} video/ngày</TableCell>
                  <TableCell className="text-xs">{results.posting_schedule.launch_phase.notes}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Duy trì</TableCell>
                  <TableCell>{results.posting_schedule.maintenance_phase.videos_per_week} video/tuần</TableCell>
                  <TableCell className="text-xs">{results.posting_schedule.maintenance_phase.notes}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-2"><Lightbulb className="h-5 w-5 text-purple-500" /> {results.video_ideas.length} Ý tưởng video</h3>
            <Accordion type="multiple" className="w-full space-y-2">
              {results.content_pillars.map((pillar: string) => (
                <AccordionItem value={pillar} key={pillar} className="border rounded-md">
                  <AccordionTrigger className="p-3 font-medium hover:no-underline">{pillar}</AccordionTrigger>
                  <AccordionContent className="p-4 border-t">
                    <ul className="list-disc pl-5 space-y-3 text-sm">
                      {results.video_ideas.filter((idea: any) => idea.pillar === pillar).map((idea: any) => (
                        <li key={idea.topic}>
                          <strong className="font-semibold">{idea.topic}:</strong>
                          <p className="text-muted-foreground">{idea.description}</p>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>2. Kết quả & Đề xuất</CardTitle>
        <CardDescription>Chiến lược nội dung do AI đề xuất sẽ được hiển thị ở đây.</CardDescription>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
};