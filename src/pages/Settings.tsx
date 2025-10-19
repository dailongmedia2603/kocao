import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiSettings from "@/components/settings/ApiSettings";
import TiktokApiSettings from "@/components/settings/TiktokApiSettings";
import FacebookApiSettings from "@/components/settings/FacebookApiSettings";
import VoiceApiSettings from "@/components/settings/VoiceApiSettings";
import DreamfaceApiSettings from "@/components/settings/DreamfaceApiSettings";
import { Bot, KeyRound, Mic, Film } from "lucide-react";
import { FaTiktok, FaFacebook } from "react-icons/fa";

const Settings = () => {
  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Cài đặt</h1>
        <p className="text-muted-foreground mt-1">Quản lý API Keys và các cấu hình hệ thống khác.</p>
      </header>
      <Tabs defaultValue="gemini-api" className="w-full">
        <TabsList className="flex flex-wrap justify-start bg-transparent p-0 gap-2 h-auto">
          <TabsTrigger value="gemini-api" className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><Bot className="h-5 w-5" /></div><span>API Gemini</span>
          </TabsTrigger>
          <TabsTrigger value="tiktok-api" className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><FaTiktok className="h-5 w-5" /></div><span>API TikTok</span>
          </TabsTrigger>
          <TabsTrigger value="facebook-api" className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><FaFacebook className="h-5 w-5" /></div><span>API Facebook</span>
          </TabsTrigger>
          <TabsTrigger value="voice-api" className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><Mic className="h-5 w-5" /></div><span>API Voice</span>
          </TabsTrigger>
          <TabsTrigger value="dreamface-api" className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><Film className="h-5 w-5" /></div><span>API Dreamface</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="gemini-api" className="mt-6"><ApiSettings /></TabsContent>
        <TabsContent value="tiktok-api" className="mt-6"><TiktokApiSettings /></TabsContent>
        <TabsContent value="facebook-api" className="mt-6"><FacebookApiSettings /></TabsContent>
        <TabsContent value="voice-api" className="mt-6">
          <VoiceApiSettings />
        </TabsContent>
        <TabsContent value="dreamface-api" className="mt-6"><DreamfaceApiSettings /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;