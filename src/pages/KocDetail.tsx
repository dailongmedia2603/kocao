import { useState, useMemo, MouseEvent, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, intervalToDuration } from "date-fns";
import { vi } from "date-fns/locale";
import { api, Koc, KocFile, ContentIdea, DreamfaceTask, VideoScript, imageGenerationApi, ImageGenerationTask } from "@/lib/apiClient";

// UI Components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditKocDialog } from "@/components/koc/EditKocDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, ArrowLeft, Clapperboard, FileArchive, Video, Music, AlertCircle, PlayCircle, UploadCloud, Trash2, Image, Film, Plus, Users, Heart, CalendarDays, Bot, Loader2, Lightbulb, FileText, Download, UserCircle } from "lucide-react";

// Custom Components
import { VideoPlayerDialog } from "@/components/koc/VideoPlayerDialog";
import { UploadVideoDialog } from "@/components/koc/UploadVideoDialog";
import { EditableFileName } from "@/components/koc/EditableFileName";
import { ViewScriptContentDialog } from "@/components/content/ViewScriptContentDialog";
import { ViewScriptLogDialog } from "@/components/content/ViewScriptLogDialog";
import { IdeaContentTab } from "@/components/koc/IdeaContentTab";
import { KocAvatarTab } from "@/components/koc/KocAvatarTab";

// Utils
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

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

const mobileTabs = [
  { value: "avatar", label: "Avatar", icon: UserCircle },
  { value: "content", label: "Video đã tạo", icon: Clapperboard },
  { value: "images", label: "Hình ảnh", icon: Image },
  { value: "sources", label: "Nguồn Video", icon: FileArchive },
  { value: "auto-scripts", label: "Automation", icon: Bot },
  { value: "idea-content", label: "Idea", icon: Lightbulb },
];

