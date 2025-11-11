import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { LoadingSpinner } from "@/components/LoadingSpinner";

const Dashboard = () => {
  const { user } = useSession();

  const { data: hasCompletedOnboarding, isLoading } = useQuery({
    queryKey: ['onboarding_status', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { count, error } = await supabase
        .from('automation_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if (error) {
        console.error("Error checking onboarding status:", error);
        return false; // Assume not completed on error
      }
      return (count ?? 0) > 0;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {hasCompletedOnboarding ? (
        <div className="flex flex-col items-center justify-center text-center">
          <img src="/logokocao.png" alt="DrXAIKOC Logo" className="h-48 w-48 mb-6 object-contain" />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Chào mừng trở lại!</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
            Hệ thống đã sẵn sàng. Hãy bắt đầu tạo ra những nội dung tuyệt vời.
          </p>
        </div>
      ) : (
        <div>
          <header className="text-center mb-8">
            <h1 className="text-3xl font-bold">Chào mừng bạn đến với DrX AI KOC!</h1>
            <p className="text-muted-foreground mt-2">Hãy cùng nhau thiết lập những bước đầu tiên để bắt đầu hành trình sáng tạo của bạn.</p>
          </header>
          <OnboardingWizard />
        </div>
      )}
    </div>
  );
};

export default Dashboard;