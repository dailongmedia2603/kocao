import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentPlan } from "@/types/contentPlan";
import { showSuccess, showError } from "@/utils/toast";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// Icons
import { Bot, Loader2, ClipboardCheck, ListVideo, CalendarClock, Lightbulb, AlertCircle, Plus } from "lucide-react";

type PlanResultDisplayProps = {
  planId: string | null;
};

export const PlanResultDisplay = ({ planId }: PlanResultDisplayProps) => {
  const isNew = planId === null;
  const queryClient = useQueryClient();

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

  const generateMoreMutation = useMutation({
    mutationFn: async () => {
      if (!planId) throw new Error("Plan ID is required.");
      const { data, error } = await supabase.functions.invoke('generate-more-video-ideas', {
        body: { planId }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      showSuccess("Đã tạo thêm 10 ý tưởng mới!");
      queryClient.invalidateQueries({ queryKey: ['content_plan_detail', planId] });
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    }
  });

  const results = plan?.results;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
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

    if (plan && (plan.status === 'generating' || !results)) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-96 border-2 border-dashed rounded-lg">
          <Loader2 className="h-12 w-12 mb-4 animate-spin" />
          <p className="font-semibold">Kế hoạch đang được xử lý...</p>
          <p className="text-sm">Kết quả sẽ sớm được hiển thị ở đây.</p>
        </div>
      );
    }

    if (plan && results) {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-blue-500" /> Chiến lược tổng thể</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{results.overall_strategy}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ListVideo className="h-5 w-5 text-green-500" /> Trụ cột nội dung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(results.content_pillars || []).map((pillar: string) => <Badge key={pillar} variant="secondary" className="text-base py-1 px-3">{pillar}</Badge>)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-orange-500" /> Lịch đăng đề xuất</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Giai đoạn</TableHead><TableHead>Thời gian</TableHead><TableHead>Tổng số video</TableHead><TableHead>Tần suất</TableHead><TableHead>Ghi chú</TableHead></TableRow></TableHeader>
                <TableBody>
                  {results.posting_schedule?.build_up_phase && (
                    <TableRow>
                      <TableCell className="font-medium">{results.posting_schedule.build_up_phase.phase_name || 'Xây dựng ban đầu'}</TableCell>
                      <TableCell>{results.posting_schedule.build_up_phase.duration}</TableCell>
                      <TableCell>{results.posting_schedule.build_up_phase.total_videos}</TableCell>
                      <TableCell>{results.posting_schedule.build_up_phase.frequency}</TableCell>
                      <TableCell className="text-xs">{results.posting_schedule.build_up_phase.notes}</TableCell>
                    </TableRow>
                  )}
                  {results.posting_schedule?.maintenance_phase && (
                    <TableRow>
                      <TableCell className="font-medium">{results.posting_schedule.maintenance_phase.phase_name || 'Duy trì'}</TableCell>
                      <TableCell>{results.posting_schedule.maintenance_phase.duration}</TableCell>
                      <TableCell>{results.posting_schedule.maintenance_phase.total_videos}</TableCell>
                      <TableCell>{results.posting_schedule.maintenance_phase.frequency}</TableCell>
                      <TableCell className="text-xs">{results.posting_schedule.maintenance_phase.notes}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-purple-500" /> {(results.video_ideas || []).length} Ý tưởng video</CardTitle>
              <Button size="sm" onClick={() => generateMoreMutation.mutate()} disabled={generateMoreMutation.isPending}>
                {generateMoreMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Tạo thêm 10 ý tưởng
              </Button>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full space-y-2">
                {(results.content_pillars || []).map((pillar: string) => (
                  <AccordionItem value={pillar} key={pillar} className="border rounded-md">
                    <AccordionTrigger className="p-3 font-medium hover:no-underline">{pillar}</AccordionTrigger>
                    <AccordionContent className="p-4 border-t">
                      <ul className="list-disc pl-5 space-y-3 text-sm">
                        {(results.video_ideas || []).filter((idea: any) => idea.pillar === pillar).map((idea: any) => (
                          <li key={idea.topic}>
                            <strong className="font-semibold">{idea.topic}:</strong>
                            <p className="text-muted-foreground whitespace-pre-wrap">{idea.description}</p>
                          </li>
                        ))}
                      </ul>
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

  return (
    <div>
      {renderContent()}
    </div>
  );
};