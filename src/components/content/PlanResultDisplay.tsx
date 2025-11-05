import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentPlan } from "@/types/contentPlan";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bot, Loader2, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "tailwindcss/tailwind.css";
import "@tailwindcss/typography";

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
    refetchInterval: (query) => {
      const data = query.state.data as ContentPlan | undefined;
      // Refetch if status is 'generating'
      return data?.status === 'generating' ? 5000 : false;
    },
  });

  const results = plan?.results as { generatedPlan?: string } | null;
  const generatedPlan = results?.generatedPlan;

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

  if (plan && (plan.status === 'generating' || !results)) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-96 border-2 border-dashed rounded-lg">
        <Loader2 className="h-12 w-12 mb-4 animate-spin" />
        <p className="font-semibold">Kế hoạch đang được xử lý...</p>
        <p className="text-sm">Kết quả sẽ sớm được hiển thị ở đây. Trang sẽ tự động làm mới.</p>
      </div>
    );
  }

  if (plan && generatedPlan) {
    return (
      <div className="prose prose-sm max-w-none p-4 border rounded-lg bg-background">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {generatedPlan}
        </ReactMarkdown>
      </div>
    );
  }

  return null;
};