import { useState, useRef, ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { kocAvatarsApi, KocAvatar } from "@/lib/apiClient";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { User, UploadCloud, Trash2, Download, Loader2, X, Plus, Sparkles, ImagePlus, RefreshCw, CheckCircle2, Calendar, FileType, Monitor } from "lucide-react";

// Utils
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

interface KocAvatarTabProps {
    kocId: string;
    kocName?: string;
    isMobile?: boolean;
}

export const KocAvatarTab = ({ kocId, kocName, isMobile = false }: KocAvatarTabProps) => {
    const queryClient = useQueryClient();
    const queryKey = ["koc_avatars", kocId];

    // State
    const [prompt, setPrompt] = useState("");
    const [referenceImages, setReferenceImages] = useState<{ file: File; preview: string }[]>([]);
    const [previewAvatar, setPreviewAvatar] = useState<KocAvatar | null>(null);
    const [avatarToDelete, setAvatarToDelete] = useState<KocAvatar | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);

    // Query: Fetch avatars
    const { data: avatars, isLoading } = useQuery<KocAvatar[]>({
        queryKey,
        queryFn: () => kocAvatarsApi.list(kocId),
        refetchInterval: 5000,
    });

    // Mutation: Generate avatar
    const generateMutation = useMutation({
        mutationFn: async () => {
            const imagesBase64: string[] = [];
            for (const img of referenceImages) {
                const base64 = await fileToBase64(img.file);
                imagesBase64.push(base64);
            }
            return kocAvatarsApi.generate(kocId, { prompt, images_base64: imagesBase64 });
        },
        onSuccess: () => {
            showSuccess("Avatar đã được tạo thành công!");
            setPrompt("");
            setReferenceImages([]);
            queryClient.invalidateQueries({ queryKey });
        },
        onError: (error: Error) => {
            showError(`Lỗi: ${error.message}`);
        },
    });

    // Mutation: Upload avatar
    const uploadMutation = useMutation({
        mutationFn: (file: File) => kocAvatarsApi.upload(kocId, file),
        onSuccess: () => {
            showSuccess("Tải lên avatar thành công!");
            queryClient.invalidateQueries({ queryKey });
        },
        onError: (error: Error) => {
            showError(`Lỗi: ${error.message}`);
        },
    });

    // Mutation: Set Active
    const setActiveMutation = useMutation({
        mutationFn: (avatarId: string) => kocAvatarsApi.setActive(kocId, avatarId),
        onSuccess: () => {
            showSuccess("Đã cập nhật avatar chính!");
            queryClient.invalidateQueries({ queryKey });
        },
        onError: (error: Error) => {
            showError(`Lỗi: ${error.message}`);
        },
    });

    // Mutation: Delete avatar
    const deleteMutation = useMutation({
        mutationFn: (avatarId: string) => kocAvatarsApi.delete(kocId, avatarId),
        onSuccess: () => {
            showSuccess("Xóa avatar thành công!");
            setAvatarToDelete(null);
            queryClient.invalidateQueries({ queryKey });
        },
        onError: (error: Error) => {
            showError(`Lỗi: ${error.message}`);
            setAvatarToDelete(null);
        },
    });

    // Helper: Convert file to base64
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(",")[1];
                resolve(base64);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleAddReferenceImages = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newImages = Array.from(files).slice(0, 5 - referenceImages.length).map(file => ({
            file,
            preview: URL.createObjectURL(file),
        }));

        setReferenceImages(prev => [...prev, ...newImages].slice(0, 5));
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleRemoveReferenceImage = (index: number) => {
        setReferenceImages(prev => {
            const newImages = [...prev];
            URL.revokeObjectURL(newImages[index].preview);
            newImages.splice(index, 1);
            return newImages;
        });
    };

    const handleUploadAvatar = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadMutation.mutate(file);
        }
        if (uploadInputRef.current) uploadInputRef.current.value = "";
    };

    const handleDownload = (avatar: KocAvatar) => {
        const url = kocAvatarsApi.getDownloadUrl(kocId, avatar.id);
        window.open(url, '_blank');
    };

    // Filter avatars
    const activeAvatar = avatars?.find(a => a.is_active);
    const otherAvatars = avatars?.filter(a => !a.is_active && a.status === 'completed') || [];
    const processingAvatars = avatars?.filter(a => a.status === 'processing') || [];

    return (
        <div className="space-y-6">
            {/* 1. Active Avatar Profile Section */}
            <Card className="border-2 border-primary/10 bg-gradient-to-br from-white to-primary/5 shadow-md overflow-hidden">
                <CardHeader className={isMobile ? "p-4" : "pb-4"}>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-primary">
                                <User className="h-5 w-5" />
                                Avatar của tôi
                            </CardTitle>
                            <CardDescription>
                                Avatar chính diện đang được sử dụng cho {kocName || "KOC"}
                            </CardDescription>
                        </div>
                        {activeAvatar && (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-md px-3 py-1">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                Đang sử dụng
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className={isMobile ? "p-4 pt-0" : undefined}>
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Active Avatar Image */}
                        <div className="relative group shrink-0 mx-auto md:mx-0">
                            <div className="w-56 h-56 md:w-64 md:h-64 rounded-full overflow-hidden border-[6px] border-white shadow-2xl bg-gray-100 flex items-center justify-center ring-1 ring-gray-200">
                                {isLoading ? (
                                    <Skeleton className="w-full h-full" />
                                ) : activeAvatar?.image_url ? (
                                    <img
                                        src={activeAvatar.image_url}
                                        alt="Active Avatar"
                                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105 cursor-pointer bg-white"
                                        onClick={() => setPreviewAvatar(activeAvatar)}
                                    />
                                ) : (
                                    <User className="h-24 w-24 text-gray-300" />
                                )}
                            </div>
                            {/* Edit/Change Button Overlay */}
                            <div className="absolute bottom-4 right-4 shadow-lg rounded-full">
                                <Button
                                    size="icon"
                                    className="rounded-full h-10 w-10 border-2 border-white"
                                    onClick={() => uploadInputRef.current?.click()}
                                    title="Thay đổi avatar"
                                >
                                    <UploadCloud className="h-5 w-5" />
                                </Button>
                                <input
                                    ref={uploadInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleUploadAvatar}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        {/* Active Avatar Info - Improved Layout */}
                        <div className="flex-1 w-full space-y-6">
                            {activeAvatar ? (
                                <div className="space-y-6">
                                    {/* Header: Name, ID & Download */}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-2xl text-gray-900 mb-1">{kocName || "KOC Avatar"}</h3>
                                            <p className="text-sm font-medium text-muted-foreground">ID: <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{activeAvatar.id.slice(0, 8)}</span></p>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-9 px-3 rounded-full border-dashed border-gray-300 text-gray-600 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all gap-1.5 shadow-sm"
                                                onClick={() => handleDownload(activeAvatar)}
                                                title="Tải avatar về máy"
                                            >
                                                <Download className="w-4 h-4" />
                                                <span className="text-xs font-semibold">Tải về</span>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Metadata Strip: Icon Top, Text Bottom */}
                                    <div className="grid grid-cols-3 gap-4">
                                        {/* Source */}
                                        <div className="flex flex-col items-center justify-center p-3 py-4 bg-white/60 hover:bg-white transition-colors rounded-2xl border border-gray-100 shadow-sm text-center group">
                                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                                                <Monitor className="w-5 h-5" />
                                            </div>
                                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Nguồn</span>
                                            <Badge variant="secondary" className={`h-6 px-3 ${activeAvatar.source === 'generated' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                                {activeAvatar.source === 'generated' ? 'AI' : 'Upload'}
                                            </Badge>
                                        </div>

                                        {/* Date */}
                                        <div className="flex flex-col items-center justify-center p-3 py-4 bg-white/60 hover:bg-white transition-colors rounded-2xl border border-gray-100 shadow-sm text-center group">
                                            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                                                <Calendar className="w-5 h-5" />
                                            </div>
                                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Ngày tạo</span>
                                            <span className="font-bold text-gray-700 text-sm">
                                                {format(new Date(activeAvatar.created_at), "dd/MM/yyyy")}
                                            </span>
                                        </div>

                                        {/* Format */}
                                        <div className="flex flex-col items-center justify-center p-3 py-4 bg-white/60 hover:bg-white transition-colors rounded-2xl border border-gray-100 shadow-sm text-center group">
                                            <div className="p-2.5 bg-pink-50 text-pink-600 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                                                <FileType className="w-5 h-5" />
                                            </div>
                                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Định dạng</span>
                                            <span className="font-bold text-gray-700 text-sm">1:1 (Vuông)</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-center md:text-left">
                                    <h3 className="font-semibold text-lg text-gray-800">Chưa có avatar profile</h3>
                                    <p className="text-muted-foreground mb-6 max-w-lg">
                                        Hiện tại {kocName || "KOC"} chưa có avatar chính thức. Một avatar chuyên nghiệp sẽ giúp KOC nổi bật hơn.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button
                                            size="lg"
                                            className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg hover:shadow-xl transition-all"
                                            onClick={() => document.getElementById('create-avatar-trigger')?.click()}
                                        >
                                            <Sparkles className="mr-2 h-5 w-5" />
                                            Tạo Avatar bằng AI
                                        </Button>
                                        <Button size="lg" variant="outline" onClick={() => uploadInputRef.current?.click()} className="border-dashed border-2">
                                            <UploadCloud className="mr-2 h-5 w-5" />
                                            Tải ảnh lên từ máy
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Create Avatar Accordion */}
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="create-avatar" className="border rounded-lg bg-card shadow-sm px-4">
                    <AccordionTrigger id="create-avatar-trigger" className="hover:no-underline py-4">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                            <Sparkles className="h-5 w-5 text-amber-500" />
                            Tạo Avatar mới bằng AI
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                        <div className="space-y-4 pt-2">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-sm font-medium">Mô tả khuôn mặt mong muốn</label>
                                        <Button variant="link" className="h-auto p-0 text-xs text-amber-600" onClick={() => setPrompt("Chân dung cận cảnh, ánh sáng studio mềm mại, phong cách chuyên nghiệp, độ phân giải cao 8k, nhìn thẳng vào camera")}>
                                            Mẫu chuyên nghiệp
                                        </Button>
                                    </div>

                                    <Textarea
                                        placeholder="Mô tả chi tiết: 'Cô gái trẻ 20 tuổi, tóc ngắn ngang vai, nền studio sáng, phong cách Hàn Quốc, da trắng, cười nhẹ...'"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        rows={6}
                                        className="resize-none focus:ring-amber-500/50 bg-amber-50/30 font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium">Ảnh tham chiếu (tùy chọn)</label>
                                        <span className="text-xs text-muted-foreground">{referenceImages.length}/5 ảnh</span>
                                    </div>

                                    <div
                                        className="border-2 border-dashed rounded-lg p-4 h-[154px] flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors bg-gray-50/50"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {referenceImages.length > 0 ? (
                                            <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar max-w-full">
                                                {referenceImages.map((img, index) => (
                                                    <div key={index} className="relative group shrink-0 w-24 h-24" onClick={(e) => e.stopPropagation()}>
                                                        <img
                                                            src={img.preview}
                                                            alt={`Ref ${index}`}
                                                            className="w-full h-full object-cover rounded-md border shadow-sm"
                                                        />
                                                        <button
                                                            onClick={() => handleRemoveReferenceImage(index)}
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {referenceImages.length < 5 && (
                                                    <div className="w-24 h-24 shrink-0 border-2 border-dashed rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" onClick={() => fileInputRef.current?.click()}>
                                                        <Plus className="h-6 w-6" />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center text-muted-foreground">
                                                <ImagePlus className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                                <p className="text-sm font-medium">Kéo thả hoặc click để chọn ảnh</p>
                                                <p className="text-xs text-muted-foreground mt-1">Hỗ trợ JPG, PNG (Max 5 ảnh)</p>
                                            </div>
                                        )}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleAddReferenceImages}
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button
                                size="lg"
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md relative overflow-hidden transition-all hover:shadow-lg hover:scale-[1.01]"
                                onClick={() => generateMutation.mutate()}
                                disabled={!prompt.trim() || generateMutation.isPending}
                            >
                                {generateMutation.isPending ? (
                                    <div className="flex items-center justify-center">
                                        <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                                        Đang thiết kế và vẽ avatar cho {kocName || "bạn"}...
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center font-bold text-lg">
                                        <Sparkles className="h-5 w-5 mr-2" />
                                        Bắt đầu sáng tạo Avatar
                                    </div>
                                )}
                            </Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* 3. Avatar History Accordion */}
                <AccordionItem value="avatar-history" className="border rounded-lg bg-card shadow-sm px-4 mt-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                            <RefreshCw className="h-5 w-5 text-blue-500" />
                            Lịch sử Avatar ({otherAvatars.length})
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                        {processingAvatars.length > 0 && (
                            <div className="mb-4 space-y-2">
                                <p className="text-sm font-medium text-amber-600 flex items-center"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Đang xử lý...</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {processingAvatars.map((avatar) => (
                                        <div key={avatar.id} className="aspect-square rounded-lg border bg-muted flex items-center justify-center relative overflow-hidden animate-pulse">
                                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {otherAvatars.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-2">
                                {otherAvatars.map((avatar) => (
                                    <div key={avatar.id} className="group relative rounded-lg overflow-hidden border bg-background shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                                        <div className="aspect-square cursor-pointer" onClick={() => setPreviewAvatar(avatar)}>
                                            {avatar.image_url && (
                                                <img src={avatar.image_url} alt="Avatar" className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                        <div className="p-2 flex justify-between items-center bg-white border-t">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-green-600 mb-0 hover:bg-green-50"
                                                title="Đặt làm avatar chính"
                                                onClick={() => setActiveMutation.mutate(avatar.id)}
                                            >
                                                <CheckCircle2 className="h-4 w-4" />
                                            </Button>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-blue-50"
                                                    onClick={() => handleDownload(avatar)}
                                                >
                                                    <Download className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-red-50"
                                                    onClick={() => setAvatarToDelete(avatar)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        {avatar.source === 'generated' && (
                                            <div className="absolute top-2 right-2 shadow-sm">
                                                <Badge className="text-[10px] px-1.5 h-5 bg-amber-500 hover:bg-amber-600 shadow-sm border-white border">AI</Badge>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed rounded-xl bg-gray-50/50">
                                <p className="text-muted-foreground">Chưa có lịch sử avatar nào khác.</p>
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            {/* Dialogs */}
            <AlertDialog open={!!previewAvatar} onOpenChange={() => setPreviewAvatar(null)}>
                <AlertDialogContent className="max-w-xl p-0 overflow-hidden border-0 shadow-2xl">
                    <div className="relative bg-black flex items-center justify-center p-4 min-h-[300px]">
                        <Button variant="ghost" className="absolute top-2 right-2 text-white/70 hover:text-white hover:bg-white/20 z-10" onClick={() => setPreviewAvatar(null)}>
                            <X className="h-5 w-5" />
                        </Button>

                        {previewAvatar?.image_url && (
                            <img
                                src={previewAvatar.image_url}
                                alt="Preview"
                                className="max-h-[60vh] object-contain rounded-sm shadow-md"
                            />
                        )}
                    </div>

                    <div className="p-6 bg-white">
                        <div className="flex items-center gap-3 mb-4">
                            <Badge variant={previewAvatar?.source === 'generated' ? 'default' : 'secondary'} className="h-6">
                                {previewAvatar?.source === 'generated' ? 'AI Generated' : 'Uploaded'}
                            </Badge>
                            {previewAvatar?.created_at && (
                                <span className="text-sm text-gray-500">
                                    {format(new Date(previewAvatar.created_at), "dd 'tháng' MM, yyyy - HH:mm")}
                                </span>
                            )}
                        </div>

                        {previewAvatar?.prompt && (
                            <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-600 mb-6 italic border">
                                "{previewAvatar.prompt}"
                            </div>
                        )}

                        <div className="flex w-full justify-between items-center pt-2">
                            {!previewAvatar?.is_active ? (
                                <Button
                                    onClick={() => {
                                        if (previewAvatar) setActiveMutation.mutate(previewAvatar.id);
                                        setPreviewAvatar(null);
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Đặt làm avatar chính
                                </Button>
                            ) : (
                                <span className="text-green-600 font-medium flex items-center"><CheckCircle2 className="mr-2 h-4 w-4" /> Đang sử dụng</span>
                            )}

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => previewAvatar && handleDownload(previewAvatar)}>
                                    <Download className="mr-2 h-4 w-4" /> Tải về
                                </Button>
                                <Button variant="ghost" onClick={() => setPreviewAvatar(null)}>Đóng</Button>
                            </div>
                        </div>
                    </div>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!avatarToDelete} onOpenChange={() => setAvatarToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive flex items-center gap-2">
                            <Trash2 className="h-5 w-5" /> Xóa Avatar
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Bạn có chắc chắn muốn xóa avatar này không? Hành động này không thể hoàn tác và ảnh sẽ bị xóa vĩnh viễn khỏi hệ thống.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => avatarToDelete && deleteMutation.mutate(avatarToDelete.id)}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Xóa vĩnh viễn
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
};