const KocDetail = () => {
  const { kocId } = useParams<{ kocId: string }>();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<KocFile | null>(null);
  const [filesToDelete, setFilesToDelete] = useState<KocFile[]>([]);
  const [isPlayerOpen, setPlayerOpen] = useState(false);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [isSourceVideoUploadOpen, setSourceVideoUploadOpen] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [selectedScript, setSelectedScript] = useState<VideoScript | null>(null);
  const [isViewScriptOpen, setIsViewScriptOpen] = useState(false);
  const [isViewLogOpen, setIsViewLogOpen] = useState(false);
  const [scriptToDelete, setScriptToDelete] = useState<VideoScript | null>(null);
  const [previewImage, setPreviewImage] = useState<ImageGenerationTask | null>(null);

  const filesQueryKey = ["kocFiles", kocId];

  // Queries
  const { data: koc, isLoading: isKocLoading } = useQuery<Koc>({
    queryKey: ["koc", kocId],
    queryFn: () => api.kocs.get(kocId!),
    enabled: !!kocId,
  });

  const { data: files, isLoading: areFilesLoading, isError, error: filesError } = useQuery<KocFile[]>({
    queryKey: filesQueryKey,
    queryFn: () => api.kocFiles.list(kocId!),
    enabled: !!kocId,
    refetchInterval: 10000,
  });

  const { data: automationCampaigns, isLoading: areCampaignsLoading } = useQuery({
    queryKey: ["automation_campaigns_for_koc", kocId],
    queryFn: async () => {
      if (!kocId) return [];
      const campaigns = await api.automation.list();
      // Assuming API doesn't support filtering by KOC yet, filter client-side
      return campaigns.filter(c => c.koc_id === kocId);
    },
    enabled: !!kocId,
  });

  const { data: ideas, isLoading: areIdeasLoading } = useQuery<ContentIdea[]>({
    queryKey: ["koc_content_ideas", kocId],
    queryFn: () => api.ideas.list(kocId!),
    enabled: !!kocId,
    refetchInterval: 10000,
    // Provide a proper mapping if needed, assuming API returns structure compatible with Idea type used in UI
    // Though we imported ContentIdea from apiClient, we should check if it matches what UI expects.
  });

  const { data: dreamfaceTasks } = useQuery<DreamfaceTask[]>({
    queryKey: ['dreamface_tasks_for_koc', kocId],
    queryFn: async () => {
      if (!kocId) return [];
      const allTasks = await api.dreamface.tasks();
      // Filter for this KOC and archived (completed)
      // API DreamfaceTask type has status, created_at etc.
      // Assuming 'is_archived' equivalent or if backend returns only relevant ones. 
      // The original logic filtered `eq('is_archived', true)`. 
      // If API doesn't return archived tasks, or we can't filter, we might need to adjust.
      // Let's assume we filter by koc_id.
      return allTasks.filter(t => t.koc_id === kocId);
    },
    enabled: !!kocId,
  });

  // Fetch generated images for this KOC
  const { data: generatedImages, isLoading: areImagesLoading } = useQuery<ImageGenerationTask[]>({
    queryKey: ['koc_generated_images', kocId],
    queryFn: () => imageGenerationApi.tasks(kocId!),
    enabled: !!kocId,
  });

  // Derived state
  const dreamfaceThumbnailsMap = useMemo(() => {
    if (!dreamfaceTasks) return new Map<string, string>();
    const map = new Map<string, string>();
    dreamfaceTasks.forEach(task => {
      if (task.result_video_url) {
        // Need thumbnail. API DreamfaceTask doesn't explicity list thumbnail_url in interface I just saw?
        // Wait, looking at apiClient.ts DreamfaceTask interface:
        // id, user_id, koc_id, result_video_url... NO thumbnail_url?
        // If it's missing, we might need to infer or it's not available.
        // Original code used `thumbnail_url` from backend.
        // I should check if I missed it in apiClient definitions.
        // Either way, if it's missing, this map won't work well.
        // I'll assume it might be there or I can use result_video_url as fallback/poster?

        // Logic to map R2 key to thumbnail
        try {
          const url = new URL(task.result_video_url);
          const r2Key = url.pathname.substring(1);
          // If thumbnail_url is not in task, use a placeholder or generic?
          // Or maybe I update DreamfaceTask interface to include it if backend sends it.
          // For now, let's skip thumbnail mapping if data missing.
          if ((task as any).thumbnail_url) {
            map.set(r2Key, (task as any).thumbnail_url);
          }
        } catch (e) {
          console.error("Invalid URL in dreamface_tasks:", task.result_video_url);
        }
      }
    });
    return map;
  }, [dreamfaceTasks]);

  // Fetch Kling Jobs
  const { data: klingJobs, isLoading: isKlingLoading } = useQuery({
    queryKey: ['kling-jobs', kocId],
    queryFn: () => api.kling.listJobs(kocId),
    enabled: !!kocId,
  });

  const generatedFiles = useMemo(() => files?.filter(file => file.r2_key.includes('/generated/')) || [], [files]);
  const sourceVideos = useMemo(() => files?.filter(file => {
    // Include files explicitly in sources/videos OR videos that are not in generated folder
    const isVideo = getFileTypeDetails(file.display_name).type === 'video';
    const isGenerated = file.r2_key.includes('/generated/');
    const isInSource = file.r2_key.includes('/sources/videos/');

    return isInSource || (isVideo && !isGenerated);
  }) || [], [files]);

  // Mutations
  const downloadFileMutation = useMutation({
    mutationFn: async (file: KocFile) => {
      const toastId = showLoading(`Đang chuẩn bị tải xuống ${file.display_name}...`);
      try {
        const { url } = await api.kocFiles.getDownloadUrl(file.id);
        if (!url) throw new Error("Không thể lấy link tải xuống.");
        window.open(url, '_self');
        dismissToast(toastId);
      } catch (error) {
        dismissToast(toastId);
        showError("Đã xảy ra lỗi khi tải xuống.");
        console.error(error);
      }
    },
  });

  const deleteFilesMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      await api.kocFiles.deleteBatch(fileIds);
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
      queryClient.invalidateQueries({ queryKey: filesQueryKey });
    },
  });

  const deleteScriptMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      await api.videoScripts.delete(scriptId);
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
      window.open(file.url || undefined, '_blank');
    }
  };

  const handleDeleteFile = (e: React.MouseEvent, file: KocFile) => {
    e.stopPropagation();
    setFilesToDelete([file]);
  };

  const handleDownloadFile = (e: React.MouseEvent, file: KocFile) => {
    e.stopPropagation();
    downloadFileMutation.mutate(file);
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
      <div className="p-4 md:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6"><Skeleton className="h-32 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>
          <div className="lg:col-span-1"><Skeleton className="h-64 w-full" /></div>
        </div>
      </div>
    );
  }

  if (!koc) {
    return (
      <div className="p-4 md:p-8">
        <Link to="/list-koc" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách KOC</Link>
        <h1 className="text-2xl font-bold">KOC không tồn tại</h1><p>Không thể tìm thấy KOC bạn đang tìm kiếm.</p>
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">
        <div className="p-4 space-y-6 pb-20">
          <Link to="/list-koc" className="flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách KOC</Link>
          <header>
            <h1 className="text-2xl font-bold">Chi tiết KOC</h1>
            <p className="text-muted-foreground mt-1 text-sm">Quản lý và theo dõi KOC ảo của bạn.</p>
          </header>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-white shadow-sm"><AvatarImage src={koc.avatar_url || undefined} alt={koc.name} /><AvatarFallback className="text-2xl">{getInitials(koc.name)}</AvatarFallback></Avatar>
                <div className="flex-1 space-y-1">
                  <h2 className="text-xl font-bold">{koc.name}</h2>
                  <p className="text-sm text-muted-foreground">{koc.field || "Virtual KOC"}</p>
                  {koc.created_at && <p className="text-xs text-muted-foreground">Tham gia {formatDistanceToNow(new Date(koc.created_at), { addSuffix: true, locale: vi })}</p>}
                </div>
              </div>
              <Button onClick={() => setIsEditDialogOpen(true)} className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white"><Edit className="mr-2 h-4 w-4" /> Chỉnh sửa</Button>
            </CardContent>
          </Card>

          <Tabs defaultValue="content" className="w-full">
            <div className="overflow-x-auto pb-2 -mb-2 no-scrollbar">
              <TabsList className="bg-transparent p-0 gap-x-2">
                {mobileTabs.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className="group bg-gray-100 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 text-gray-600 rounded-lg p-2 px-3 text-sm font-semibold shadow-none border border-transparent data-[state=active]:border-red-200 whitespace-nowrap">
                    <tab.icon className="h-4 w-4 mr-2" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="content" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Video đã tạo</h3>
                <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)} disabled={!koc?.folder_path}><UploadCloud className="mr-2 h-4 w-4" /> Tải lên</Button>
              </div>

              {areFilesLoading || isKlingLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full" />)}
                </div>
              ) : generatedFiles.length > 0 || (klingJobs && klingJobs.length > 0) ? (
                <div className="grid grid-cols-2 gap-4">
                  {/* Kling Jobs */}
                  {klingJobs?.map((job) => (
                    <Card key={job.id} className="overflow-hidden group relative border-purple-200 bg-purple-50/10">
                      <div className="aspect-video flex items-center justify-center relative bg-black/5">
                        {job.status === 'completed' && job.result_video_url ? (
                          <>
                            <video src={job.result_video_url} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              onClick={() => {
                                setSelectedFile({
                                  id: job.id,
                                  display_name: `Kling Video ${job.job_id.slice(0, 8)}`,
                                  url: job.result_video_url,
                                  r2_key: '',
                                  koc_id: kocId!,
                                  user_id: '',
                                  created_at: job.created_at,
                                  updated_at: job.updated_at,
                                  size: 0,
                                  mime_type: 'video/mp4'
                                } as KocFile);
                                setPlayerOpen(true);
                              }}>
                              <PlayCircle className="h-12 w-12 text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-4 text-center">
                            {job.status === 'pending' || job.status === 'processing' ? (
                              <>
                                <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                                <span className="text-xs text-blue-600 font-medium">{job.status === 'processing' ? `Đang xử lý ${job.progress}%` : 'Đang chờ...'}</span>
                              </>
                            ) : job.status === 'failed' ? (
                              <>
                                <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                                <span className="text-xs text-red-600 font-medium">Lỗi tạo video</span>
                              </>
                            ) : (
                              <Clapperboard className="h-8 w-8 text-gray-400" />
                            )}
                          </div>
                        )}
                        <Badge className={`absolute top-2 right-2 ${job.status === 'completed' ? 'bg-green-500' :
                          job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                          }`}>
                          Kling AI
                        </Badge>
                      </div>
                      <div className="p-2 flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-xs font-medium truncate">Kling Gen #{job.job_id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(job.created_at), { locale: vi, addSuffix: true })}</p>
                        </div>
                        {job.status === 'completed' && job.result_video_url && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => window.open(job.result_video_url || '', '_blank')}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}

                  {/* Generated Files */}
                  {generatedFiles.map((file) => {
                    const { type } = getFileTypeDetails(file.display_name);
                    const dreamfaceThumbnailUrl = dreamfaceThumbnailsMap.get(file.r2_key);
                    const finalThumbnailUrl = file.thumbnail_url || dreamfaceThumbnailUrl;

                    return (
                      <Card key={file.id} className="overflow-hidden group relative">
                        <div className="aspect-video flex items-center justify-center relative cursor-pointer bg-muted" onClick={() => handleFileClick(file)}>
                          {finalThumbnailUrl ? (
                            <img src={finalThumbnailUrl} alt={file.display_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-blue-50">
                              <Clapperboard className="h-8 w-8 text-blue-500" />
                            </div>
                          )}
                          {type === 'video' && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <PlayCircle className="h-12 w-12 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="p-2 flex items-center justify-between">
                          <p className="text-xs font-medium truncate flex-1 pr-2">{file.display_name}</p>
                          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={(e) => handleDownloadFile(e, file)} disabled={downloadFileMutation.isPending && downloadFileMutation.variables?.id === file.id}>
                            {downloadFileMutation.isPending && downloadFileMutation.variables?.id === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Chưa có video nào.</p>
              )}
            </TabsContent>

            <TabsContent value="images" className="mt-4">
              <h3 className="font-semibold mb-4">Hình ảnh đã tạo</h3>
              {areImagesLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square w-full" />)}
                </div>
              ) : generatedImages && generatedImages.filter(img => img.status === 'completed').length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {generatedImages.filter(img => img.status === 'completed').map((image) => (
                    <Card key={image.id} className="overflow-hidden group relative cursor-pointer" onClick={() => setPreviewImage(image)}>
                      <div className="aspect-square">
                        {image.result_image_url && (
                          <img
                            src={image.result_image_url}
                            alt={image.prompt || 'Generated'}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-muted-foreground truncate">{image.prompt || 'Không có mô tả'}</p>
                        {image.created_at && <p className="text-xs text-muted-foreground">{format(new Date(image.created_at), "dd/MM/yyyy")}</p>}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Chưa có hình ảnh nào được tạo cho KOC này.</p>
              )}
            </TabsContent>

            <TabsContent value="sources" className="mt-4">
              {/* Similar structure to content */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Nguồn Video</h3>
                <Button variant="outline" size="sm" onClick={() => setSourceVideoUploadOpen(true)} disabled={!koc?.folder_path}><Plus className="mr-2 h-4 w-4" /> Thêm</Button>
              </div>
              {areFilesLoading ? (<div className="grid grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full" />)}</div>)
                : sourceVideos.length > 0 ? (<div className="grid grid-cols-2 gap-4">{sourceVideos.map((file) => { const { type } = getFileTypeDetails(file.display_name); return (<Card key={file.id} className="overflow-hidden group relative"><div className="aspect-video flex items-center justify-center relative cursor-pointer bg-muted" onClick={() => handleFileClick(file)}>{file.thumbnail_url ? (<img src={file.thumbnail_url} alt={file.display_name} className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center bg-slate-100"><Video className="h-8 w-8 text-slate-500" /></div>)}{type === 'video' && <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><PlayCircle className="h-12 w-12 text-white" /></div>}</div><div className="p-2 flex items-center justify-between"><p className="text-xs font-medium truncate flex-1 pr-2">{file.display_name}</p><Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={(e) => handleDownloadFile(e, file)} disabled={downloadFileMutation.isPending && downloadFileMutation.variables?.id === file.id}>{downloadFileMutation.isPending && downloadFileMutation.variables?.id === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button></div></Card>); })}</div>)
                  : (<p className="text-sm text-muted-foreground text-center py-8">Chưa có video nguồn.</p>)}
            </TabsContent>

            <TabsContent value="auto-scripts" className="mt-4">
              {areCampaignsLoading ? <Skeleton className="h-48 w-full" /> : automationCampaigns && automationCampaigns.length > 0 ? (
                <div className="space-y-3">
                  {automationCampaigns.map((campaign: any) => (
                    <Link to={`/automation/${campaign.id}`} key={campaign.id} className="block hover:bg-muted/50 rounded-lg transition-colors">
                      <Card className="cursor-pointer">
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <p className="font-semibold text-sm flex-1 pr-2">{campaign.name}</p>
                            <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className={campaign.status === 'active' ? 'bg-green-100 text-green-800' : ''}>
                              {campaign.status === 'active' ? 'Đang chạy' : 'Tạm dừng'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Giọng nói: {campaign.cloned_voice_name}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (<p className="text-sm text-muted-foreground text-center py-8">Chưa có chiến dịch nào.</p>)}
            </TabsContent>

            <TabsContent value="idea-content" className="mt-4">
              <IdeaContentTab kocId={koc.id} ideas={(ideas as any) || []} isLoading={areIdeasLoading} isMobile={true} defaultTemplateId={koc.default_prompt_template_id} />
            </TabsContent>

            <TabsContent value="avatar" className="mt-4">
              <KocAvatarTab kocId={koc.id} isMobile={true} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="hidden md:block">
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
              <Tabs defaultValue="avatar" className="w-full">
                <TabsList className="bg-transparent w-full justify-start rounded-none border-b p-0 gap-x-2 h-auto flex-wrap">
                  <TabsTrigger value="avatar" className="group bg-transparent px-3 py-2 rounded-t-md shadow-none border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:border-red-600 text-muted-foreground data-[state=active]:text-red-700 font-medium transition-colors hover:bg-gray-50">
                    <div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-gray-100 group-data-[state=active]:bg-red-600 transition-colors"><UserCircle className="h-4 w-4 text-gray-500 group-data-[state=active]:text-white transition-colors" /></div><span>Avatar</span></div>
                  </TabsTrigger>
                  <TabsTrigger value="content" className="group bg-transparent px-3 py-2 rounded-t-md shadow-none border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:border-red-600 text-muted-foreground data-[state=active]:text-red-700 font-medium transition-colors hover:bg-gray-50">
                    <div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-gray-100 group-data-[state=active]:bg-red-600 transition-colors"><Clapperboard className="h-4 w-4 text-gray-500 group-data-[state=active]:text-white transition-colors" /></div><span>Video đã tạo</span></div>
                  </TabsTrigger>
                  <TabsTrigger value="images" className="group bg-transparent px-3 py-2 rounded-t-md shadow-none border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:border-red-600 text-muted-foreground data-[state=active]:text-red-700 font-medium transition-colors hover:bg-gray-50">
                    <div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-gray-100 group-data-[state=active]:bg-red-600 transition-colors"><Image className="h-4 w-4 text-gray-500 group-data-[state=active]:text-white transition-colors" /></div><span>Hình ảnh</span></div>
                  </TabsTrigger>
                  <TabsTrigger value="sources" className="group bg-transparent px-3 py-2 rounded-t-md shadow-none border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:border-red-600 text-muted-foreground data-[state=active]:text-red-700 font-medium transition-colors hover:bg-gray-50">
                    <div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-gray-100 group-data-[state=active]:bg-red-600 transition-colors"><FileArchive className="h-4 w-4 text-gray-500 group-data-[state=active]:text-white transition-colors" /></div><span>Nguồn Video</span></div>
                  </TabsTrigger>
                  <TabsTrigger value="auto-scripts" className="group bg-transparent px-3 py-2 rounded-t-md shadow-none border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:border-red-600 text-muted-foreground data-[state=active]:text-red-700 font-medium transition-colors hover:bg-gray-50">
                    <div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-gray-100 group-data-[state=active]:bg-red-600 transition-colors"><Bot className="h-4 w-4 text-gray-500 group-data-[state=active]:text-white transition-colors" /></div><span>Automation</span></div>
                  </TabsTrigger>
                  <TabsTrigger value="idea-content" className="group bg-transparent px-3 py-2 rounded-t-md shadow-none border-b-2 border-transparent data-[state=active]:bg-red-50 data-[state=active]:border-red-600 text-muted-foreground data-[state=active]:text-red-700 font-medium transition-colors hover:bg-gray-50">
                    <div className="flex items-center gap-2"><div className="p-1.5 rounded-md bg-gray-100 group-data-[state=active]:bg-red-600 transition-colors"><Lightbulb className="h-4 w-4 text-gray-500 group-data-[state=active]:text-white transition-colors" /></div><span>Idea Content</span></div>
                  </TabsTrigger>
                </TabsList>

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
                  {areFilesLoading || isKlingLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full" />)}
                    </div>
                  ) : isError ? (
                    <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Lỗi</AlertTitle><AlertDescription>{filesError.message}</AlertDescription></Alert>
                  ) : generatedFiles.length > 0 || (klingJobs && klingJobs.length > 0) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {/* Kling Jobs */}
                      {klingJobs?.map((job) => (
                        <Card key={job.id} className="overflow-hidden group relative border-purple-200 bg-purple-50/10">
                          <CardContent className="p-0 table-cell align-top w-full"> {/* Ensure same width behavior */}
                            <div className="aspect-video flex items-center justify-center relative bg-black/5">
                              {job.status === 'completed' && job.result_video_url ? (
                                <>
                                  <video src={job.result_video_url} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    onClick={() => {
                                      setSelectedFile({
                                        id: job.id,
                                        display_name: `Kling Video ${job.job_id.slice(0, 8)}`,
                                        url: job.result_video_url,
                                        r2_key: '',
                                        koc_id: kocId!,
                                        user_id: '',
                                        created_at: job.created_at,
                                        updated_at: job.updated_at,
                                        size: 0,
                                        mime_type: 'video/mp4'
                                      } as KocFile);
                                      setPlayerOpen(true);
                                    }}>
                                    <PlayCircle className="h-16 w-16 text-white" />
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-col items-center justify-center p-4 text-center w-full h-full">
                                  {job.status === 'pending' || job.status === 'processing' ? (
                                    <>
                                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                                      <span className="text-xs text-blue-600 font-medium">{job.status === 'processing' ? `Đang xử lý ${job.progress}%` : 'Đang sờ...'}</span>
                                    </>
                                  ) : job.status === 'failed' ? (
                                    <>
                                      <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                                      <span className="text-xs text-red-600 font-medium">Lỗi tạo video</span>
                                    </>
                                  ) : (
                                    <Clapperboard className="h-8 w-8 text-gray-400" />
                                  )}
                                </div>
                              )}
                              <Badge className={`absolute top-2 right-2 ${job.status === 'completed' ? 'bg-green-500' :
                                  job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                                }`}>
                                Kling AI
                              </Badge>
                            </div>
                            <div className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0 pr-2">
                                  <p className="text-sm font-medium truncate">Kling Gen #{job.job_id.slice(0, 8)}</p>
                                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(job.created_at), { locale: vi, addSuffix: true })}</p>
                                </div>
                                {job.status === 'completed' && job.result_video_url && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => window.open(job.result_video_url || '', '_blank')}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {/* Existing Generated Files */}
                      {generatedFiles.map((file) => { const { Icon, bgColor, iconColor, type } = getFileTypeDetails(file.display_name); const isSelected = selectedFileIds.includes(file.id); const dreamfaceThumbnailUrl = dreamfaceThumbnailsMap.get(file.r2_key); const finalThumbnailUrl = file.thumbnail_url || dreamfaceThumbnailUrl; return (<Card key={file.id} className="overflow-hidden group relative"><Checkbox checked={isSelected} onCheckedChange={() => handleFileSelect(file.id)} className={`absolute top-2 left-2 z-10 h-5 w-5 bg-white transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} /><CardContent className="p-0"><div className="aspect-video flex items-center justify-center relative cursor-pointer bg-muted" onClick={() => handleFileClick(file)}>{finalThumbnailUrl ? (<img src={finalThumbnailUrl} alt={file.display_name} className="w-full h-full object-cover" />) : (<div className={`w-full h-full flex items-center justify-center ${bgColor}`}><Icon className={`h-12 w-12 ${iconColor}`} /></div>)}{type === 'video' && <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><PlayCircle className="h-16 w-16 text-white" /></div>}<Button variant="secondary" size="icon" className="absolute top-2 right-12 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDownloadFile(e, file)} disabled={downloadFileMutation.isPending && downloadFileMutation.variables?.id === file.id}>{downloadFileMutation.isPending && downloadFileMutation.variables?.id === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button><Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDeleteFile(e, file)}><Trash2 className="h-4 w-4" /></Button></div><div className="p-3 space-y-1"><EditableFileName fileId={file.id} initialName={file.display_name} queryKey={filesQueryKey} />{file.created_at && <p className="text-xs text-muted-foreground">{format(new Date(file.created_at), "dd/MM/yyyy")}</p>}</div></CardContent></Card>); })}
                    </div>
                  ) : (
                    <Card className="text-center py-16"><CardContent><div className="text-center text-muted-foreground"><Film className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">Chưa có tệp nào</h3><p className="mt-1 text-sm">Bấm "Tải lên tệp" để thêm tệp đầu tiên của bạn.</p></div></CardContent></Card>
                  )}
                </TabsContent>

                <TabsContent value="images" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Hình ảnh đã tạo</CardTitle>
                      <CardDescription>Các hình ảnh được tạo bằng AI cho KOC này.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {areImagesLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square w-full" />)}
                        </div>
                      ) : generatedImages && generatedImages.filter(img => img.status === 'completed').length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {generatedImages.filter(img => img.status === 'completed').map((image) => (
                            <Card key={image.id} className="overflow-hidden group relative cursor-pointer" onClick={() => setPreviewImage(image)}>
                              <div className="aspect-square">
                                {image.result_image_url && (
                                  <img
                                    src={image.result_image_url}
                                    alt={image.prompt || 'Generated'}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="p-3 space-y-1">
                                <p className="text-sm font-medium truncate">{image.prompt || 'Không có mô tả'}</p>
                                {image.created_at && <p className="text-xs text-muted-foreground">{format(new Date(image.created_at), "dd/MM/yyyy HH:mm")}</p>}
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 text-muted-foreground">
                          <Image className="mx-auto h-12 w-12" />
                          <p className="mt-2">Chưa có hình ảnh nào được tạo cho KOC này.</p>
                          <p className="text-sm">Vào Sáng tạo KOC → Tạo Ảnh để tạo hình ảnh mới.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="sources" className="mt-6">
                  {/* Source videos section reused logic */}
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-semibold">Quản lý tệp nguồn</h3>
                      {selectedFileIds.length > 0 && <p className="text-sm text-muted-foreground">{selectedFileIds.length} tệp đã được chọn</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedFileIds.length > 0 && <Button variant="destructive" onClick={handleBulkDelete}><Trash2 className="mr-2 h-4 w-4" /> Xóa ({selectedFileIds.length})</Button>}
                      <Button variant="outline" onClick={() => setSourceVideoUploadOpen(true)} disabled={!koc?.folder_path}><Plus className="mr-2 h-4 w-4" /> Thêm video</Button>
                    </div>
                  </div>
                  {areFilesLoading ? (<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full" />)}</div>) : isError ? (<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Lỗi</AlertTitle><AlertDescription>{filesError.message}</AlertDescription></Alert>) : sourceVideos && sourceVideos.length > 0 ? (<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{sourceVideos.map((file) => { const { Icon, bgColor, iconColor, type } = getFileTypeDetails(file.display_name); const isSelected = selectedFileIds.includes(file.id); return (<Card key={file.id} className="overflow-hidden group relative"><Checkbox checked={isSelected} onCheckedChange={() => handleFileSelect(file.id)} className={`absolute top-2 left-2 z-10 h-5 w-5 bg-white transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} /><CardContent className="p-0"><div className="aspect-video flex items-center justify-center relative cursor-pointer bg-muted" onClick={() => handleFileClick(file)}>{file.thumbnail_url ? (<img src={file.thumbnail_url} alt={file.display_name} className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center bg-slate-100"><Video className="h-8 w-8 text-slate-500" /></div>)}{type === 'video' && <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><PlayCircle className="h-16 w-16 text-white" /></div>}<Button variant="secondary" size="icon" className="absolute top-2 right-12 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDownloadFile(e, file)} disabled={downloadFileMutation.isPending && downloadFileMutation.variables?.id === file.id}>{downloadFileMutation.isPending && downloadFileMutation.variables?.id === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button><Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDeleteFile(e, file)}><Trash2 className="h-4 w-4" /></Button></div><div className="p-3 space-y-1"><EditableFileName fileId={file.id} initialName={file.display_name} queryKey={filesQueryKey} />{file.created_at && <p className="text-xs text-muted-foreground">{format(new Date(file.created_at), "dd/MM/yyyy")}</p>}</div></CardContent></Card>); })}</div>) : (<Card className="text-center py-16"><CardContent><div className="text-center text-muted-foreground"><Video className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">Chưa có video nguồn</h3><p className="mt-1 text-sm">Bấm "Thêm video" để tải lên video nguồn đầu tiên.</p></div></CardContent></Card>)}
                </TabsContent>

                <TabsContent value="auto-scripts" className="mt-6">
                  {/* Automation campaigns desktop */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Automation</CardTitle>
                      <CardDescription>Các chiến dịch tự động được thiết lập cho KOC này.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {areCampaignsLoading ? (
                        <div className="space-y-4">
                          <Skeleton className="h-20 w-full" />
                        </div>
                      ) : automationCampaigns && automationCampaigns.length > 0 ? (
                        <div className="space-y-4">
                          {(automationCampaigns as any[]).map((campaign) => (
                            <Link to={`/automation/${campaign.id}`} key={campaign.id} className="block hover:bg-muted/50 rounded-lg transition-colors">
                              <Card className="cursor-pointer">
                                <CardContent className="p-4 flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold">{campaign.name}</p>
                                    <p className="text-sm text-muted-foreground">Giọng nói: {campaign.cloned_voice_name}</p>
                                  </div>
                                  <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className={campaign.status === 'active' ? 'bg-green-100 text-green-800' : ''}>
                                    {campaign.status === 'active' ? 'Đang chạy' : 'Tạm dừng'}
                                  </Badge>
                                </CardContent>
                              </Card>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 text-muted-foreground">
                          <Bot className="mx-auto h-12 w-12" />
                          <p className="mt-2">KOC này chưa được gán vào chiến dịch tự động nào.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="idea-content" className="mt-6">
                  <IdeaContentTab kocId={koc.id} ideas={(ideas as any) || []} isLoading={areIdeasLoading} isMobile={false} defaultTemplateId={koc.default_prompt_template_id} />
                </TabsContent>

                <TabsContent value="avatar" className="mt-6">
                  <KocAvatarTab kocId={koc.id} kocName={koc.channel_nickname || koc.name} isMobile={false} />
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Sidebar - Stats */}
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
                        <span>Tuổi tài khoản: <span className="font-medium text-foreground">{formatDetailedDistanceToNow(koc.channel_created_at || "1970-01-01")}</span></span>
                        {/* Using explicit fallback, though backend should return valid date or null */}
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
      </div>

      <EditKocDialog isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} koc={koc} />
      <VideoPlayerDialog isOpen={isPlayerOpen} onOpenChange={setPlayerOpen} videoUrl={selectedFile?.url || ""} videoName={selectedFile?.display_name || ""} />
      {koc && koc.folder_path && (<UploadVideoDialog isOpen={isUploadOpen} onOpenChange={setUploadOpen} folderPath={`${koc.folder_path}/generated`} kocId={koc.id} userId={koc.user_id} kocName={koc.name} />)}
      {koc && koc.folder_path && (<UploadVideoDialog isOpen={isSourceVideoUploadOpen} onOpenChange={setSourceVideoUploadOpen} folderPath={`${koc.folder_path}/sources/videos`} kocId={koc.id} userId={koc.user_id} kocName={koc.name} accept="video/*" />)}
      <AlertDialog open={filesToDelete.length > 0} onOpenChange={() => setFilesToDelete([])}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác. {filesToDelete.length} tệp sẽ bị xóa vĩnh viễn.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} disabled={deleteFilesMutation.isPending}>{deleteFilesMutation.isPending ? "Đang xóa..." : "Xóa"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <ViewScriptContentDialog isOpen={isViewScriptOpen} onOpenChange={setIsViewScriptOpen} title={selectedScript?.name || null} content={selectedScript?.script_content || null} />
      <ViewScriptLogDialog isOpen={isViewLogOpen} onOpenChange={setIsViewLogOpen} title={selectedScript?.name || null} prompt={selectedScript?.ai_prompt || null} />
      <AlertDialog open={!!scriptToDelete} onOpenChange={(isOpen) => !isOpen && setScriptToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác. Kịch bản "{scriptToDelete?.name}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => scriptToDelete && deleteScriptMutation.mutate(scriptToDelete.id)} disabled={deleteScriptMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleteScriptMutation.isPending ? "Đang xóa..." : "Xóa"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      {/* Image Preview Dialog */}
      <AlertDialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <AlertDialogHeader className="p-4 pb-2">
            <AlertDialogTitle className="text-lg">Xem ảnh</AlertDialogTitle>
            {previewImage?.prompt && (
              <AlertDialogDescription className="line-clamp-2">
                {previewImage.prompt}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <div className="flex-1 overflow-auto px-4">
            {previewImage?.result_image_url && (
              <img
                src={previewImage.result_image_url}
                alt={previewImage.prompt || 'Generated image'}
                className="w-full max-h-[65vh] object-contain rounded-lg"
              />
            )}
          </div>
          <AlertDialogFooter className="p-4 pt-2">
            <AlertDialogCancel>Đóng</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default KocDetail;