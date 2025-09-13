import { useState, useMemo, MouseEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, intervalToDuration } from "date-fns";
import { vi } from "date-fns/locale";

// UI Components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditKocDialog } from "@/components/koc/EditKocDialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Icons
import { Edit, ThumbsUp, Eye, ShoppingCart, TrendingUp, SlidersHorizontal, CreditCard, FileText, ArrowLeft, LayoutDashboard, Clapperboard, FileArchive, Video, Music, AlertCircle, PlayCircle, UploadCloud, Trash2, Image, Film, Plus, Users, Heart, CalendarDays, Bot, MoreHorizontal, Loader2, Mic } from "lucide-react";

// Custom Components
import { VideoPlayerDialog } from "@/components/koc/VideoPlayerDialog";
import { UploadVideoDialog } from "@/components/koc/UploadVideoDialog";
import { EditableFileName } from "@/components/koc/EditableFileName";
import { ViewScriptContentDialog } from "@/components/content/ViewScriptContentDialog";
import { ViewScriptLogDialog } from "@/components/content/ViewScriptLogDialog";

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
  channel_url: string | null;
  follower_count: number | null;
  like_count: number | null;
  video_count: number | null;
  channel_nickname: string | null;
  channel_unique_id: string | null;
  channel_created_at: string | null;
};

type KocFile = {
  id: string;
  display_name: string;
  url: string;
  created_at: string | null;
  r2_key: string;
};

type VideoScript = {
  id: string;
  name: string;
  script_content: string | null;
  created_at: string;
  ai_prompt: string | null;
  news_posts: { 
    content: string | null;
    voice_task_id: string | null;
  } | null;
};

type VoiceTask = {
  id: string;
  status: string;
  audio_url: string | null;
};

// Data fetching
const fetchKocDetails = async (kocId: string) => {
  const { data, error } = await supabase
    .from("kocs")
    .select("*, follower_count, like_count, video_count, channel_nickname, channel_unique_id, channel_created_at")
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
  return data.files as KocFile[];
};

const fetchVideoScripts = async (kocId: string) => {
  const { data, error } = await supabase
    .from('video_scripts')
    .select('*, news_posts(content, voice_task_id)')
    .eq('koc_id', kocId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as VideoScript[];
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

// Helper functions
const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase();
const getFileTypeDetails = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'mov', 'webm', 'mkv'].includes(extension)) return { Icon: Clapperboard, bgColor: 'bg-blue-100', iconColor: 'text-blue-600', type: 'video' };
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(extension)) return { Icon: Music, bgColor: 'bg-purple-100', iconColor: 'text-purple-600', type: 'audio' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return { Icon: Image, bgColor: 'bg-green-100', iconColor: 'text-green-600', type: 'image' };
  return { Icon: FileText, bgColor: 'bg-slate-100', iconColor: 'text-slate-600', type: 'other' };
};

const formatDetailedDistanceToNow = (dateString: string | null): string => {
  if (!dateString) return "Không rõ";
  const date = new Date(dateString);
  const duration = intervalToDuration({ start: date, end: new Date() });
  const parts = [];
  if (duration.years && duration.years > 0) parts.push(`${duration.years} năm`);
  if (duration.months && duration.months > 0) parts.push(`${duration.months} tháng`);
  if (duration.days && duration.days > 0) parts.push(`${duration.days} ngày`);
  if (parts.length === 0) return "Hôm nay";
  return parts.join(', ');
};

const formatStatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "N/A";
  if (num < 1000) return num.toString();
  if (num < 1000000) return (num / 1000).toFixed(1).replace('.0', '') + "K";
  return (num / 1000000).toFixed(1).replace('.0', '') + "M";
};

