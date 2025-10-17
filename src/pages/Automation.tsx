import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Bot, AlertCircle } from "lucide-react";
import { CreateCampaignDialog } from "@/components/automation/CreateCampaignDialog";
import { CampaignCard } from "@/components/automation/CampaignCard";
import { AiConfigDialog } from "@/components/automation/AiConfigDialog";

export type Campaign = {
  id: string;
  name: string;
  status: 'active' | 'paused';
  koc_id: string;
  cloned_voice_id: string;
  cloned_voice_name: string;
  ai_prompt: string | null;
  description: string | null;
  kocs: { name: string; avatar_url: string | null } | null;
};

const fetchCampaigns = async (userId: string): Promise<Campaign[]> => {
  const { data, error } = await supabase
    .from('automation_campaigns')
    .select('*, kocs(name, avatar_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Campaign[];
};

const Automation = () => {
  const { user } = useSession();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isAiConfigOpen, setAiConfigOpen] = useState(false);

  const { data: campaigns, isLoading, isError, error } = useQuery({
    queryKey: ['automation_campaigns', user?.id],
    queryFn: () => fetchCampaigns(user!.id),
    enabled: !!user,
  });

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Quản lý Automation</h1>
            <p className="text-muted-foreground mt-1">Tạo và quản lý các chiến dịch tự động của bạn.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAiConfigOpen(true)}>
              <Bot className="mr-2 h-4 w-4" /> Cấu hình AI
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> Tạo chiến dịch
            </Button>
          </div>
        </header>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Lỗi</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && campaigns && campaigns.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map(campaign => <CampaignCard key={campaign.id} campaign={campaign} />)}
          </div>
        )}

        {!isLoading && !isError && campaigns && campaigns.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h3 className="text-xl font-semibold">Chưa có chiến dịch nào</h3>
            <p className="text-muted-foreground mt-2 mb-4">Hãy tạo chiến dịch tự động đầu tiên của bạn.</p>
            <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> Tạo chiến dịch
            </Button>
          </div>
        )}
      </div>
      <CreateCampaignDialog isOpen={isCreateOpen} onOpenChange={setCreateOpen} />
      <AiConfigDialog isOpen={isAiConfigOpen} onOpenChange={setAiConfigOpen} />
    </>
  );
};

export default Automation;