import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/apiClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { showError, showSuccess } from "@/utils/toast";
import { CheckCircle2, Loader2, Link2, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const DEFAULT_API_URL = "http://36.50.54.74:5010";

const KlingApiSettings = () => {
    const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
    const [cookie, setCookie] = useState("");
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery({
        queryKey: ["settings", "kling-api"],
        queryFn: settingsApi.getKlingApi,
    });

    const saveMutation = useMutation({
        mutationFn: () => settingsApi.saveKlingApi(apiUrl, cookie),
        onSuccess: () => {
            showSuccess("Đã lưu cấu hình Kling API thành công!");
            setCookie("");
            queryClient.invalidateQueries({ queryKey: ["settings", "kling-api"] });
        },
        onError: (error: Error) => showError(error.message || "Lưu cấu hình thất bại"),
    });

    const deleteMutation = useMutation({
        mutationFn: settingsApi.deleteKlingApi,
        onSuccess: () => {
            showSuccess("Đã xóa cấu hình Kling API!");
            setApiUrl(DEFAULT_API_URL);
            queryClient.invalidateQueries({ queryKey: ["settings", "kling-api"] });
        },
        onError: () => showError("Xóa cấu hình thất bại"),
    });

    const checkMutation = useMutation({
        mutationFn: settingsApi.checkKlingApi,
        onSuccess: (data) => {
            if (data.valid) {
                showSuccess("Cookie hợp lệ! Đã kết nối thành công.");
            } else {
                showError(data.message || "Cookie không hợp lệ.");
            }
        },
        onError: (error: Error) => showError(`Lỗi kiểm tra: ${error.message}`),
    });

    const handleSave = () => {
        if (!apiUrl.trim()) {
            showError("Vui lòng nhập URL API");
            return;
        }
        if (!cookie.trim() || cookie.trim().length < 10) {
            showError("Cookie phải có ít nhất 10 ký tự");
            return;
        }
        saveMutation.mutate();
    };

    // Update apiUrl when settings load
    if (settings?.api_url && apiUrl === DEFAULT_API_URL && settings.api_url !== DEFAULT_API_URL) {
        setApiUrl(settings.api_url);
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Cấu hình API Kling</CardTitle>
                    <CardDescription>
                        Cấu hình kết nối đến Kling AI Video Generation Service để tạo video tự động.
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
                                <div className={`p-2 rounded-full ${settings?.has_config ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                                    <Link2 className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">
                                        {settings?.has_config ? "Đã cấu hình Kling API" : "Chưa cấu hình Kling API"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {settings?.has_config
                                            ? `URL: ${settings.api_url}`
                                            : "Vui lòng thêm URL và Cookie để sử dụng tính năng tạo video Kling."}
                                    </p>
                                </div>
                                {settings?.has_config && (
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
                                                    <AlertDialogTitle>Xóa cấu hình Kling API?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Hành động này sẽ xóa cấu hình hiện tại. Bạn sẽ cần thêm lại để sử dụng tính năng này.
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

                    <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">URL</label>
                            <Input
                                type="url"
                                placeholder="http://36.50.54.74:5010"
                                value={apiUrl}
                                onChange={(e) => setApiUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                URL của Kling API Server (mặc định: http://36.50.54.74:5010)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Cookie</label>
                            <Textarea
                                placeholder="Nhập Cookie xác thực từ KlingAI..."
                                value={cookie}
                                onChange={(e) => setCookie(e.target.value)}
                                rows={3}
                            />
                            <p className="text-xs text-muted-foreground">
                                Cookie sẽ được lưu trữ an toàn và dùng để xác thực với Kling API.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleSave}
                                disabled={saveMutation.isPending || !apiUrl.trim() || !cookie.trim()}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Lưu
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default KlingApiSettings;
