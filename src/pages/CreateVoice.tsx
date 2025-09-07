import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceGenerationForm } from "@/components/voice/VoiceGenerationForm";
import { TaskList } from "@/components/voice/TaskList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
          <TabsTrigger value="clone" disabled>Clone Voice (Sắp ra mắt)</TabsTrigger>
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
           <Card>
            <CardHeader>
              <CardTitle>Clone Giọng Nói</CardTitle>
              <CardDescription>Tính năng này đang được phát triển và sẽ sớm ra mắt.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Bạn sẽ có thể tải lên file âm thanh để tạo ra một phiên bản giọng nói của riêng mình.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CreateVoicePage;