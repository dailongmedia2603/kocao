import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { useState } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Loader2, KeyRound, Coins, AlertCircle, RefreshCw, XCircle, Trash2 } from "lucide-react";
import { AddVoiceApiKeyDialog } from "./AddVoiceApiKeyDialog";
import { callVoiceApi } from "@/lib/voiceApi";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const CreditUsage = () => {
  const { user } = useSession();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['voice_api_credit'],
    queryFn: async () => {
      const response = await callVoiceApi({ path: "v1/credits", method: "GET" });
      if (response && response.credits !== undefined) {
        return response;
      }
      throw new Error("Định dạng phản hồi không hợp lệ từ API credit.");
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Đang tải thông tin credit...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm text-destructive p-4 border border-destructive/50 bg-destructive/10 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>Lỗi tải credit: {(error as Error).message}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const availableCredits = data?.credits || 0;

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <Coins className="h-6 w-6" />
      </div>
      <div className="grid gap-1 text-sm">
        <div className="font-semibold">Credit Hiện Có</div>
        <div className="text-2xl font-bold">{availableCredits.toLocaleString('vi-VN')}</div>
      </div>
      <Button variant="ghost" size="icon" className="ml-auto" onClick={() => refetch()} disabled={isFetching}>
        <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
      </Button>
    </div>
  );
};

const VoiceApiSettings = () => {
  const { user } = useSession();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["voice_api_status", user?.id],
    queryFn: () => api.settings.getVoiceApi(),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: api.settings.deleteVoiceApi,
    onSuccess: () => {
      showSuccess("Đã xóa API Key thành công!");
      refetch();
    },
    onError: () => showError("Xóa API Key thất bại"),
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>Cấu hình API Voice</CardTitle><CardDescription>Thêm và quản lý API Key của bạn từ Vivoo.work.</CardDescription></div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CreditUsage />
          {isLoading ? <Skeleton className="h-20 w-full" /> : (
            <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50">
              <div className="flex items-center gap-3">
                {status?.has_key ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <XCircle className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{status?.has_key ? "Đã cấu hình API Key" : "Chưa cấu hình API Key"}</p>
                  <p className="text-sm text-muted-foreground">{status?.has_key ? "Hệ thống đã sẵn sàng sử dụng Voice API." : "Vui lòng thêm API Key để sử dụng tính năng Voice."}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant={status?.has_key ? "outline" : "default"} onClick={() => setAddDialogOpen(true)}>
                  {status?.has_key ? "Cập nhật Key" : "Thêm Key"}
                </Button>
                {status?.has_key && (
                  <Button variant="outline" onClick={async () => {
                    try {
                      const res = await api.settings.checkVoiceApi();
                      if (res.valid) {
                        showSuccess("API Key hoạt động tốt!");
                        refetch(); // Reload status/credits
                      } else {
                        // Fallback if valid=false but no error thrown (unlikely with current backend)
                        showError("API Key không hợp lệ");
                      }
                    } catch (error: any) {
                      showError(error.message || "Kiểm tra thất bại");
                    }
                  }}>
                    Kiểm tra API
                  </Button>
                )}
                {status?.has_key && (
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
                        <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive hover:bg-destructive/90" disabled={deleteMutation.isPending}>
                          {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <AddVoiceApiKeyDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
    </>
  );
};

export default VoiceApiSettings;