import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/apiClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/utils/toast";
import { CheckCircle2, Loader2, HardDrive, Trash2, Cloud } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const R2ApiSettings = () => {
    const [endpoint, setEndpoint] = useState("");
    const [accessKeyId, setAccessKeyId] = useState("");
    const [secretAccessKey, setSecretAccessKey] = useState("");
    const [bucket, setBucket] = useState("");
    const [publicUrl, setPublicUrl] = useState("");
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery({
        queryKey: ["settings", "r2"],
        queryFn: settingsApi.getR2,
    });

    const saveMutation = useMutation({
        mutationFn: () => settingsApi.saveR2({
            endpoint,
            access_key_id: accessKeyId,
            secret_access_key: secretAccessKey,
            bucket,
            public_url: publicUrl || undefined,
        }),
        onSuccess: () => {
            showSuccess("Đã lưu cấu hình R2 thành công!");
            setEndpoint("");
            setAccessKeyId("");
            setSecretAccessKey("");
            setBucket("");
            setPublicUrl("");
            queryClient.invalidateQueries({ queryKey: ["settings", "r2"] });
        },
        onError: () => showError("Lưu cấu hình R2 thất bại"),
    });

    const deleteMutation = useMutation({
        mutationFn: settingsApi.deleteR2,
        onSuccess: () => {
            showSuccess("Đã xóa cấu hình R2 thành công!");
            queryClient.invalidateQueries({ queryKey: ["settings", "r2"] });
        },
        onError: () => showError("Xóa cấu hình R2 thất bại"),
    });

    const checkMutation = useMutation({
        mutationFn: settingsApi.checkR2,
        onSuccess: (data) => {
            if (data.valid) {
                showSuccess("Cấu hình R2 hợp lệ! Đã kết nối thành công.");
            } else {
                showError(data.message || "Không thể kết nối đến R2. Vui lòng kiểm tra lại cấu hình.");
            }
        },
        onError: (error: Error) => showError(`Lỗi kiểm tra: ${error.message}`),
    });

    const handleSave = () => {
        if (!endpoint.trim() || !accessKeyId.trim() || !secretAccessKey.trim() || !bucket.trim()) {
            showError("Vui lòng điền đầy đủ các trường bắt buộc");
            return;
        }
        saveMutation.mutate();
    };

    const isFormValid = endpoint.trim() && accessKeyId.trim() && secretAccessKey.trim() && bucket.trim();

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Cloud className="h-5 w-5" />
                        Cấu hình Cloudflare R2
                    </CardTitle>
                    <CardDescription>
                        Cấu hình Cloudflare R2 để lưu trữ video nguồn và các tệp của KOC. Nếu không cấu hình, hệ thống sẽ sử dụng bộ nhớ cục bộ.
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
                                <div className={`p-2 rounded-full ${settings?.has_config ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-500"}`}>
                                    <HardDrive className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">
                                        {settings?.has_config ? "Đã cấu hình R2 Storage" : "Đang sử dụng bộ nhớ cục bộ"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {settings?.has_config
                                            ? `Bucket: ${settings.bucket} | Endpoint: ${settings.endpoint}`
                                            : "Video và tệp sẽ được lưu tại server. Cấu hình R2 để lưu trữ đám mây."}
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
                                                    <AlertDialogTitle>Xóa cấu hình R2?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Hành động này sẽ xóa cấu hình Cloudflare R2. Hệ thống sẽ chuyển sang sử dụng bộ nhớ cục bộ.
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
                        <p className="text-sm font-medium">{settings?.has_config ? "Cập nhật cấu hình R2" : "Thêm cấu hình R2"}</p>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="endpoint">Endpoint <span className="text-red-500">*</span></Label>
                                <Input
                                    id="endpoint"
                                    placeholder="https://xxx.r2.cloudflarestorage.com"
                                    value={endpoint}
                                    onChange={(e) => setEndpoint(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bucket">Bucket Name <span className="text-red-500">*</span></Label>
                                <Input
                                    id="bucket"
                                    placeholder="my-bucket"
                                    value={bucket}
                                    onChange={(e) => setBucket(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="accessKeyId">Access Key ID <span className="text-red-500">*</span></Label>
                                <Input
                                    id="accessKeyId"
                                    type="password"
                                    placeholder="Nhập Access Key ID..."
                                    value={accessKeyId}
                                    onChange={(e) => setAccessKeyId(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="secretAccessKey">Secret Access Key <span className="text-red-500">*</span></Label>
                                <Input
                                    id="secretAccessKey"
                                    type="password"
                                    placeholder="Nhập Secret Access Key..."
                                    value={secretAccessKey}
                                    onChange={(e) => setSecretAccessKey(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="publicUrl">Public URL (tùy chọn)</Label>
                            <Input
                                id="publicUrl"
                                placeholder="https://cdn.example.com (URL công khai để truy cập file)"
                                value={publicUrl}
                                onChange={(e) => setPublicUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                URL dùng để truy cập công khai các tệp. Bỏ trống nếu không có custom domain.
                            </p>
                        </div>

                        <Button
                            onClick={handleSave}
                            disabled={saveMutation.isPending || !isFormValid}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Lưu cấu hình
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default R2ApiSettings;
