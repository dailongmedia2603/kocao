import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiSettings from "@/components/settings/ApiSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Settings = () => {
  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Cài đặt</h1>
        <p className="text-muted-foreground mt-1">Quản lý tài khoản và cấu hình của bạn.</p>
      </header>
      <Tabs defaultValue="api-ai" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="account">Tài khoản</TabsTrigger>
          <TabsTrigger value="api-ai">API AI</TabsTrigger>
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