import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

// UI Components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditKocDialog } from "@/components/koc/EditKocDialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Icons
import { Edit, ThumbsUp, Eye, ShoppingCart, TrendingUp, Megaphone, SlidersHorizontal, CreditCard, FileText, ArrowLeft, LayoutDashboard, Clapperboard, FileArchive, Video, Music, AlertCircle, PlayCircle, UploadCloud, Trash2, Image, Film } from "lucide-react";

// Custom Components
import { VideoPlayerDialog } from "@/components/koc/VideoPlayerDialog";
import { UploadVideoDialog } from "@/components/koc/UploadVideoDialog";
import { EditableFileName } from "@/components/koc/EditableFileName";

// Utils
import { showSuccess, showError } from "@/utils/toast";

// Types
type Koc = {
  id: string;
  name: string;
  field: string | null;
  avatar_url: string | null;
  created_at: string | null;
  folder_path: string | null;
  user_id: string;
};

type KocFile = {
  id: string;
  display_name: string;
  url: string;
  created_at: string | null;
};

// Data fetching
const fetchKocDetails = async (kocId: string) => {
  const { data, error } = await supabase
    .from("kocs")
    .select("id, name, field, avatar_url, created_at, folder_path, user_id")
    .eq("id", kocId)
    .single();
  if (error) throw error;
  return data;
};

const fetchKocFiles = async (kocId: string): Promise<KocFile[]> => {
  const { data, error } = await supabase.functions.invoke("list-koc-files", {
    body: { kocId },
  });
  if (error) throw new Error(`Không thể lấy danh sách tệp: ${error.message}`);
  if (!data.files) throw new Error("Phản hồi từ server không hợp lệ.");
  return data.files;
};

// Mock data
const performanceMetrics = [
  { title: "Tỷ lệ tương tác", value: "4.5%", icon: ThumbsUp, color: "bg-blue-100 text-blue-600" },
  { title: "Lượt tiếp cận", value: "15K", icon: Eye, color: "bg-green-100 text-green-600" },
  { title: "Lượt chuyển đổi", value: "500", icon: ShoppingCart, color: "bg-orange-100 text-orange-600" },
  { title: "ROI", value: "120%", icon: TrendingUp, color: "bg-purple-100 text-purple-600" },
];
const assignedCampaigns = [
  { name: "Summer Style Showcase", status: "Active", startDate: "2024-07-01", endDate: "2024-07-31", budget: "$5,000" },
  { name: "Autumn Beauty Launch", status: "Completed", startDate: "2024-06-15", endDate: "2024-06-30", budget: "$3,200" },
  { name: "Winter Wellness", status: "Planned", startDate: "2024-08-01", endDate: "2024-08-15", budget: "$4,500" },
];
const communicationHistory = [
  { title: "Gửi brief chiến dịch", date: "2024-07-15", icon: Megaphone },
  { title: "Yêu cầu duyệt nội dung", date: "2024-07-18", icon: SlidersHorizontal },
  { title: "Xác nhận thanh toán", date: "2024-07-20", icon: CreditCard },
  { title: "Báo cáo hiệu suất", date: "2024-07-25", icon: FileText },
];
const sourceVideos = [
  { id: 1, title: "Video Review 1", duration: "02:35", createdAt: "2024-07-20" },
  { id: 2, title: "Unboxing Clip", duration: "05:12", createdAt: "2024-07-18" },
  { id: 3, title: "Tutorial Makeup", duration: "10:02", createdAt: "2024-07-15" },
  { id: 4, title: "Daily Vlog", duration: "12:45", createdAt: "2024-07-12" },
  { id: 5, title: "Product Demo", duration: "01:58", createdAt: "2024-07-10" },
];
const sourceAudios = [
  { id: 1, title: "Podcast Episode 5", duration: "15:45" },
  { id: 2, title: "Voiceover for Ad", duration: "00:30" },
  { id: 3, title: "Background Music", duration: "03:15" },
];

// Helper functions
const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase();
const getFileTypeDetails = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'mov', 'webm', 'mkv'].includes(extension)) return { Icon: Clapperboard, bgColor: 'bg-blue-100', iconColor: 'text-blue-600', type: 'video' };
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(extension)) return { Icon: Music, bgColor: 'bg-purple-100', iconColor: 'text-purple-600', type: 'audio' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return { Icon: Image, bgColor: 'bg-green-100', iconColor: 'text-green-600', type: 'image' };
  return { Icon: FileText, bgColor: 'bg-slate-100', iconColor: 'text-slate-600', type: 'other' };
};

