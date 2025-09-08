import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiSettings from "@/components/settings/ApiSettings";
import TiktokApiSettings from "@/components/settings/TiktokApiSettings";
import VoiceApiSettings from "@/components/settings/VoiceApiSettings";
import { VoiceApiDocumentation } from "@/components/settings/VoiceApiDocumentation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Bot, AtSign, Mic } from "lucide-react";
import FacebookApiSettings from "@/components/settings/FacebookApiSettings";
import React from "react";

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v7.008C18.343 21.128 22 16.991 22 12z"/>
    </svg>
);

const Settings = () => {
  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Cài đặt</h1>
        <p className="text-muted-foreground mt-1">Quản lý tài khoản và cấu hình của bạn.</p>
      </header>
      <Tabs defaultValue="api-voice" className="w-full">
        <TabsList className="flex justify-start bg-transparent p-0 gap-2">
          <TabsTrigger value="account" className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><User className="h-5 w-5" /></div><span>Tài khoản</span>
          </TabsTrigger>
          <TabsTrigger value="api-ai" className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><Bot className="h-5 w-5" /></div><span>API AI</span>
          </TabsTrigger>
          <TabsTrigger value="api-tiktok" className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><AtSign className="h-5 w-5" /></div><span>API TikTok</span>
          </TabsTrigger>
          <TabsTrigger value="api-facebook" className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><FacebookIcon className="h-5 w-5" /></div><span>API Facebook</span>
          </TabsTrigger>
          <TabsTrigger value="api-voice" className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><Mic className="h-5 w-5" /></div><span>API Voice</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="mt-6"><Card><CardHeader><CardTitle>Quản lý tài khoản</CardTitle><CardDescription>Cập nhật thông tin cá nhân và cài đặt tài khoản của bạn.</CardDescription></CardHeader><CardContent><p className="text-muted-foreground">Chức năng quản lý tài khoản sẽ được phát triển trong tương lai.</p></CardContent></Card></TabsContent>
        <TabsContent value="api-ai" className="mt-6"><ApiSettings /></TabsContent>
        <TabsContent value="api-tiktok" className="mt-6"><TiktokApiSettings /></TabsContent>
        <TabsContent value="api-facebook" className="mt-6"><FacebookApiSettings /></TabsContent>
        <TabsContent value="api-voice" className="mt-6">
          <VoiceApiSettings />
          <VoiceApiDocumentation />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;