import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/apiClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { CheckCircle2, Loader2, Key, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


const TrollLlmApiSettings = () => {
    const [apiKey, setApiKey] = useState("");
    const [baseUrl, setBaseUrl] = useState("https://chat.trollllm.xyz/v1");
    const [model, setModel] = useState("gemini-3-pro-preview");
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery({
        queryKey: ["settings", "troll-llm"],
        queryFn: settingsApi.getTrollLlm,
    });

    // Update local state when settings are loaded
    useEffect(() => {
        if (settings) {
            if (settings.base_url) setBaseUrl(settings.base_url);
            if (settings.model) setModel(settings.model);
        }
    }, [settings]);

    const saveMutation = useMutation({
        mutationFn: () => settingsApi.saveTrollLlm(apiKey, baseUrl, model),
        onSuccess: () => {
            showSuccess("Đã lưu cấu hình thành công!");
            setApiKey("");
            queryClient.invalidateQueries({ queryKey: ["settings", "troll-llm"] });
        },
        onError: () => showError("Lưu cấu hình thất bại"),
    });

    const deleteMutation = useMutation({
        mutationFn: settingsApi.deleteTrollLlm,
        onSuccess: () => {
            showSuccess("Đã xóa API Key thành công!");
            queryClient.invalidateQueries({ queryKey: ["settings", "troll-llm"] });
        },
        onError: () => showError("Xóa API Key thất bại"),
    });

    const checkMutation = useMutation({
        mutationFn: settingsApi.checkTrollLlm,
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
        if (!baseUrl.trim()) {
            showError("Vui lòng nhập Base URL");
            return;
        }
        if (!model.trim()) {
            showError("Vui lòng nhập Model");
            return;
        }
        saveMutation.mutate();
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Cấu hình API Gemini</CardTitle>
                    <CardDescription>
                        Cấu hình kết nối API Gemini (OpenAI Compatible). Bạn có thể thay đổi Base URL và Model tùy theo nhà cung cấp.
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
                                            ? "Bạn đã có thể sử dụng các tính năng AI."
                                            : "Vui lòng thêm API Key để sử dụng tính năng AI."}
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

                            {/* Current Configuration Display */}
                            {settings?.has_key && (
                                <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                                    <p className="text-sm font-medium text-blue-800">Cấu hình hiện tại:</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Base URL:</span>
                                            <p className="font-mono text-xs break-all">{settings.base_url}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Model:</span>
                                            <p className="font-mono text-xs">{settings.model}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="space-y-4 pt-4 border-t">
                        <h4 className="font-medium">{settings?.has_key ? "Cập nhật cấu hình" : "Thêm cấu hình mới"}</h4>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Base URL <span className="text-red-500">*</span></label>
                            <Input
                                type="url"
                                placeholder="https://chat.trollllm.xyz/v1"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                URL endpoint của API (OpenAI Compatible format)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Model <span className="text-red-500">*</span></label>
                            <Input
                                type="text"
                                placeholder="gemini-3-pro-preview"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Tên model AI muốn sử dụng
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">API Key <span className="text-red-500">*</span></label>
                            <div className="flex gap-2">
                                <Input
                                    type="password"
                                    placeholder="Nhập API Key..."
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
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default TrollLlmApiSettings;