const KocDetail = () => {
  const { kocId } = useParams<{ kocId: string }>();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<KocFile | null>(null);
  const [filesToDelete, setFilesToDelete] = useState<KocFile[]>([]);
  const [isPlayerOpen, setPlayerOpen] = useState(false);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [isSourceVideoUploadOpen, setSourceVideoUploadOpen] = useState(false);
  const [isSourceAudioUploadOpen, setSourceAudioUploadOpen] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [selectedScript, setSelectedScript] = useState<VideoScript | null>(null);
  const [isViewScriptOpen, setIsViewScriptOpen] = useState(false);
  const [isViewLogOpen, setIsViewLogOpen] = useState(false);
  const [scriptToDelete, setScriptToDelete] = useState<VideoScript | null>(null);

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

  const { data: videoScripts, isLoading: areScriptsLoading } = useQuery<VideoScript[]>({
    queryKey: ["video_scripts", kocId],
    queryFn: () => fetchVideoScripts(kocId!),
    enabled: !!kocId,
  });

  const voiceTaskIds = useMemo(() => 
    videoScripts
        ?.map(script => script.news_posts?.voice_task_id)
        .filter((id): id is string => !!id) 
    || [], 
  [videoScripts]);

  const { data: voiceTasks } = useQuery<VoiceTask[]>({
      queryKey: ['voice_tasks_for_scripts', voiceTaskIds],
      queryFn: async () => {
          if (voiceTaskIds.length === 0) return [];
          const { data, error } = await supabase
              .from('voice_tasks')
              .select('id, status, audio_url')
              .in('id', voiceTaskIds);
          if (error) throw error;
          return data;
      },
      enabled: voiceTaskIds.length > 0,
  });

  const voiceTasksMap = useMemo(() => {
      if (!voiceTasks) return new Map<string, VoiceTask>();
      return new Map(voiceTasks.map(task => [task.id, task]));
  }, [voiceTasks]);

  const generatedFiles = useMemo(() => files?.filter(file => file.r2_key.includes('/generated/')) || [], [files]);
  const sourceVideos = useMemo(() => files?.filter(file => file.r2_key.includes('/sources/videos/')) || [], [files]);
  const sourceAudios = useMemo(() => files?.filter(file => file.r2_key.includes('/sources/audios/')) || [], [files]);

  const deleteFilesMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      const { error } = await supabase.functions.invoke("delete-koc-files-batch", { body: { fileIds } });
      if (error) throw new Error(error.message);
    },
    onMutate: async (fileIdsToDelete) => {
      await queryClient.cancelQueries({ queryKey: filesQueryKey });
      const previousFiles = queryClient.getQueryData<KocFile[]>(filesQueryKey);
      queryClient.setQueryData<KocFile[]>(filesQueryKey, (old) =>
        old ? old.filter(file => !fileIdsToDelete.includes(file.id)) : []
      );
      setSelectedFileIds(prev => prev.filter(id => !fileIdsToDelete.includes(id)));
      return { previousFiles };
    },
    onError: (err, variables, context) => {
      if (context?.previousFiles) {
        queryClient.setQueryData(filesQueryKey, context.previousFiles);
      }
      showError(`Lỗi xóa tệp: ${err.message}`);
    },
    onSuccess: () => {
      showSuccess("Xóa các tệp đã chọn thành công!");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: filesQueryKey });
    },
  });

  const deleteScriptMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const { error } = await supabase.from('video_scripts').delete().eq('id', scriptId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa kịch bản thành công!");
      queryClient.invalidateQueries({ queryKey: ['video_scripts', kocId] });
      setScriptToDelete(null);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
      setScriptToDelete(null);
    },
  });

  const handleFileSelect = (fileId: string) => {
    setSelectedFileIds(prev => 
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

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
    setFilesToDelete([file]);
  };

  const handleBulkDelete = () => {
    const toDelete = files?.filter(file => selectedFileIds.includes(file.id)) || [];
    setFilesToDelete(toDelete);
  };

  const confirmDelete = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (filesToDelete.length > 0) {
      deleteFilesMutation.mutate(filesToDelete.map(f => f.id));
      setFilesToDelete([]);
    }
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
                <TabsTrigger value="auto-scripts" className="group bg-transparent px-3 py-2 rounded-t-md shadow-none border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:border-red-600 text-muted-foreground data-[state=active]:text-red-700 font-medium transition-colors hover:bg-gray-50">
                  <div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-gray-100 group-data-[state=active]:bg-red-600 transition-colors"><Bot className="h-4 w-4 text-gray-500 group-data-[state=active]:text-white transition-colors" /></div><span>Kịch bản tự động</span></div>
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
                  <div>
                    <h3 className="text-xl font-semibold">Danh sách các tệp của KOC</h3>
                    {selectedFileIds.length > 0 && <p className="text-sm text-muted-foreground">{selectedFileIds.length} tệp đã được chọn</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedFileIds.length > 0 && <Button variant="destructive" onClick={handleBulkDelete}><Trash2 className="mr-2 h-4 w-4" /> Xóa ({selectedFileIds.length})</Button>}
                    <Button variant="outline" onClick={() => setUploadOpen(true)} disabled={!koc?.folder_path}><UploadCloud className="mr-2 h-4 w-4" /> Tải lên tệp</Button>
                  </div>
                </div>
                {areFilesLoading ? (<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full" />)}</div>) : isError ? (<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Lỗi</AlertTitle><AlertDescription>{filesError.message}</AlertDescription></Alert>) : generatedFiles && generatedFiles.length > 0 ? (<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{generatedFiles.map((file) => { const { Icon, bgColor, iconColor, type } = getFileTypeDetails(file.display_name); const isSelected = selectedFileIds.includes(file.id); return (<Card key={file.id} className="overflow-hidden group relative"><Checkbox checked={isSelected} onCheckedChange={() => handleFileSelect(file.id)} className={`absolute top-2 left-2 z-10 h-5 w-5 bg-white transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} /><CardContent className="p-0"><div className="aspect-video flex items-center justify-center relative cursor-pointer" onClick={() => handleFileClick(file)}><div className={`w-full h-full flex items-center justify-center ${bgColor}`}><Icon className={`h-12 w-12 ${iconColor}`} /></div>{type === 'video' && <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><PlayCircle className="h-16 w-16 text-white" /></div>}<Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDeleteFile(e, file)}><Trash2 className="h-4 w-4" /></Button></div><div className="p-3 space-y-1"><EditableFileName fileId={file.id} initialName={file.display_name} queryKey={filesQueryKey} />{file.created_at && <p className="text-xs text-muted-foreground">{format(new Date(file.created_at), "dd/MM/yyyy")}</p>}</div></CardContent></Card>); })}</div>) : (<Card className="text-center py-16"><CardContent><div className="text-center text-muted-foreground"><Film className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">Chưa có tệp nào</h3><p className="mt-1 text-sm">Bấm "Tải lên tệp" để thêm tệp đầu tiên của bạn.</p></div></CardContent></Card>)}
              </TabsContent>
              <TabsContent value="sources" className="mt-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Quản lý tệp nguồn</h3>
                    {selectedFileIds.length > 0 && <Button variant="destructive" onClick={handleBulkDelete}><Trash2 className="mr-2 h-4 w-4" /> Xóa ({selectedFileIds.length})</Button>}
                </div>
                <Accordion type="multiple" className="w-full space-y-4">
                  <AccordionItem value="videos" className="border-none">
                    <AccordionTrigger className="bg-white p-4 rounded-lg border hover:no-underline data-[state=open]:rounded-b-none">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-600 text-white"><Video className="h-5 w-5" /></div><h4 className="font-semibold text-lg">Nguồn Video</h4></div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-red-50 text-red-700">{sourceVideos.length} videos</Badge>
                              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSourceVideoUploadOpen(true); }} disabled={!koc?.folder_path}><Plus className="mr-2 h-4 w-4" /> Thêm video</Button>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 p-4 border border-t-0 rounded-b-lg bg-white">
                        {areFilesLoading ? <Skeleton className="h-20 w-full" /> : sourceVideos.length > 0 ? (
                            <div className="space-y-3">
                                {sourceVideos.map(file => { const isSelected = selectedFileIds.includes(file.id); return (
                                    <div key={file.id} className="group flex items-center justify-between p-3 rounded-md border bg-gray-50/50 hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center gap-4 flex-grow min-w-0 cursor-pointer" onClick={() => handleFileClick(file)}>
                                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-100 text-blue-600 flex-shrink-0"><Clapperboard className="h-5 w-5" /></div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm truncate" title={file.display_name}>{file.display_name}</p>
                                                {file.created_at && <p className="text-xs text-muted-foreground">Tải lên: {format(new Date(file.created_at), "dd/MM/yyyy")}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pl-2">
                                            <Checkbox checked={isSelected} onCheckedChange={() => handleFileSelect(file.id)} className={`transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleDeleteFile(e, file)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        ) : (<p className="text-sm text-muted-foreground text-center py-4">Chưa có video nguồn nào.</p>)}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="audios" className="border-none">
                    <AccordionTrigger className="bg-white p-4 rounded-lg border hover:no-underline data-[state=open]:rounded-b-none">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-600 text-white"><Music className="h-5 w-5" /></div><h4 className="font-semibold text-lg">Nguồn Audio</h4></div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-red-50 text-red-700">{sourceAudios.length} audios</Badge>
                              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSourceAudioUploadOpen(true); }} disabled={!koc?.folder_path}><Plus className="mr-2 h-4 w-4" /> Thêm audio</Button>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 p-4 border border-t-0 rounded-b-lg bg-white">
                        {areFilesLoading ? <Skeleton className="h-20 w-full" /> : sourceAudios.length > 0 ? (
                            <div className="space-y-3">
                                {sourceAudios.map(file => { const isSelected = selectedFileIds.includes(file.id); return (
                                    <div key={file.id} className="group flex items-center justify-between p-3 rounded-md border bg-gray-50/50 hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center gap-4 flex-grow min-w-0 cursor-pointer" onClick={() => handleFileClick(file)}>
                                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-purple-100 text-purple-600 flex-shrink-0"><Music className="h-5 w-5" /></div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm truncate" title={file.display_name}>{file.display_name}</p>
                                                {file.created_at && <p className="text-xs text-muted-foreground">Tải lên: {format(new Date(file.created_at), "dd/MM/yyyy")}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pl-2">
                                            <Checkbox checked={isSelected} onCheckedChange={() => handleFileSelect(file.id)} className={`transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleDeleteFile(e, file)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        ) : (<p className="text-sm text-muted-foreground text-center py-4">Chưa có audio nguồn nào.</p>)}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>
              <TabsContent value="auto-scripts" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Danh sách kịch bản tự động</CardTitle>
                    <CardDescription>Các kịch bản được tạo tự động cho KOC này.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tên kịch bản</TableHead>
                          <TableHead>Nguồn tin tức</TableHead>
                          <TableHead>Ngày tạo</TableHead>
                          <TableHead>Nội dung</TableHead>
                          <TableHead>Log</TableHead>
                          <TableHead>Voice</TableHead>
                          <TableHead className="text-right">Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {areScriptsLoading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ) : videoScripts && videoScripts.length > 0 ? (
                          videoScripts.map((script) => {
                            const voiceTaskId = script.news_posts?.voice_task_id;
                            const voiceTask = voiceTaskId ? voiceTasksMap.get(voiceTaskId) : null;
                            return (
                              <TableRow key={script.id}>
                                <TableCell className="font-medium">{script.name}</TableCell>
                                <TableCell>
                                  <p className="max-w-xs truncate" title={script.news_posts?.content || ''}>
                                    {script.news_posts?.content || 'N/A'}
                                  </p>
                                </TableCell>
                                <TableCell>
                                  {format(new Date(script.created_at), "dd/MM/yyyy HH:mm", { locale: vi })}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="link"
                                    className="p-0 h-auto"
                                    onClick={() => {
                                      setSelectedScript(script);
                                      setIsViewScriptOpen(true);
                                    }}
                                  >
                                    Xem chi tiết
                                  </Button>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="link"
                                    className="p-0 h-auto"
                                    disabled={!script.ai_prompt}
                                    onClick={() => {
                                      setSelectedScript(script);
                                      setIsViewLogOpen(true);
                                    }}
                                  >
                                    Xem log
                                  </Button>
                                </TableCell>
                                <TableCell>
                                  {voiceTask ? (
                                      voiceTask.status === 'done' && voiceTask.audio_url ? (
                                          <audio controls src={voiceTask.audio_url} className="h-8 w-full max-w-[150px]" />
                                      ) : voiceTask.status === 'doing' ? (
                                          <Badge variant="outline" className="text-blue-800 border-blue-200">
                                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                              Đang xử lý
                                          </Badge>
                                      ) : voiceTask.status === 'error' ? (
                                          <Badge variant="destructive">Lỗi</Badge>
                                      ) : (
                                          <Badge variant="secondary">Đang chờ</Badge>
                                      )
                                  ) : (
                                      <span className="text-muted-foreground text-xs">Chưa có</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" className="h-8 w-8 p-0">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => setScriptToDelete(script)}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Xóa
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                              Chưa có kịch bản tự động nào.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="M20.93 7.03a2.53 2.53 0 0 0-2.5-2.5c-2.47 0-2.9 1.23-3.43 2.16-.53-.93-1-2.16-3.43-2.16a2.53 2.53 0 0 0-2.5 2.5c0 1.12.49 3.68 3.22 6.06C14.2 14.94 16.9 13.3 20.93 7.03Z" fill="#25F4EE"></path><path d="M1.07 14.45a2.53 2.53 0 0 0 2.5 2.5c2.47 0 2.9-1.23 3.43-2.16.53.93 1 2.16 3.43 2.16a2.53 2.53 0 0 0 2.5-2.5c0-1.12-.49-3.68-3.22-6.06C10.8 6.54 8.1 8.18 4.07 14.45Z" fill="#FF0050"></path><path d="M12.5 2.5h-1v19h1v-19Z" fill="#000000"></path></svg>
                  Thông tin kênh TikTok
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {koc.channel_unique_id ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 border">
                        <AvatarImage src={koc.avatar_url || undefined} alt={koc.channel_nickname || koc.name} />
                        <AvatarFallback>{getInitials(koc.channel_nickname || koc.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-lg">{koc.channel_nickname}</p>
                        <p className="text-sm text-muted-foreground">@{koc.channel_unique_id}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-4 border-t">
                      <div className="flex flex-col items-center p-2 rounded-lg hover:bg-gray-50">
                        <Users className="h-6 w-6 mb-1 text-blue-500" />
                        <p className="font-bold text-base">{formatStatNumber(koc.follower_count)}</p>
                        <p className="text-xs text-muted-foreground">Followers</p>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg hover:bg-gray-50">
                        <Heart className="h-6 w-6 mb-1 text-red-500" />
                        <p className="font-bold text-base">{formatStatNumber(koc.like_count)}</p>
                        <p className="text-xs text-muted-foreground">Likes</p>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg hover:bg-gray-50">
                        <Video className="h-6 w-6 mb-1 text-green-500" />
                        <p className="font-bold text-base">{formatStatNumber(koc.video_count)}</p>
                        <p className="text-xs text-muted-foreground">Videos</p>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground pt-4 border-t">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      <span>Tuổi tài khoản: <span className="font-medium text-foreground">{formatDetailedDistanceToNow(koc.channel_created_at)}</span></span>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>Chưa có dữ liệu kênh.</p>
                    <p className="text-xs mt-1">Hãy quét kênh để cập nhật thông tin.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <EditKocDialog isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} koc={koc} />
      <VideoPlayerDialog isOpen={isPlayerOpen} onOpenChange={setPlayerOpen} videoUrl={selectedFile?.url} videoName={selectedFile?.display_name} />
      {koc && koc.folder_path && (<UploadVideoDialog isOpen={isUploadOpen} onOpenChange={setUploadOpen} folderPath={`${koc.folder_path}/generated`} kocId={koc.id} userId={koc.user_id} kocName={koc.name} />)}
      {koc && koc.folder_path && (<UploadVideoDialog isOpen={isSourceVideoUploadOpen} onOpenChange={setSourceVideoUploadOpen} folderPath={`${koc.folder_path}/sources/videos`} kocId={koc.id} userId={koc.user_id} kocName={koc.name} accept="video/*" />)}
      {koc && koc.folder_path && (<UploadVideoDialog isOpen={isSourceAudioUploadOpen} onOpenChange={setSourceAudioUploadOpen} folderPath={`${koc.folder_path}/sources/audios`} kocId={koc.id} userId={koc.user_id} kocName={koc.name} accept="audio/*" />)}
      <AlertDialog open={filesToDelete.length > 0} onOpenChange={() => setFilesToDelete([])}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác. {filesToDelete.length} tệp sẽ bị xóa vĩnh viễn.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} disabled={deleteFilesMutation.isPending}>{deleteFilesMutation.isPending ? "Đang xóa..." : "Xóa"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ViewScriptContentDialog isOpen={isViewScriptOpen} onOpenChange={setIsViewScriptOpen} title={selectedScript?.name || null} content={selectedScript?.script_content || null} />
      <ViewScriptLogDialog isOpen={isViewLogOpen} onOpenChange={setIsViewLogOpen} title={selectedScript?.name || null} prompt={selectedScript?.ai_prompt || null} />
      <AlertDialog open={!!scriptToDelete} onOpenChange={(isOpen) => !isOpen && setScriptToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác. Kịch bản "{scriptToDelete?.name}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => scriptToDelete && deleteScriptMutation.mutate(scriptToDelete.id)} disabled={deleteScriptMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleteScriptMutation.isPending ? "Đang xóa..." : "Xóa"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default KocDetail;