import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiSettings from "@/components/settings/ApiSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Bot } from "lucide-react";

const Settings = () => {
  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Cài đặt</h1>
        <p className="text-muted-foreground mt-1">Quản lý tài khoản và cấu hình của bạn.</p>
      </header>
      <Tabs defaultValue="api-ai" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-transparent p-0 gap-2">
          <TabsTrigger
            value="account"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors"
          >
            <User className="h-5 w-5" />
            Tài khoản
          </TabsTrigger>
          <TabsTrigger
            value="api-ai"
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-md font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 data-[state=active]:shadow-none transition-colors"
          >
            <Bot className="h-5 w-5" />
            API AI
          </TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Quản lý tài khoản</CardTitle>
              <CardDescription>
                Cập nhật thông tin cá nhân và cài đặt tài khoản của bạn.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Chức năng quản lý tài khoản sẽ được phát triển trong tương lai.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="api-ai" className="mt-6">
          <ApiSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;