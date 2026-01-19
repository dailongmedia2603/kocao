import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/apiClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { CheckCircle2, Loader2, Key, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


const ImageGenApiSettings = () => {
    const [apiKey, setApiKey] = useState("");
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery({
        queryKey: ["settings", "image-gen-api"],
        queryFn: settingsApi.getImageGenApi,
    });

    const saveMutation = useMutation({
        mutationFn: settingsApi.saveImageGenApi,
        onSuccess: () => {
            showSuccess("Đã lưu API Key thành công!");
            setApiKey("");
            queryClient.invalidateQueries({ queryKey: ["settings", "image-gen-api"] });
        },
        onError: () => showError("Lưu API Key thất bại"),
    });

    const deleteMutation = useMutation({
        mutationFn: settingsApi.deleteImageGenApi,
        onSuccess: () => {
            showSuccess("Đã xóa API Key thành công!");
            queryClient.invalidateQueries({ queryKey: ["settings", "image-gen-api"] });
        },
        onError: () => showError("Xóa API Key thất bại"),
    });

    const checkMutation = useMutation({
        mutationFn: settingsApi.checkImageGenApi,
        onSuccess: (data) => {
            if (data.valid) {
                showSuccess("API Key hợp lệ! Đã kết nối thành công.");
            } else {
                showError(data.message || "API Key không hợp lệ hoặc không có quyền truy cập.");
            }
        },
        onError: (error: Error) => showError(`Lỗi kiểm tra: ${error.message}`),
    });

    const handleSave = () => {
        if (!apiKey.trim()) {
            showError("Vui lòng nhập API Key");
            return;
        }
        saveMutation.mutate(apiKey);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Cấu hình API Gen Ảnh</CardTitle>
                    <CardDescription>
                        Cấu hình API Key cho dịch vụ Gemini Image Generation (API: key4u.shop). Model: gemini-3-pro-image-preview.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Đang tải cấu hình...</span>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
                                <div className={`p-2 rounded-full ${settings?.has_key ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                                    <Key className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">
                                        {settings?.has_key ? "Đã cấu hình API Key" : "Chưa cấu hình API Key"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {settings?.has_key
                                            ? "Bạn đã có thể sử dụng tính năng sinh ảnh AI."
                                            : "Vui lòng thêm API Key để sử dụng tính năng sinh ảnh."}
                                    </p>
                                </div>
                                {settings?.has_key && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => checkMutation.mutate()}
                                            disabled={checkMutation.isPending}
                                        >
                                            {checkMutation.isPending ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            ) : (
                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                            )}
                                            Kiểm tra kết nối
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Xóa API Key?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Hành động này sẽ xóa API Key hiện tại. Bạn sẽ cần thêm lại API Key mới để sử dụng tính năng này.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => deleteMutation.mutate()}
                                                        className="bg-destructive hover:bg-destructive/90"
                                                        disabled={deleteMutation.isPending}
                                                    >
                                                        {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <div className="space-y-2 pt-4 border-t">
                        <label className="text-sm font-medium">Cập nhật API Key</label>
                        <div className="flex gap-2">
                            <Input
                                type="password"
                                placeholder="Nhập API Key mới..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                            <Button onClick={handleSave} disabled={saveMutation.isPending || !apiKey.trim()} className="bg-red-600 hover:bg-red-700 text-white">
                                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Lưu
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            API Key sẽ được mã hóa và lưu trữ an toàn.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ImageGenApiSettings;
