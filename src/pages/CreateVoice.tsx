import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceGenerationForm } from "@/components/voice/VoiceGenerationForm";
import { TaskList } from "@/components/voice/TaskList";
import { VoiceCloneForm } from "@/components/voice/VoiceCloneForm";
import { ClonedVoiceList } from "@/components/voice/ClonedVoiceList";
import { Mic, Copy } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import KocMobileNav from "@/components/koc/KocMobileNav";

const CreateVoicePage = () => {
  const isMobile = useIsMobile();
  return (
    <div className="p-4 md:p-6 lg:p-8">
      {isMobile && <KocMobileNav />}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Quản lý Giọng Nói</h1>
        <p className="text-muted-foreground mt-1">Tạo giọng nói từ văn bản hoặc clone giọng nói của riêng bạn.</p>
      </header>
      <Tabs defaultValue="tts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-auto p-1">
          <TabsTrigger value="tts" className="py-2.5 flex items-center gap-2">
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">Tạo Voice</span>
            <span className="sm:hidden">TTS</span>
          </TabsTrigger>
          <TabsTrigger value="clone" className="py-2.5 flex items-center gap-2">
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Clone Voice</span>
            <span className="sm:hidden">Clone</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tts" className="mt-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
            <div className="xl:col-span-1">
              <VoiceGenerationForm />
            </div>
            <div className="xl:col-span-2">
              <TaskList />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="clone" className="mt-6">
           <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
            <div className="xl:col-span-1">
              <VoiceCloneForm />
            </div>
            <div className="xl:col-span-2">
              <ClonedVoiceList />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CreateVoicePage;