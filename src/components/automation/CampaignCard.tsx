import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bot, Edit, MoreHorizontal, Newspaper, PenSquare, Play, Trash2, UploadCloud, Video, Mic, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

type Campaign = {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'error';
  kocs: { name: string, avatar_url: string | null };
  projects: { name: string };
  last_run_at: string | null;
};

type CampaignCardProps = {
  campaign: Campaign;
  onEdit: () => void;
  onDelete: () => void;
};

export const CampaignCard = ({ campaign, onEdit, onDelete }: CampaignCardProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: 'active' | 'paused') => {
      const { error } = await supabase
        .from('automation_campaigns')
        .update({ status: newStatus })
        .eq('id', campaign.id);
      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      showSuccess(`Chiến dịch đã được ${newStatus === 'active' ? 'kích hoạt' : 'tạm dừng'}.`);
      queryClient.invalidateQueries({ queryKey: ['automation_campaigns', user?.id] });
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
      queryClient.invalidateQueries({ queryKey: ['automation_campaigns', user?.id] });
    },
  });

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase();

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-red-600" />
              {campaign.name}
            </CardTitle>
            <CardDescription className="mt-1">
              {campaign.last_run_at ? `Chạy lần cuối ${formatDistanceToNow(new Date(campaign.last_run_at), { addSuffix: true, locale: vi })}` : 'Chưa chạy lần nào'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={campaign.status === 'active'}
              onCheckedChange={(checked) => updateStatusMutation.mutate(checked ? 'active' : 'paused')}
              disabled={updateStatusMutation.isPending}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}><Edit className="mr-2 h-4 w-4" />Sửa</DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Xóa</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10"><AvatarImage src={campaign.kocs.avatar_url || undefined} /><AvatarFallback>{getInitials(campaign.kocs.name)}</AvatarFallback></Avatar>
              <div><p className="text-sm text-muted-foreground">KOC</p><p className="font-semibold">{campaign.kocs.name}</p></div>
            </div>
            <Badge variant={campaign.status === 'active' ? 'default' : 'outline'} className={campaign.status === 'active' ? 'bg-green-100 text-green-800' : campaign.status === 'error' ? 'bg-red-100 text-red-800' : ''}>
              {campaign.status}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Luồng công việc</p>
            <div className="flex items-center gap-2 text-muted-foreground text-xs overflow-x-auto pb-2">
              <div className="flex items-center gap-2 flex-shrink-0"><Newspaper className="h-4 w-4" /><span>Quét tin</span><ChevronRight className="h-4 w-4" /></div>
              <div className="flex items-center gap-2 flex-shrink-0"><PenSquare className="h-4 w-4" /><span>Tạo kịch bản</span><ChevronRight className="h-4 w-4" /></div>
              <div className="flex items-center gap-2 flex-shrink-0"><Mic className="h-4 w-4" /><span>Tạo Voice</span><ChevronRight className="h-4 w-4" /></div>
              <div className="flex items-center gap-2 flex-shrink-0"><Video className="h-4 w-4" /><span>Ghép Video</span><ChevronRight className="h-4 w-4" /></div>
              <div className="flex items-center gap-2 flex-shrink-0"><UploadCloud className="h-4 w-4" /><span>Lưu trữ</span></div>
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground">Kịch bản Extension</p>
            <p className="font-semibold">{campaign.projects.name}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};