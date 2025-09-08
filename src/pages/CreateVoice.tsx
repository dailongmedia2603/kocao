import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceGenerationForm } from "@/components/voice/VoiceGenerationForm";
import { TaskList } from "@/components/voice/TaskList";
import { VoiceCloneForm } from "@/components/voice/VoiceCloneForm";
import { ClonedVoiceList } from "@/components/voice/ClonedVoiceList";
import { Mic, Copy } from "lucide-react";

const CreateVoicePage = () => {
  return (
    <div className="p-6 lg:p-8 bg-gray-50/50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Quản lý Giọng Nói</h1>
        <p className="text-muted-foreground mt-1">Tạo giọng nói từ văn bản hoặc clone giọng nói của riêng bạn.</p>
      </header>
      <Tabs defaultValue="tts" className="w-full">
        <TabsList className="inline-flex h-auto items-center justify-center gap-1 rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="tts"
            className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-muted-foreground ring-offset-background transition-all hover:bg-muted/50 focus-visible:outline-none data-[state=active]:border-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-muted-foreground transition-colors group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white">
              <Mic className="h-5 w-5" />
            </div>
            Tạo Voice (Text-to-Speech)
          </TabsTrigger>
          <TabsTrigger
            value="clone"
            className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-muted-foreground ring-offset-background transition-all hover:bg-muted/50 focus-visible:outline-none data-[state=active]:border-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-muted-foreground transition-colors group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white">
              <Copy className="h-5 w-5" />
            </div>
            Clone Voice
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