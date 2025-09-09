import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import { Bot, Plus, Wand2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateCampaignDialog } from "@/components/automation/CreateCampaignDialog";
import { CampaignCard } from "@/components/automation/CampaignCard";
import { AiConfigDialog } from "@/components/automation/AiConfigDialog";

type Campaign = {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'error';
  kocs: { name: string, avatar_url: string | null };
  projects: { name: string };
  last_run_at: string | null;
};

const fetchCampaigns = async (userId: string) => {
  const { data, error } = await supabase
    .from('automation_campaigns')
    .select(`
      id, name, status, last_run_at,
      kocs (name, avatar_url),
      projects (name)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as any[];
};

const Automation = () => {
  const { user } = useSession();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isAiConfigOpen, setAiConfigOpen] = useState(false);

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ['automation_campaigns', user?.id],
    queryFn: () => fetchCampaigns(user!.id),
    enabled: !!user,
  });

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Automation Campaigns</h1>
            <p className="text-muted-foreground mt-1">Tạo và quản lý các quy trình làm việc tự động.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAiConfigOpen(true)}>
              <Wand2 className="mr-2 h-4 w-4" /> Cấu hình AI
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> Tạo chiến dịch
            </Button>
          </div>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        ) : campaigns && campaigns.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onEdit={() => { /* Handle Edit */ }}
                onDelete={() => { /* Handle Delete */ }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-semibold">Chưa có chiến dịch nào</h3>
            <p className="text-muted-foreground mt-2 mb-4">Bắt đầu bằng cách tạo chiến dịch tự động đầu tiên của bạn.</p>
            <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Tạo chiến dịch
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