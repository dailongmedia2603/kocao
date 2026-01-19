import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { imageGenerationApi, api } from "@/lib/apiClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/utils/toast";
import { ImageIcon, Loader2, Trash2, Eye, RefreshCw, Sparkles, Download } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ImageGenerationTask {
    id: string;
    prompt: string | null;
    aspect_ratio: string;
    image_size: string;
    status: string;
    result_image_url: string | null;
    result_text: string | null;
    error_message: string | null;
    created_at: string;
}

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

interface Props {
    selectedKocId?: string;
}

const ImageGenerationTab = ({ selectedKocId }: Props) => {
    const queryClient = useQueryClient();
    const imageInputRef = useRef<HTMLInputElement>(null);

    // Fetch KOC list
    const { data: kocs } = useQuery({
        queryKey: ['kocs'],
        queryFn: () => api.kocs.list(),
    });

    const [localSelectedKocId, setLocalSelectedKocId] = useState<string>(selectedKocId || "");

    const [prompt, setPrompt] = useState("");
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [imageSize, setImageSize] = useState("1K");
    const [referenceImages, setReferenceImages] = useState<File[]>([]);
    const [referenceImagePreviews, setReferenceImagePreviews] = useState<string[]>([]);
    const [taskToDelete, setTaskToDelete] = useState<ImageGenerationTask | null>(null);
    const [previewTask, setPreviewTask] = useState<ImageGenerationTask | null>(null);

    // Fetch tasks - use localSelectedKocId for filtering
    const { data: tasks, isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery({
        queryKey: ['image_generation_tasks', localSelectedKocId],
        queryFn: () => imageGenerationApi.tasks(localSelectedKocId || undefined),
    });

    // Generate mutation
    const generateMutation = useMutation({
        mutationFn: async () => {
            let imagesBase64: string[] = [];

            // Convert all images to base64
            if (referenceImages.length > 0) {
                const promises = referenceImages.map((file) => {
                    return new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const result = reader.result as string;
                            // Remove data URL prefix
                            const base64 = result.split(',')[1];
                            resolve(base64);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                });
                imagesBase64 = await Promise.all(promises);
            }

            return imageGenerationApi.generate({
                prompt,
                images_base64: imagesBase64.length > 0 ? imagesBase64 : undefined,
                koc_id: localSelectedKocId || undefined,
                aspect_ratio: aspectRatio,
                image_size: imageSize,
            });
        },
        onSuccess: (data) => {
            showSuccess("Đã tạo ảnh thành công!");
            setPrompt("");
            setReferenceImages([]);
            setReferenceImagePreviews([]);
            if (imageInputRef.current) imageInputRef.current.value = "";
            queryClient.invalidateQueries({ queryKey: ['image_generation_tasks'] });
        },
        onError: (error: Error) => showError(error.message),
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (taskId: string) => imageGenerationApi.delete(taskId),
        onSuccess: () => {
            showSuccess("Đã xóa!");
            setTaskToDelete(null);
            queryClient.invalidateQueries({ queryKey: ['image_generation_tasks'] });
        },
        onError: (error: Error) => showError(error.message),
    });

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const newFiles = Array.from(files).slice(0, 5 - referenceImages.length); // Max 5 total
            if (newFiles.length === 0) {
                showError("Tối đa 5 ảnh tham chiếu");
                return;
            }

            // Add files to array
            setReferenceImages(prev => [...prev, ...newFiles]);

            // Generate previews for new files
            newFiles.forEach(file => {
                const reader = new FileReader();
                reader.onload = () => setReferenceImagePreviews(prev => [...prev, reader.result as string]);
                reader.readAsDataURL(file);
            });
        }
    };

    const removeImage = (index: number) => {
        setReferenceImages(prev => prev.filter((_, i) => i !== index));
        setReferenceImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) {
            showError("Vui lòng nhập prompt mô tả ảnh");
            return;
        }
        generateMutation.mutate();
    };

    const handleDownload = async (taskId: string, imageUrl: string) => {
        try {
            // Use API endpoint with auth token to bypass CORS
            const downloadUrl = imageGenerationApi.getDownloadUrl(taskId);
            const token = localStorage.getItem('auth_token');

            const response = await fetch(downloadUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            // Extract filename from URL or use default
            const filename = imageUrl.split('/').pop() || 'generated-image.png';
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            showError("Lỗi khi tải ảnh");
        }
    };

    return (
        <div className="grid lg:grid-cols-3 gap-6">
            {/* Form tạo ảnh */}
            <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-pink-600" />
                        Tạo Ảnh Mới
                    </CardTitle>
                    <CardDescription>Sử dụng AI để tạo ảnh từ mô tả.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* KOC Selector */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Chọn KOC</label>
                            <Select value={localSelectedKocId || "__none__"} onValueChange={(val) => setLocalSelectedKocId(val === "__none__" ? "" : val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Không chọn KOC" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Không chọn KOC</SelectItem>
                                    {kocs?.map((koc) => (
                                        <SelectItem key={koc.id} value={koc.id}>
                                            {koc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Prompt */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Prompt <span className="text-red-500">*</span></label>
                            <Textarea
                                placeholder="Mô tả ảnh bạn muốn tạo..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={4}
                            />
                        </div>

                        {/* Reference Images */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Ảnh tham chiếu (tùy chọn, tối đa 5)
                            </label>
                            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-pink-400 transition-colors">
                                <Input
                                    ref={imageInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={handleImageChange}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => imageInputRef.current?.click()}
                                    className="w-full"
                                    disabled={referenceImages.length >= 5}
                                >
                                    <ImageIcon className="mr-2 h-4 w-4" />
                                    {referenceImages.length > 0
                                        ? `Đã chọn ${referenceImages.length} ảnh (+ Thêm)`
                                        : "Chọn ảnh"}
                                </Button>
                                {referenceImagePreviews.length > 0 && (
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {referenceImagePreviews.map((preview, index) => (
                                            <div key={index} className="relative group">
                                                <img
                                                    src={preview}
                                                    alt={`Preview ${index + 1}`}
                                                    className="w-full h-16 object-cover rounded"
                                                />
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="destructive"
                                                    className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => removeImage(index)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Aspect Ratio */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tỷ lệ khung hình</label>
                            <Select value={aspectRatio} onValueChange={setAspectRatio}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1:1">1:1 (Vuông)</SelectItem>
                                    <SelectItem value="16:9">16:9 (Ngang)</SelectItem>
                                    <SelectItem value="9:16">9:16 (Dọc)</SelectItem>
                                    <SelectItem value="4:3">4:3</SelectItem>
                                    <SelectItem value="3:4">3:4</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Image Size */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Kích thước</label>
                            <Select value={imageSize} onValueChange={setImageSize}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1K">1K (Tiêu chuẩn)</SelectItem>
                                    <SelectItem value="2K">2K (Cao)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-pink-600 hover:bg-pink-700"
                            disabled={generateMutation.isPending || !prompt.trim()}
                        >
                            {generateMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="mr-2 h-4 w-4" />
                            )}
                            Tạo Ảnh
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Danh sách ảnh */}
            <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row justify-between items-center">
                    <div>
                        <CardTitle>Danh sách Ảnh</CardTitle>
                        <CardDescription>Các ảnh đã và đang tạo.</CardDescription>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => refetchTasks()} disabled={isLoadingTasks}>
                        <RefreshCw className={`h-4 w-4 ${isLoadingTasks ? 'animate-spin' : ''}`} />
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoadingTasks ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : tasks && tasks.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {tasks.map((task: ImageGenerationTask) => (
                                <div key={task.id} className="border rounded-lg overflow-hidden group relative">
                                    {task.status === 'completed' && task.result_image_url ? (
                                        <img
                                            src={task.result_image_url}
                                            alt={task.prompt || 'Generated'}
                                            className="w-full h-40 object-cover cursor-pointer"
                                            onClick={() => setPreviewTask(task)}
                                        />
                                    ) : task.status === 'processing' || task.status === 'pending' ? (
                                        <div className="w-full h-40 bg-muted flex items-center justify-center">
                                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-40 bg-red-50 flex items-center justify-center">
                                            <span className="text-red-500 text-sm px-2 text-center">{task.error_message || 'Lỗi'}</span>
                                        </div>
                                    )}
                                    <div className="p-2 bg-white">
                                        <p className="text-xs text-muted-foreground truncate">{task.prompt || 'Không có prompt'}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            {getStatusBadge(task.status)}
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(task.created_at), 'dd/MM HH:mm', { locale: vi })}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Overlay actions */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        {task.status === 'completed' && task.result_image_url && (
                                            <>
                                                <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => setPreviewTask(task)}>
                                                    <Eye className="h-3 w-3" />
                                                </Button>
                                                <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => handleDownload(task.id, task.result_image_url!)}>
                                                    <Download className="h-3 w-3" />
                                                </Button>
                                            </>
                                        )}
                                        <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => setTaskToDelete(task)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Chưa có ảnh nào được tạo.</p>
                            <p className="text-sm">Nhập prompt để bắt đầu.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xóa ảnh này?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Hành động này sẽ xóa vĩnh viễn ảnh. Bạn có chắc chắn muốn tiếp tục?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => taskToDelete && deleteMutation.mutate(taskToDelete.id)}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Image Preview Dialog */}
            <AlertDialog open={!!previewTask} onOpenChange={() => setPreviewTask(null)}>
                <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xem ảnh</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="flex-1 overflow-auto">
                        {previewTask?.result_image_url && (
                            <img src={previewTask.result_image_url} alt="Preview" className="w-full max-h-[65vh] object-contain rounded" />
                        )}
                    </div>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel>Đóng</AlertDialogCancel>
                        {previewTask?.result_image_url && (
                            <Button onClick={() => handleDownload(previewTask.id, previewTask.result_image_url!)}>
                                <Download className="mr-2 h-4 w-4" />
                                Tải xuống
                            </Button>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ImageGenerationTab;
