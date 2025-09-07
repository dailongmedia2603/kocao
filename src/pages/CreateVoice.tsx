import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceGenerationForm } from "@/components/voice/VoiceGenerationForm";
import { TaskList } from "@/components/voice/TaskList";
import { VoiceCloneForm } from "@/components/voice/VoiceCloneForm";
import { ClonedVoiceList } from "@/components/voice/ClonedVoiceList";

const CreateVoicePage = () => {
  return (
    <div className="p-6 lg:p-8 bg-gray-50/50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Quản lý Giọng Nói</h1>
        <p className="text-muted-foreground mt-1">Tạo giọng nói từ văn bản hoặc clone giọng nói của riêng bạn.</p>
      </header>
      <Tabs defaultValue="tts" className="w-full">
        <TabsList>
          <TabsTrigger value="tts">Tạo Voice (Text-to-Speech)</TabsTrigger>
          <TabsTrigger value="clone">Clone Voice</TabsTrigger>
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