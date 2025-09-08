import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { isToday } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bot, Newspaper, Settings, History, FileText, CalendarClock, Voicemail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigureNewsDialog } from "@/components/content/ConfigureNewsDialog";
import { NewsTable } from "@/components/content/NewsTable";
import { NewsScanLogDialog } from "@/components/content/NewsScanLogDialog";
import { StatCard } from "@/components/content/StatCard";

type NewsPost = {
  id: string;
  source_name: string | null;
  content: string | null;
  created_time: string;
  status: string;
  voice_script: string | null;
  post_url: string | null;
};

const fetchNewsPosts = async (userId: string) => {
  const { data, error } = await supabase
    .from('news_posts')
    .select('id, source_name, content, created_time, status, voice_script, post_url')
    .eq('user_id', userId)
    .order('created_time', { ascending: false })
    .limit(50);
  
  if (error) throw error;
  return data as NewsPost[];
};

const TaoContent = () => {
  const [isConfigureOpen, setConfigureOpen] = useState(false);
  const [isLogOpen, setLogOpen] = useState(false);
  const { user } = useSession();

  const { data: news = [], isLoading } = useQuery<NewsPost[]>({
    queryKey: ['news_posts', user?.id],
    queryFn: () => fetchNewsPosts(user!.id),
    enabled: !!user,
  });

  const totalPosts = news.length;
  const todayPosts = news.filter(post => isToday(new Date(post.created_time))).length;
  const voiceGeneratedPosts = news.filter(post => post.status === 'voice_generated').length;

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Công cụ Content</h1>
          <p className="text-muted-foreground mt-1">
            Sử dụng AI để tạo nội dung mới hoặc cập nhật tin tức từ các nguồn có sẵn.
          </p>
        </header>

        <Tabs defaultValue="news" className="w-full">
          <TabsList className="inline-flex h-auto items-center justify-center gap-1 rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="create-content"
              className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-muted-foreground ring-offset-background transition-all hover:bg-muted/50 focus-visible:outline-none data-[state=active]:border-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-muted-foreground transition-colors group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white">
                <Bot className="h-5 w-5" />
              </div>
              Tạo content
            </TabsTrigger>
            <TabsTrigger
              value="news"
              className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-muted-foreground ring-offset-background transition-all hover:bg-muted/50 focus-visible:outline-none data-[state=active]:border-red-600 data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-muted-foreground transition-colors group-data-[state=active]:bg-red-600 group-data-[state=active]:text-white">
                <Newspaper className="h-5 w-5" />
              </div>
              Tin tức mới
            </TabsTrigger>
          </TabsList>
          <TabsContent value="create-content" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Tạo Content bằng AI</CardTitle>
                <CardDescription>
                  Mô tả chi tiết yêu cầu của bạn, AI sẽ tạo ra nội dung sáng tạo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Ví dụ: Viết một bài đăng Facebook quảng cáo tai nghe không dây mới, nhấn mạnh vào thời lượng pin và chất lượng âm thanh."
                  className="min-h-[200px] resize-y"
                />
                <Button className="w-full sm:w-auto">
                  <Bot className="mr-2 h-4 w-4" />
                  Bắt đầu tạo
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="news" className="mt-6">
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <StatCard title="Tổng Post" value={isLoading ? '...' : totalPosts} icon={FileText} color="bg-blue-100 text-blue-600" />
              <StatCard title="Post Hôm Nay" value={isLoading ? '...' : todayPosts} icon={CalendarClock} color="bg-green-100 text-green-600" />
              <StatCard title="Đã Tạo Voice" value={isLoading ? '...' : voiceGeneratedPosts} icon={Voicemail} color="bg-purple-100 text-purple-600" />
            </div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Hộp thư tin tức</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setLogOpen(true)} className="bg-red-100 hover:bg-red-200 text-red-700 border-red-200">
                  <History className="mr-2 h-4 w-4" />
                  Nhật ký
                </Button>
                <Button onClick={() => setConfigureOpen(true)} className="bg-red-700 hover:bg-red-800 text-white">
                  <Settings className="mr-2 h-4 w-4" />
                  Cấu hình
                </Button>
              </div>
            </div>
            <NewsTable news={news} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </div>
      <ConfigureNewsDialog isOpen={isConfigureOpen} onOpenChange={setConfigureOpen} />
      <NewsScanLogDialog isOpen={isLogOpen} onOpenChange={setLogOpen} />
    </>
  );
};

export default TaoContent;