import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentPlan } from "@/types/contentPlan";
import { showError } from "@/utils/toast";

// UI Components
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Icons
import { Bot, Loader2, AlertCircle } from "lucide-react";

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
        <div className="space-y-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
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

    if (plan && (plan.status === 'generating' || !results || !results.content)) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-96 border-2 border-dashed rounded-lg">
          <Loader2 className="h-12 w-12 mb-4 animate-spin" />
          <p className="font-semibold">Kế hoạch đang được xử lý...</p>
          <p className="text-sm">Kết quả sẽ sớm được hiển thị ở đây.</p>
        </div>
      );
    }

    if (plan && results && results.content) {
      return (
        <Card>
          <CardContent className="p-6">
            <article className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans">{results.content}</pre>
            </article>
          </CardContent>
        </Card>
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