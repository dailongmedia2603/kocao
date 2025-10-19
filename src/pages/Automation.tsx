import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Bot } from "lucide-react";
import { CreateCampaignDialog } from "@/components/automation/CreateCampaignDialog";
import { CampaignCard, type Campaign } from "@/components/automation/CampaignCard";

const Automation = () => {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const { user } = useSession();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["automation_campaigns", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("automation_campaigns")
        .select("*, kocs(name, avatar_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Automation</h1>
            <p className="text-muted-foreground mt-1">Tự động hóa quy trình sáng tạo nội dung của bạn.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> Tạo chiến dịch mới
            </Button>
          </div>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-[350px] w-full" />
            ))}
          </div>
        ) : campaigns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="h-48 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Bot className="h-10 w-10" />
                <p className="font-semibold">Chưa có chiến dịch nào</p>
                <p className="text-sm">Hãy tạo chiến dịch tự động đầu tiên của bạn.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <CreateCampaignDialog isOpen={isCreateOpen} onOpenChange={setCreateOpen} />
    </>
  );
};

export default Automation;