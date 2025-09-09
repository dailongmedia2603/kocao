import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceApiDocumentation } from "@/components/settings/VoiceApiDocumentation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mic } from "lucide-react";
import React from "react";

const Settings = () => {
  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Cài đặt</h1>
        <p className="text-muted-foreground mt-1">Quản lý tài khoản và cấu hình của bạn.</p>
      </header>
      <Tabs defaultValue="account" className="w-full">
        <TabsList className="flex justify-start bg-transparent p-0 gap-2">
          <TabsTrigger value="account" className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><User className="h-5 w-5" /></div><span>Tài khoản</span>
          </TabsTrigger>
          <TabsTrigger value="api-voice" className="group flex items-center gap-2 p-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors bg-transparent group-hover:bg-red-600 group-hover:text-white group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white"><Mic className="h-5 w-5" /></div><span>API Voice</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Quản lý tài khoản</CardTitle>
              <CardDescription>Cập nhật thông tin cá nhân và cài đặt tài khoản của bạn.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Chức năng quản lý tài khoản sẽ được phát triển trong tương lai.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="api-voice" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Cấu hình API</CardTitle>
              <CardDescription>
                Tất cả các API Key (AI, Voice, Facebook, TikTok) hiện được quản lý tập trung bởi quản trị viên hệ thống.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nếu bạn cần thay đổi hoặc cập nhật API Key, vui lòng liên hệ quản trị viên.
              </p>
            </CardContent>
          </Card>
          <VoiceApiDocumentation />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;