import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Trash2, Mic } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Link } from "react-router-dom";

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
};

type CampaignCardProps = {
  campaign: Campaign;
};

const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase();

export const CampaignCard = ({ campaign }: CampaignCardProps) => {
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
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('automation_campaigns').delete().eq('id', campaign.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa chiến dịch thành công!");
      queryClient.invalidateQueries({ queryKey: ["automation_campaigns", user?.id] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  return (
    <Card className="flex flex-col relative group hover:shadow-lg transition-shadow">
      <Link to={`/automation/${campaign.id}`} className="absolute inset-0 z-10" aria-label={`View details for ${campaign.name}`} />
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{campaign.name}</CardTitle>
          <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className={campaign.status === 'active' ? 'bg-green-100 text-green-800' : ''}>
            {campaign.status === 'active' ? 'Đang chạy' : 'Tạm dừng'}
          </Badge>
        </div>
        {campaign.description && <CardDescription>{campaign.description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/50">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={campaign.kocs?.avatar_url || undefined} />
            <AvatarFallback>{campaign.kocs ? getInitials(campaign.kocs.name) : '?'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm text-muted-foreground">KOC</p>
            <p className="font-semibold">{campaign.kocs?.name || 'Không rõ'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-purple-100 text-purple-600">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Giọng nói</p>
            <p className="font-semibold">{campaign.cloned_voice_name}</p>
          </div>
        </div>
      </CardContent>
      <div className="flex items-center justify-between p-4 border-t relative z-20">
        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={campaign.status === 'active'}
            onCheckedChange={(checked) => updateStatusMutation.mutate(checked ? 'active' : 'paused')}
            disabled={updateStatusMutation.isPending}
          />
          <label className="text-sm font-medium">Kích hoạt</label>
        </div>
        <AlertDialog onOpenChange={(open) => { if (!open) { /* handle closing if needed */ } }}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={(e) => e.stopPropagation()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa chiến dịch "{campaign.name}"?</AlertDialogTitle>
              <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="bg-destructive hover:bg-destructive/90">
                {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
};