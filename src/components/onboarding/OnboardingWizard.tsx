import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { OnboardingStepper } from "./OnboardingStepper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateKocDialog } from "@/components/koc/CreateKocDialog";
import { VoiceCloneForm } from "@/components/voice/VoiceCloneForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EditKocDialog } from "@/components/koc/EditKocDialog";
import { UploadVideoDialog } from "@/components/koc/UploadVideoDialog";
import { CreateCampaignDialog } from "@/components/automation/CreateCampaignDialog";
import { Link } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { ConfigureAiTemplatesDialog } from "@/components/automation/ConfigureAiTemplatesDialog";

const STEPS = [
  "Tạo KOC",
  "Clone Voice",
  "Gán Voice",
  "Tải Video Nguồn",
  "Prompt Nội dung",
  "Tạo Automation",
  "Hoàn tất",
];

export const OnboardingWizard = () => {
  const { user } = useSession();
  const [currentStep, setCurrentStep] = useState(0);

  // Dialog states
  const [isCreateKocOpen, setCreateKocOpen] = useState(false);
  const [isCloneVoiceOpen, setCloneVoiceOpen] = useState(false);
  const [isEditKocOpen, setEditKocOpen] = useState(false);
  const [isUploadVideoOpen, setUploadVideoOpen] = useState(false);
  const [isCreateCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [isConfigurePromptOpen, setConfigurePromptOpen] = useState(false);

  // Data queries to determine progress
  const { data: kocs, isLoading: isLoadingKocs } = useQuery({
    queryKey: ['onboarding_kocs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('kocs').select('*').eq('user_id', user.id).limit(1);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const activeKoc = useMemo(() => (kocs && kocs.length > 0 ? kocs[0] : null), [kocs]);

  const { data: voices, isLoading: isLoadingVoices } = useQuery({
    queryKey: ['onboarding_voices', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('cloned_voices').select('voice_id').eq('user_id', user.id).not('sample_audio', 'is', null).limit(1);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: sourceVideos, isLoading: isLoadingSourceVideos } = useQuery({
    queryKey: ['onboarding_source_videos', activeKoc?.id],
    queryFn: async () => {
      if (!activeKoc) return [];
      const { data, error } = await supabase.from('koc_files').select('id').eq('koc_id', activeKoc.id).like('r2_key', '%/sources/videos/%').limit(1);
      if (error) throw error;
      return data;
    },
    enabled: !!activeKoc,
  });

  const { data: campaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ['onboarding_campaigns', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('automation_campaigns').select('id').eq('user_id', user.id).limit(1);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (isLoadingKocs || isLoadingVoices || isLoadingSourceVideos || isLoadingCampaigns) return;

    let step = 0;
    if (kocs && kocs.length > 0) {
      step = 1;
      if (voices && voices.length > 0) {
        step = 2;
        if (activeKoc && activeKoc.default_cloned_voice_id) {
          step = 3;
          if (sourceVideos && sourceVideos.length > 0) {
            step = 4;
            if (activeKoc && activeKoc.default_prompt_template_id) {
              step = 5;
              if (campaigns && campaigns.length > 0) {
                step = 6;
              }
            }
          }
        }
      }
    }
    setCurrentStep(step);
  }, [kocs, voices, activeKoc, sourceVideos, campaigns, isLoadingKocs, isLoadingVoices, isLoadingSourceVideos, isLoadingCampaigns]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <CardContent><p className="text-muted-foreground mb-4">Bước đầu tiên là tạo một hồ sơ KOC ảo. Đây sẽ là "diễn viên" chính cho các video của bạn.</p><Button onClick={() => setCreateKocOpen(true)}>Tạo KOC</Button></CardContent>;
      case 1:
        return <CardContent><p className="text-muted-foreground mb-4">Tuyệt vời! Bây giờ hãy tạo một giọng nói nhân bản. Tải lên một file âm thanh mẫu để hệ thống học theo.</p><Button onClick={() => setCloneVoiceOpen(true)}>Bắt đầu Clone Voice</Button></CardContent>;
      case 2:
        return <CardContent><p className="text-muted-foreground mb-4">Giọng nói đã sẵn sàng! Hãy gán giọng nói này làm giọng mặc định cho KOC bạn vừa tạo.</p><Button onClick={() => setEditKocOpen(true)}>Gán Giọng Nói</Button></CardContent>;
      case 3:
        return <CardContent><p className="text-muted-foreground mb-4">Giờ hãy cung cấp ít nhất một video nguồn. Video này sẽ được dùng làm "khuôn" cho các video AI tạo ra.</p><Button onClick={() => setUploadVideoOpen(true)}>Tải Video Nguồn</Button></CardContent>;
      case 4:
        return <CardContent><p className="text-muted-foreground mb-4">Mỗi KOC cần một "khuôn" kịch bản (prompt) mặc định để AI có thể tự động tạo nội dung. Hãy cấu hình prompt mặc định cho KOC này.</p><Button onClick={() => setConfigurePromptOpen(true)}>Cấu hình Prompt</Button></CardContent>;
      case 5:
        return <CardContent><p className="text-muted-foreground mb-4">Gần xong rồi! Hãy tạo một chiến dịch tự động để kết nối KOC, giọng nói và các thiết lập AI lại với nhau.</p><Button onClick={() => setCreateCampaignOpen(true)}>Tạo Chiến Dịch</Button></CardContent>;
      case 6:
        return (
          <CardContent className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-semibold">Bạn đã hoàn tất thiết lập ban đầu!</p>
            <p className="text-muted-foreground mb-6">Giờ đây bạn đã sẵn sàng để tự động hóa quy trình sáng tạo. Bước tiếp theo là xây dựng kế hoạch nội dung cho KOC của bạn.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button asChild>
                <Link to="/tao-ke-hoach">Bắt đầu xây dựng kế hoạch</Link>
              </Button>
              <Button variant="outline" onClick={() => setCreateKocOpen(true)}>
                Tạo KOC mới
              </Button>
            </div>
          </CardContent>
        );
      default:
        return <CardContent><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent>;
    }
  };

  return (
    <div className="space-y-8">
      <OnboardingStepper currentStep={currentStep} steps={STEPS} />
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{STEPS[currentStep]}</CardTitle>
          <CardDescription>
            {currentStep < 6 ? `Bước ${currentStep + 1} trên 6 trong quy trình thiết lập.` : "Hoàn thành!"}
          </CardDescription>
        </CardHeader>
        {renderStepContent()}
      </Card>

      {/* Dialogs */}
      <CreateKocDialog isOpen={isCreateKocOpen} onOpenChange={setCreateKocOpen} />
      <Dialog open={isCloneVoiceOpen} onOpenChange={setCloneVoiceOpen}>
        <DialogContent><DialogHeader><DialogTitle>Bước 2: Clone Voice</DialogTitle><DialogDescription>Tải lên file âm thanh mẫu để tạo giọng nói mới.</DialogDescription></DialogHeader><div className="pt-4"><VoiceCloneForm /></div></DialogContent>
      </Dialog>
      <EditKocDialog isOpen={isEditKocOpen} onOpenChange={setEditKocOpen} koc={activeKoc} />
      {activeKoc && <UploadVideoDialog isOpen={isUploadVideoOpen} onOpenChange={setUploadVideoOpen} kocId={activeKoc.id} userId={activeKoc.user_id} kocName={activeKoc.name} folderPath={`${activeKoc.folder_path}/sources/videos`} accept="video/*" />}
      <CreateCampaignDialog isOpen={isCreateCampaignOpen} onOpenChange={setCreateCampaignOpen} />
      {activeKoc && <ConfigureAiTemplatesDialog isOpen={isConfigurePromptOpen} onOpenChange={setConfigurePromptOpen} kocId={activeKoc.id} defaultTemplateIdForKoc={activeKoc.default_prompt_template_id} />}
    </div>
  );
};