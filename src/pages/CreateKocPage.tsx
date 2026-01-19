import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, klingApi, KlingJob, kocFilesApi, imageGenerationApi, KocFile, ImageGenerationTask } from "@/lib/apiClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showSuccess, showError } from "@/utils/toast";
import { Sparkles, ArrowLeft, Video, ImageIcon, Loader2, Trash2, Eye, RefreshCw, AlertCircle, Upload, FolderOpen, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import ImageGenerationTab from "@/components/image-generation/ImageGenerationTab";

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'completed':
            return <Badge className="bg-green-100 text-green-800">Hoàn thành</Badge>;
        case 'processing':
        case 'pending':
            return <Badge variant="outline" className="text-blue-800 border-blue-200"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Đang xử lý</Badge>;
        case 'failed':
            return <Badge variant="destructive">Thất bại</Badge>;
        default:
            return <Badge variant="secondary">{status}</Badge>;
    }
};

const CreateKocPage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const videoInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const [selectedKocId, setSelectedKocId] = useState<string>("");
    const [prompt, setPrompt] = useState("");
    const [qualityMode, setQualityMode] = useState<"Standard" | "Professional">("Standard");
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [jobToDelete, setJobToDelete] = useState<KlingJob | null>(null);

    // State for file browser dialogs
    const [showVideoBrowser, setShowVideoBrowser] = useState(false);
    const [showImageBrowser, setShowImageBrowser] = useState(false);
    const [isLoadingFile, setIsLoadingFile] = useState(false);

    // Helper function to convert URL to File
    const urlToFile = async (url: string, filename: string): Promise<File> => {
        const response = await fetch(url);
        const blob = await response.blob();
        return new File([blob], filename, { type: blob.type });
    };

    // Fetch KOCs list
    const { data: kocs, isLoading: isLoadingKocs } = useQuery({
        queryKey: ['kocs'],
        queryFn: () => api.kocs.list(),
    });

    // Fetch KOC source videos (only when dialog is open and KOC is selected)
    const { data: kocFiles, isLoading: isLoadingKocFiles } = useQuery({
        queryKey: ['koc_files', selectedKocId],
        queryFn: () => kocFilesApi.list(selectedKocId),
        enabled: !!selectedKocId && selectedKocId !== 'none' && showVideoBrowser,
    });

    // Fetch KOC generated images (only when dialog is open and KOC is selected)
    const { data: kocImages, isLoading: isLoadingKocImages } = useQuery({
        queryKey: ['koc_generated_images', selectedKocId],
        queryFn: () => imageGenerationApi.tasks(selectedKocId),
        enabled: !!selectedKocId && selectedKocId !== 'none' && showImageBrowser,
    });

    // Fetch Kling jobs
    const { data: jobs, isLoading: isLoadingJobs, refetch: refetchJobs } = useQuery({
        queryKey: ['kling_jobs', selectedKocId],
        queryFn: () => klingApi.listJobs(selectedKocId || undefined),
    });

    // Fetch Kling config for direct VPS calls
    const { data: klingConfig } = useQuery({
        queryKey: ['kling_config'],
        queryFn: () => api.settings.getKlingApi(),
    });

    // Generate video mutation - calls VPS /api/automation/generate directly with multipart/form-data
    const generateMutation = useMutation({
        mutationFn: async () => {
            if (!videoFile) throw new Error("Vui lòng chọn video tham chiếu");
            if (!klingConfig?.has_config || !klingConfig.api_url || !klingConfig.cookie) {
                throw new Error("Chưa cấu hình Kling API. Vui lòng vào Cài đặt > API Kling.");
            }

            const baseUrl = klingConfig.api_url.replace(/\/+$/, '');

            // Build FormData to send directly to VPS
            const formData = new FormData();
            formData.append('mode', 'video-motion-control');
            formData.append('cookie', klingConfig.cookie);
            formData.append('qualityMode', qualityMode);
            formData.append('video', videoFile);
            if (prompt) formData.append('prompt', prompt);
            if (imageFile) formData.append('image', imageFile);

            // Call VPS /api/automation/generate with multipart/form-data
            const generateRes = await fetch(`${baseUrl}/api/automation/generate`, {
                method: 'POST',
                body: formData, // Browser automatically sets Content-Type: multipart/form-data
            });

            const generateData = await generateRes.json();
            if (!generateRes.ok) {
                throw new Error(generateData.message || generateData.details || 'Lỗi khi gọi API tạo video');
            }
            if (!generateData.jobId) {
                throw new Error('Không nhận được Job ID từ Kling API');
            }

            // Save job to local Backend for tracking
            await klingApi.saveJob({
                job_id: generateData.jobId,
                koc_id: (selectedKocId && selectedKocId !== 'none') ? selectedKocId : undefined,
                prompt: prompt,
                quality_mode: qualityMode,
            });

            return { message: generateData.message || 'Đã gửi yêu cầu thành công!', ...generateData };
        },
        onSuccess: (data) => {
            showSuccess(data.message || "Yêu cầu tạo video đã được gửi!");
            setVideoFile(null);
            setImageFile(null);
            setPrompt("");
            if (videoInputRef.current) videoInputRef.current.value = "";
            if (imageInputRef.current) imageInputRef.current.value = "";
            queryClient.invalidateQueries({ queryKey: ['kling_jobs'] });
        },
        onError: (error: Error) => showError(error.message),
    });

    // Delete job mutation
    const deleteMutation = useMutation({
        mutationFn: (jobId: string) => klingApi.deleteJob(jobId),
        onSuccess: () => {
            showSuccess("Đã xóa job!");
            setJobToDelete(null);
            queryClient.invalidateQueries({ queryKey: ['kling_jobs'] });
        },
        onError: (error: Error) => showError(error.message),
    });

    // Handle selecting video from KOC source videos
    const handleSelectVideoFromKoc = async (file: KocFile) => {
        try {
            setIsLoadingFile(true);
            // Get download URL from API
            const { url } = await kocFilesApi.getDownloadUrl(file.id);
            // Convert URL to File object
            const videoFileObj = await urlToFile(url, file.display_name);
            setVideoFile(videoFileObj);
            setShowVideoBrowser(false);
            showSuccess(`Đã chọn video: ${file.display_name}`);
        } catch (error) {
            showError("Lỗi khi tải video từ KOC");
            console.error(error);
        } finally {
            setIsLoadingFile(false);
        }
    };

    // Handle selecting image from KOC generated images
    const handleSelectImageFromKoc = async (task: ImageGenerationTask) => {
        if (!task.result_image_url) {
            showError("Ảnh chưa sẵn sàng");
            return;
        }
        try {
            setIsLoadingFile(true);
            // Use authenticated download API to bypass CORS
            const downloadUrl = imageGenerationApi.getDownloadUrl(task.id);
            const token = localStorage.getItem('auth_token');

            const response = await fetch(downloadUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const filename = `generated-image-${task.id}.png`;
            const imageFileObj = new File([blob], filename, { type: blob.type || 'image/png' });

            setImageFile(imageFileObj);
            setShowImageBrowser(false);
            showSuccess("Đã chọn ảnh từ KOC");
        } catch (error) {
            showError("Lỗi khi tải ảnh từ KOC");
            console.error(error);
        } finally {
            setIsLoadingFile(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        generateMutation.mutate();
    };

    // Auto-polling: Check status of pending/processing jobs every 5 seconds
    useEffect(() => {
        const pendingJobs = jobs?.filter(job => job.status === 'pending' || job.status === 'processing') || [];

        if (pendingJobs.length === 0 || !klingConfig?.api_url) return;

        const pollStatus = async () => {
            for (const job of pendingJobs) {
                try {
                    // Call VPS directly to get fresh status
                    const baseUrl = klingConfig.api_url.replace(/\/+$/, '');
                    const res = await fetch(`${baseUrl}/api/automation/status/${job.job_id}`);
                    if (!res.ok) continue;

                    const data = await res.json();
                    const jobData = data.data || {};

                    // If status changed, update via backend
                    if (jobData.status && jobData.status !== job.status) {
                        // Call backend status endpoint to update DB
                        await klingApi.status(job.job_id);
                        // Refresh the list
                        queryClient.invalidateQueries({ queryKey: ['kling_jobs'] });
                    } else if (jobData.progress && jobData.progress !== job.progress) {
                        await klingApi.status(job.job_id);
                        queryClient.invalidateQueries({ queryKey: ['kling_jobs'] });
                    }
                } catch (e) {
                    console.error('Error polling job status:', e);
                }
            }
        };

        const interval = setInterval(pollStatus, 5000); // Poll every 5 seconds
        pollStatus(); // Run immediately once

        return () => clearInterval(interval);
    }, [jobs, klingConfig?.api_url, queryClient]);

    return (
        <div className="p-6 lg:p-8 space-y-6">
            <header>
                <Button
                    variant="ghost"
                    className="pl-0 mb-2 hover:bg-transparent hover:text-purple-600 -ml-2"
                    onClick={() => navigate("/tao-video")}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Trở về danh sách
                </Button>
                <h1 className="text-3xl font-bold">Sáng tạo KOC</h1>
                <p className="text-muted-foreground mt-1">Tạo video với Kling AI - Công nghệ motion control tiên tiến.</p>
            </header>

            <Tabs defaultValue="video" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="video" className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Tạo Video
                    </TabsTrigger>
                    <TabsTrigger value="image" className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Tạo Ảnh
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="video" className="mt-6">
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Form tạo video */}
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-purple-600" />
                                    Tạo Video Mới
                                </CardTitle>
                                <CardDescription>Tải lên video tham chiếu và cấu hình tạo video.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* KOC Selector */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Liên kết KOC (tùy chọn)</label>
                                        <Select value={selectedKocId} onValueChange={setSelectedKocId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Chọn KOC để lưu video..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Không liên kết</SelectItem>
                                                {kocs?.map((koc: any) => (
                                                    <SelectItem key={koc.id} value={koc.id}>
                                                        {koc.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">Video tạo ra sẽ được lưu vào tab "Video đã tạo" của KOC.</p>
                                    </div>

                                    {/* Video Upload */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Video tham chiếu <span className="text-red-500">*</span></label>
                                        <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-purple-400 transition-colors">
                                            <Input
                                                ref={videoInputRef}
                                                type="file"
                                                accept="video/*"
                                                className="hidden"
                                                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                                            />
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full"
                                                        disabled={isLoadingFile}
                                                    >
                                                        {isLoadingFile ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Video className="mr-2 h-4 w-4" />
                                                        )}
                                                        {videoFile ? videoFile.name : "Chọn video"}
                                                        <ChevronDown className="ml-auto h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-56">
                                                    <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
                                                        <Upload className="mr-2 h-4 w-4" />
                                                        Tải lên từ máy tính
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => setShowVideoBrowser(true)}
                                                        disabled={!selectedKocId || selectedKocId === 'none'}
                                                    >
                                                        <FolderOpen className="mr-2 h-4 w-4" />
                                                        Chọn từ KOC
                                                        {(!selectedKocId || selectedKocId === 'none') && (
                                                            <span className="ml-auto text-xs text-muted-foreground">(Chọn KOC trước)</span>
                                                        )}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            {videoFile && (
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Image Upload */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Ảnh tham chiếu (tùy chọn)</label>
                                        <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-purple-400 transition-colors">
                                            <Input
                                                ref={imageInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                                            />
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full"
                                                        disabled={isLoadingFile}
                                                    >
                                                        {isLoadingFile ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <ImageIcon className="mr-2 h-4 w-4" />
                                                        )}
                                                        {imageFile ? imageFile.name : "Chọn ảnh"}
                                                        <ChevronDown className="ml-auto h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-56">
                                                    <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                                                        <Upload className="mr-2 h-4 w-4" />
                                                        Tải lên từ máy tính
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => setShowImageBrowser(true)}
                                                        disabled={!selectedKocId || selectedKocId === 'none'}
                                                    >
                                                        <FolderOpen className="mr-2 h-4 w-4" />
                                                        Chọn từ KOC
                                                        {(!selectedKocId || selectedKocId === 'none') && (
                                                            <span className="ml-auto text-xs text-muted-foreground">(Chọn KOC trước)</span>
                                                        )}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>

                                    {/* Prompt */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Prompt (tùy chọn)</label>
                                        <Textarea
                                            placeholder="Mô tả video bạn muốn tạo..."
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            rows={3}
                                        />
                                    </div>

                                    {/* Quality Mode */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Chất lượng</label>
                                        <Select value={qualityMode} onValueChange={(v) => setQualityMode(v as "Standard" | "Professional")}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Standard">Standard</SelectItem>
                                                <SelectItem value="Professional">Professional</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full bg-purple-600 hover:bg-purple-700"
                                        disabled={generateMutation.isPending || !videoFile}
                                    >
                                        {generateMutation.isPending ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Sparkles className="mr-2 h-4 w-4" />
                                        )}
                                        Tạo Video
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Danh sách jobs */}
                        <Card className="lg:col-span-2">
                            <CardHeader className="flex flex-row justify-between items-center">
                                <div>
                                    <CardTitle>Danh sách Video</CardTitle>
                                    <CardDescription>Các video đã và đang tạo.</CardDescription>
                                </div>
                                <Button variant="outline" size="icon" onClick={() => refetchJobs()} disabled={isLoadingJobs}>
                                    <RefreshCw className={`h-4 w-4 ${isLoadingJobs ? 'animate-spin' : ''}`} />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {isLoadingJobs ? (
                                    <div className="flex items-center justify-center h-32">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                ) : jobs && jobs.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Prompt</TableHead>
                                                <TableHead>Trạng thái</TableHead>
                                                <TableHead>Tiến độ</TableHead>
                                                <TableHead>Ngày tạo</TableHead>
                                                <TableHead className="text-right">Hành động</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {jobs.map((job) => (
                                                <TableRow key={job.id}>
                                                    <TableCell className="max-w-[200px] truncate">
                                                        {job.prompt || <span className="text-muted-foreground italic">Không có prompt</span>}
                                                    </TableCell>
                                                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                                                    <TableCell>
                                                        {job.status === 'processing' || job.status === 'pending' ? (
                                                            <div className="w-24">
                                                                <Progress value={job.progress} className="h-2" />
                                                                <span className="text-xs text-muted-foreground">{job.progress}%</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {format(new Date(job.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                                                    </TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        {job.status === 'completed' && job.result_video_url && (
                                                            <Button size="sm" variant="outline" asChild>
                                                                <a href={job.result_video_url} target="_blank" rel="noopener noreferrer">
                                                                    <Eye className="mr-1 h-4 w-4" /> Xem
                                                                </a>
                                                            </Button>
                                                        )}
                                                        {job.status === 'failed' && job.error_message && (
                                                            <Button size="sm" variant="ghost" className="text-red-500" title={job.error_message}>
                                                                <AlertCircle className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button size="sm" variant="destructive" onClick={() => setJobToDelete(job)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>Chưa có video nào được tạo.</p>
                                        <p className="text-sm">Tải lên video tham chiếu để bắt đầu.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Delete Confirmation Dialog */}
                    <AlertDialog open={!!jobToDelete} onOpenChange={() => setJobToDelete(null)}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Xóa video này?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Hành động này sẽ xóa vĩnh viễn thông tin về video. Bạn có chắc chắn muốn tiếp tục?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => jobToDelete && deleteMutation.mutate(jobToDelete.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                    disabled={deleteMutation.isPending}
                                >
                                    {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </TabsContent>

                <TabsContent value="image" className="mt-6">
                    <ImageGenerationTab selectedKocId={selectedKocId} />
                </TabsContent>
            </Tabs>

            {/* Video Browser Dialog */}
            <Dialog open={showVideoBrowser} onOpenChange={setShowVideoBrowser}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Chọn Video từ KOC</DialogTitle>
                        <DialogDescription>
                            Chọn video từ tab "Video nguồn" của KOC để sử dụng làm video tham chiếu.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[400px]">
                        {isLoadingKocFiles ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : kocFiles && kocFiles.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                                {kocFiles.filter(f => f.display_name.match(/\.(mp4|mov|avi|mkv|webm)$/i)).map((file) => (
                                    <div
                                        key={file.id}
                                        className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleSelectVideoFromKoc(file)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded bg-purple-100 flex items-center justify-center">
                                                <Video className="h-6 w-6 text-purple-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{file.display_name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(new Date(file.created_at), 'dd/MM/yyyy', { locale: vi })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>Chưa có video nguồn nào.</p>
                                <p className="text-sm">Tải video lên tab "Video nguồn" của KOC trước.</p>
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Image Browser Dialog */}
            <Dialog open={showImageBrowser} onOpenChange={setShowImageBrowser}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Chọn Ảnh từ KOC</DialogTitle>
                        <DialogDescription>
                            Chọn ảnh từ tab "Hình ảnh" của KOC để sử dụng làm ảnh tham chiếu.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[400px]">
                        {isLoadingKocImages ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : kocImages && kocImages.filter(t => t.status === 'completed' && t.result_image_url).length > 0 ? (
                            <div className="grid grid-cols-3 gap-3">
                                {kocImages.filter(t => t.status === 'completed' && t.result_image_url).map((task) => (
                                    <div
                                        key={task.id}
                                        className="border rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                                        onClick={() => handleSelectImageFromKoc(task)}
                                    >
                                        <img
                                            src={task.result_image_url!}
                                            alt={task.prompt || 'Generated'}
                                            className="w-full h-24 object-cover"
                                        />
                                        <div className="p-2">
                                            <p className="text-xs text-muted-foreground truncate">{task.prompt || 'Không có prompt'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>Chưa có ảnh nào.</p>
                                <p className="text-sm">Tạo ảnh trong tab "Tạo Ảnh" trước.</p>
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CreateKocPage;

