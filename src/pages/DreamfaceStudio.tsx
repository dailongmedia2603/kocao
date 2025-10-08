import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { showSuccess, showError } from "@/utils/toast";
import { Film, Clapperboard, UserCircle, AlertCircle, Download, Loader2, RefreshCw } from "lucide-react";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const DreamfaceStudio = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const { data: accountInfo, isLoading: isLoadingInfo } = useQuery({
    queryKey: ['dreamface_account'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("dreamface-api-proxy", {
        body: { path: "remain-credit", method: "GET" }
      });
      if (error || data.error) throw new Error(error?.message || data.error);
      return data.data;
    }
  });

  const { data: videoList, isLoading: isLoadingVideos, refetch: refetchVideos } = useQuery({
    queryKey: ['dreamface_videos'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("dreamface-api-proxy", {
        body: { path: "video-list", method: "GET" }
      });
      if (error || data.error) throw new Error(error?.message || data.error);
      return data.data.list;
    }
  });

  const createVideoMutation = useMutation({
    mutationFn: async () => {
      if (!videoFile) throw new Error("Vui lòng chọn một file video mẫu.");
      if (!audioFile) throw new Error("Vui lòng chọn một file âm thanh.");

      const formData = new FormData();
      formData.append('path', 'upload-video');
      formData.append('method', 'POST');
      formData.append('videoFile', videoFile);
      formData.append('audioFile', audioFile);
      
      const { data, error } = await supabase.functions.invoke("dreamface-api-proxy", {
        body: formData,
      });

      if (error || data.error) throw new Error(error?.message || data.error);
      return data;
    },
    onSuccess: () => {
      showSuccess("Yêu cầu tạo video đã được gửi! Video sẽ sớm xuất hiện trong danh sách.");
      queryClient.invalidateQueries({ queryKey: ['dreamface_videos'] });
      setVideoFile(null);
      setAudioFile(null);
      // You might want to reset the file input fields here if you have a form wrapper
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    }
  });

  const handleCreateVideo = (e: React.FormEvent) => {
    e.preventDefault();
    createVideoMutation.mutate();
  };

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Dreamface Studio</h1>
        <p className="text-muted-foreground mt-1">Tạo video AI và quản lý thư viện của bạn.</p>
      </header>

      <Tabs defaultValue="create" className="w-full">
        <TabsList>
          <TabsTrigger value="create">Tạo Video</TabsTrigger>
          <TabsTrigger value="library">Thư viện</TabsTrigger>
        </TabsList>
        <TabsContent value="create" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin tài khoản</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingInfo ? <Skeleton className="h-10 w-full" /> : accountInfo ? (
                    <div>
                      <p className="text-sm font-medium">Credits còn lại:</p>
                      <p className="text-3xl font-bold text-red-600">{accountInfo.remainCredit}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Không thể tải thông tin tài khoản.</p>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Tạo video từ video mẫu và âm thanh</CardTitle>
                  <CardDescription>Tải lên video mẫu và file âm thanh để tạo video mới.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateVideo} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">File video mẫu</label>
                      <Input type="file" onChange={(e) => setVideoFile(e.target.files ? e.target.files[0] : null)} accept="video/*" required />
                    </div>
                    <div>
                      <label className="text-sm font-medium">File âm thanh</label>
                      <Input type="file" onChange={(e) => setAudioFile(e.target.files ? e.target.files[0] : null)} accept="audio/*" required />
                    </div>
                    <Button type="submit" className="w-full" disabled={createVideoMutation.isPending}>
                      {createVideoMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Film className="mr-2 h-4 w-4" />}
                      Tạo Video
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="library" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <div>
                <CardTitle>Thư viện Video</CardTitle>
                <CardDescription>Danh sách các video đã được tạo.</CardDescription>
              </div>
              <Button variant="outline" size="icon" onClick={() => refetchVideos()} disabled={isLoadingVideos}>
                <RefreshCw className={`h-4 w-4 ${isLoadingVideos ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thumbnail</TableHead>
                    <TableHead>Tiêu đề</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingVideos ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                  ) : videoList && videoList.length > 0 ? (
                    videoList.map((video: any) => (
                      <TableRow key={video._id}>
                        <TableCell><img src={video.coverUrl} alt={video.title} className="h-16 w-16 object-cover rounded-md" /></TableCell>
                        <TableCell className="font-medium">{video.title || 'Không có tiêu đề'}</TableCell>
                        <TableCell>{video.status === 2 ? 'Hoàn thành' : 'Đang xử lý'}</TableCell>
                        <TableCell>{format(new Date(video.createTime), 'dd/MM/yyyy HH:mm', { locale: vi })}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" disabled={video.status !== 2}>
                            <Download className="mr-2 h-4 w-4" /> Tải xuống
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">Chưa có video nào.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DreamfaceStudio;