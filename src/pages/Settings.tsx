import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TiktokApiSettings from "@/components/settings/TiktokApiSettings";
import FacebookApiSettings from "@/components/settings/FacebookApiSettings";
import VoiceApiSettings from "@/components/settings/VoiceApiSettings";
import DreamfaceApiSettings from "@/components/settings/DreamfaceApiSettings";
import VertexAiSettings from "@/components/settings/VertexAiSettings";
import GptCustomApiSettings from "@/components/settings/GptCustomApiSettings"; // Import component mới
import { Mic, Film, BrainCircuit } from "lucide-react";
import { FaTiktok, FaFacebook } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TABS_CONFIG = [
  { value: "vertex-ai-api", label: "Gemini Vertex AI", icon: BrainCircuit, component: <VertexAiSettings /> },
  { value: "gpt-custom-api", label: "API GPT Custom", icon: BrainCircuit, component: <GptCustomApiSettings /> }, // Thêm tab mới
  { value: "tiktok-api", label: "API TikTok", icon: FaTiktok, component: <TiktokApiSettings /> },
  { value: "facebook-api", label: "API Facebook", icon: FaFacebook, component: <FacebookApiSettings /> },
  { value: "voice-api", label: "API Voice", icon: Mic, component: <VoiceApiSettings /> },
  { value: "dreamface-api", label: "API Tạo Video", icon: Film, component: <DreamfaceApiSettings /> },
];

const Settings = () => {
  const [activeTab, setActiveTab] = useState("vertex-ai-api");
  const activeComponent = TABS_CONFIG.find(tab => tab.value === activeTab)?.component;

  return (
    <>
      {/* Mobile View */}
      <div className="p-4 md:hidden">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Cài đặt</h1>
          <p className="text-muted-foreground mt-1 text-sm">Quản lý API Keys và các cấu hình hệ thống khác.</p>
        </header>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {TABS_CONFIG.map((tab) => (
            <Button
              key={tab.value}
              variant="outline"
              className={cn(
                "justify-start h-auto p-3 gap-2",
                activeTab === tab.value && "bg-red-50 border-red-200 text-red-700"
              )}
              onClick={() => setActiveTab(tab.value)}
            >
              <tab.icon className="h-5 w-5 flex-shrink-0" />
              <span className="font-semibold text-sm">{tab.label}</span>
            </Button>
          ))}
        </div>
        <div>{activeComponent}</div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block p-6 lg:p-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">Cài đặt</h1>
          <p className="text-muted-foreground mt-1">Quản lý API Keys và các cấu hình hệ thống khác.</p>
        </header>
        <Tabs defaultValue="vertex-ai-api" className="w-full">
          <TabsList className="flex flex-wrap justify-start bg-transparent p-0 gap-2 h-auto">
            {TABS_CONFIG.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
                <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white">
                  <tab.icon className="h-5 w-5" />
                </div>
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS_CONFIG.map(tab => (
            <TabsContent key={tab.value} value={tab.value} className="mt-6">
              {tab.component}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
};

export default Settings;