const KocDetail = () => {
  const { kocId } = useParams<{ kocId: string }>();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<KocFile | null>(null);
  const [fileToDelete, setFileToDelete] = useState<KocFile | null>(null);
  const [isPlayerOpen, setPlayerOpen] = useState(false);
  const [isUploadOpen, setUploadOpen] = useState(false);

  const { data: koc, isLoading: isKocLoading } = useQuery<Koc>({
    queryKey: ["koc", kocId],
    queryFn: () => fetchKocDetails(kocId!),
    enabled: !!kocId,
  });

  const filesQueryKey = ["kocFiles", kocId];
  const { data: files, isLoading: areFilesLoading, isError, error: filesError } = useQuery<KocFile[]>({
    queryKey: filesQueryKey,
    queryFn: () => fetchKocFiles(kocId!),
    enabled: !!kocId,
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase.functions.invoke("delete-koc-file", { body: { fileId } });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      showSuccess("Xóa tệp thành công!");
      queryClient.invalidateQueries({ queryKey: filesQueryKey });
      setFileToDelete(null);
    },
    onError: (error: Error) => showError(`Lỗi xóa tệp: ${error.message}`),
  });

  const handleFileClick = (file: KocFile) => {
    if (getFileTypeDetails(file.display_name).type === 'video') {
      setSelectedFile(file);
      setPlayerOpen(true);
    } else {
      window.open(file.url, '_blank');
    }
  };

  const handleDeleteFile = (e: React.MouseEvent, file: KocFile) => {
    e.stopPropagation();
    setFileToDelete(file);
  };

  const confirmDelete = () => {
    if (fileToDelete) deleteFileMutation.mutate(fileToDelete.id);
  };

  if (isKocLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-6"><Skeleton className="h-32 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>
          <div className="col-span-1"><Skeleton className="h-64 w-full" /></div>
        </div>
      </div>
    );
  }

  if (!koc) {
    return (
      <div className="p-8">
        <Link to="/list-koc" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách KOC</Link>
        <h1 className="text-2xl font-bold">KOC không tồn tại</h1><p>Không thể tìm thấy KOC bạn đang tìm kiếm.</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 lg:p-8">
        <Link to="/list-koc" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách KOC</Link>
        <header className="mb-6"><h1 className="text-3xl font-bold">Chi tiết KOC của bạn</h1><p className="text-muted-foreground mt-1">Quản lý và theo dõi hiệu suất và hoạt động của KOC ảo của bạn.</p></header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-8">
            <Card className="overflow-hidden">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <Avatar className="h-24 w-24 border-4 border-white shadow-md"><AvatarImage src={koc.avatar_url || undefined} alt={koc.name} /><AvatarFallback className="text-3xl">{getInitials(koc.name)}</AvatarFallback></Avatar>
                  <div>
                    <h2 className="text-2xl font-bold">{koc.name}</h2>
                    <p className="text-muted-foreground">{koc.field || "Virtual KOC"}</p>
                    {koc.created_at && <p className="text-sm text-muted-foreground mt-1">Tham gia {formatDistanceToNow(new Date(koc.created_at), { addSuffix: true, locale: vi })}</p>}
                  </div>
                </div>
                <Button onClick={() => setIsEditDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white"><Edit className="mr-2 h-4 w-4" /> Chỉnh sửa</Button>
              </CardContent>
            </Card>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-transparent w-full justify-start rounded-none border-b p-0 gap-x-2">
                <TabsTrigger value="overview" className="group bg-transparent px-3 py-2 rounded-t-md shadow-none border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:border-red-600 text-muted-foreground data-[state=active]:text-red-700 font-medium transition-colors hover:bg-gray-50">
                  <div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-gray-100 group-data-[state=active]:bg-red-600 transition-colors"><LayoutDashboard className="h-4 w-4 text-gray-500 group-data-[state=active]:text-white transition-colors" /></div><span>Tổng quan</span></div>
                </TabsTrigger>
                <TabsTrigger value="content" className="group bg-transparent px-3 py-2 rounded-t-md shadow-none border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:border-red-600 text-muted-foreground data-[state=active]:text-red-700 font-medium transition-colors hover:bg-gray-50">
                  <div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-gray-100 group-data-[state=active]:bg-red-600 transition-colors"><Clapperboard className="h-4 w-4 text-gray-500 group-data-[state=active]:text-white transition-colors" /></div><span>Video đã tạo</span></div>
                </TabsTrigger>
                <TabsTrigger value="sources" className="group bg-transparent px-3 py-2 rounded-t-md shadow-none border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:border-red-600 text-muted-foreground data-[state=active]:text-red-700 font-medium transition-colors hover:bg-gray-50">
                  <div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-gray-100 group-data-[state=active]:bg-red-600 transition-colors"><FileArchive className="h-4 w-4 text-gray-500 group-data-[state=active]:text-white transition-colors" /></div><span>Nguồn Video/Audio</span></div>
                </TabsTrigger>
                <TabsTrigger value="reports" disabled className="group bg-transparent px-3 py-2 rounded-t-md shadow-none border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:border-red-600 text-muted-foreground data-[state=active]:text-red-700 font-medium transition-colors hover:bg-gray-50">
                  <div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-gray-100 group-data-[state=active]:bg-red-600 transition-colors"><FileText className="h-4 w-4 text-gray-500 group-data-[state=active]:text-white transition-colors" /></div><span>Báo cáo</span></div>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-6">
                <div className="space-y-8">
                  <div><h3 className="text-xl font-semibold mb-4">Chỉ số hiệu suất</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{performanceMetrics.map((metric) => (<Card key={metric.title}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4"><CardTitle className="text-sm font-medium text-muted-foreground">{metric.title}</CardTitle><div className={`flex h-8 w-8 items-center justify-center rounded-full ${metric.color}`}><metric.icon className="h-4 w-4" /></div></CardHeader><CardContent className="p-4 pt-0"><p className="text-2xl font-bold">{metric.value}</p></CardContent></Card>))}</div></div>
                  <div><h3 className="text-xl font-semibold mb-4">Chiến dịch đã tham gia</h3><Card><Table><TableHeader><TableRow><TableHead>Tên chiến dịch</TableHead><TableHead>Trạng thái</TableHead><TableHead>Ngày bắt đầu</TableHead><TableHead>Ngày kết thúc</TableHead><TableHead>Ngân sách</TableHead></TableRow></TableHeader><TableBody>{assignedCampaigns.map((campaign) => (<TableRow key={campaign.name}><TableCell className="font-medium">{campaign.name}</TableCell><TableCell><Badge variant={campaign.status === "Active" ? "default" : "outline"} className={campaign.status === "Active" ? "bg-green-100 text-green-800" : campaign.status === "Completed" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}>{campaign.status}</Badge></TableCell><TableCell>{campaign.startDate}</TableCell><TableCell>{campaign.endDate}</TableCell><TableCell>{campaign.budget}</TableCell></TableRow>))}</TableBody></Table></Card></div>
                </div>
              </TabsContent>
              <TabsContent value="content" className="mt-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold">Danh sách các tệp của KOC</h3>
                  <Button variant="outline" onClick={() => setUploadOpen(true)} disabled={!koc?.folder_path}><UploadCloud className="mr-2 h-4 w-4" /> Tải lên tệp</Button>
                </div>
                {areFilesLoading ? (<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full" />)}</div>) : isError ? (<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Lỗi</AlertTitle><AlertDescription>{filesError.message}</AlertDescription></Alert>) : files && files.length > 0 ? (<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{files.map((file) => { const { Icon, bgColor, iconColor, type } = getFileTypeDetails(file.display_name); return (<Card key={file.id} className="overflow-hidden group"><CardContent className="p-0"><div className="aspect-video flex items-center justify-center relative cursor-pointer" onClick={() => handleFileClick(file)}><div className={`w-full h-full flex items-center justify-center ${bgColor}`}><Icon className={`h-12 w-12 ${iconColor}`} /></div>{type === 'video' && <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><PlayCircle className="h-16 w-16 text-white" /></div>}<Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDeleteFile(e, file)}><Trash2 className="h-4 w-4" /></Button></div><div className="p-3 space-y-1"><EditableFileName fileId={file.id} initialName={file.display_name} queryKey={filesQueryKey} />{file.created_at && <p className="text-xs text-muted-foreground">{format(new Date(file.created_at), "dd/MM/yyyy")}</p>}</div></CardContent></Card>); })}</div>) : (<Card className="text-center py-16"><CardContent><div className="text-center text-muted-foreground"><Film className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">Chưa có tệp nào</h3><p className="mt-1 text-sm">Bấm "Tải lên tệp" để thêm tệp đầu tiên của bạn.</p></div></CardContent></Card>)}
              </TabsContent>
              <TabsContent value="sources" className="mt-6">
                <Accordion type="multiple" className="w-full space-y-4">
                  <AccordionItem value="videos" className="border-none"><AccordionTrigger className="bg-white p-4 rounded-lg border hover:no-underline data-[state=open]:rounded-b-none"><div className="flex items-center justify-between w-full"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-600 text-white"><Video className="h-5 w-5" /></div><h4 className="font-semibold text-lg">Nguồn Video</h4></div><Badge className="bg-red-50 text-red-700">{sourceVideos.length} videos</Badge></div></AccordionTrigger><AccordionContent className="pt-4 p-4 border border-t-0 rounded-b-lg bg-white"><div className="space-y-3">{sourceVideos.map(video => (<div key={video.id} className="flex items-center justify-between p-3 rounded-md border bg-gray-50/50 hover:bg-gray-100 transition-colors cursor-pointer"><div className="flex items-center gap-4"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-100 text-blue-600 flex-shrink-0"><Clapperboard className="h-5 w-5" /></div><div><p className="font-semibold text-sm">{video.title}</p><p className="text-xs text-muted-foreground">Tạo ngày: {format(new Date(video.createdAt), "dd/MM/yyyy")}</p></div></div><p className="text-sm font-medium text-muted-foreground">{video.duration}</p></div>))}</div></AccordionContent></AccordionItem>
                  <AccordionItem value="audios" className="border-none"><AccordionTrigger className="bg-white p-4 rounded-lg border hover:no-underline data-[state=open]:rounded-b-none"><div className="flex items-center justify-between w-full"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-600 text-white"><Music className="h-5 w-5" /></div><h4 className="font-semibold text-lg">Nguồn Audio</h4></div><Badge className="bg-red-50 text-red-700">{sourceAudios.length} audios</Badge></div></AccordionTrigger><AccordionContent className="pt-4 p-4 border border-t-0 rounded-b-lg bg-white"><div className="space-y-2">{sourceAudios.map(audio => (<div key={audio.id} className="flex items-center justify-between p-3 rounded-md border bg-gray-50/50"><div className="flex items-center gap-3"><Music className="h-4 w-4 text-muted-foreground" /><p className="font-medium text-sm">{audio.title}</p></div><p className="text-sm text-muted-foreground">{audio.duration}</p></div>))}</div></AccordionContent></AccordionItem>
                </Accordion>
              </TabsContent>
            </Tabs>
          </div>
          <div className="lg:col-span-1"><Card><CardHeader><CardTitle>Lịch sử trao đổi</CardTitle></CardHeader><CardContent><div className="space-y-6">{communicationHistory.map((item) => (<div key={item.title} className="flex items-start gap-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600"><item.icon className="h-5 w-5" /></div><div><p className="font-semibold">{item.title}</p><p className="text-sm text-muted-foreground">{item.date}</p></div></div>))}</div></CardContent></Card></div>
        </div>
      </div>
      <EditKocDialog isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} koc={koc} />
      <VideoPlayerDialog isOpen={isPlayerOpen} onOpenChange={setPlayerOpen} videoUrl={selectedFile?.url} videoName={selectedFile?.display_name} />
      {koc && (<UploadVideoDialog isOpen={isUploadOpen} onOpenChange={setUploadOpen} folderPath={koc.folder_path!} kocId={koc.id} userId={koc.user_id} kocName={koc.name} />)}
      <AlertDialog open={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Bạn có chắc chắn muốn xóa tệp?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác. Tệp "{fileToDelete?.display_name}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} disabled={deleteFileMutation.isPending}>{deleteFileMutation.isPending ? "Đang xóa..." : "Xóa"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default KocDetail;