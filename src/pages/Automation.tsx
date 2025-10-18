import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Settings, Bot, PlayCircle, PauseCircle, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { CreateCampaignDialog } from "@/components/automation/CreateCampaignDialog";
import { ConfigureAiTemplatesDialog } from "@/components/automation/ConfigureAiTemplatesDialog";

export type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  kocs: { 
    name: string;
    avatar_url: string | null;
  } | null;
  cloned_voice_name: string | null;
  ai_prompt: string | null;
};

const Automation = () => {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isConfigureOpen, setConfigureOpen] = useState(false);
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
      return data as any[]; // Cast as any to match the updated, more detailed type
    },
    enabled: !!user,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><PlayCircle className="mr-1 h-3 w-3" /> Đang chạy</Badge>;
      case "paused":
        return <Badge variant="secondary"><PauseCircle className="mr-1 h-3 w-3" /> Tạm dừng</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Automation</h1>
            <p className="text-muted-foreground mt-1">Tự động hóa quy trình sáng tạo nội dung của bạn.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setConfigureOpen(true)}>
              <Settings className="mr-2 h-4 w-4" /> Cấu hình AI
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> Tạo chiến dịch mới
            </Button>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách chiến dịch</CardTitle>
            <CardDescription>Quản lý các chiến dịch tự động của bạn.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên chiến dịch</TableHead>
                  <TableHead>KOC</TableHead>
                  <TableHead>Giọng nói</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : campaigns.length > 0 ? (
                  campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>{campaign.kocs?.name || 'N/A'}</TableCell>
                      <TableCell>{campaign.cloned_voice_name || 'N/A'}</TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                      <TableCell>{format(new Date(campaign.created_at), "dd/MM/yyyy", { locale: vi })}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Bot className="h-10 w-10" />
                        <p className="font-semibold">Chưa có chiến dịch nào</p>
                        <p className="text-sm">Hãy tạo chiến dịch tự động đầu tiên của bạn.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <CreateCampaignDialog isOpen={isCreateOpen} onOpenChange={setCreateOpen} />
      <ConfigureAiTemplatesDialog isOpen={isConfigureOpen} onOpenChange={setConfigureOpen} />
    </>
  );
};

export default Automation;