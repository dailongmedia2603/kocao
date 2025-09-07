import { VoiceGenerationForm } from "@/components/voice/VoiceGenerationForm";
import { VoiceHistoryList } from "@/components/voice/VoiceHistoryList";

const CreateVoicePage = () => {
  return (
    <div className="p-6 lg:p-8 bg-gray-50/50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Chuyển Văn Bản thành Giọng Nói</h1>
        <p className="text-muted-foreground mt-1">Sử dụng API của Minimax để tạo ra giọng nói tự nhiên.</p>
      </header>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-1">
          <VoiceGenerationForm />
        </div>
        <div className="xl:col-span-2">
          <VoiceHistoryList />
        </div>
      </div>
    </div>
  );
};

export default CreateVoicePage;