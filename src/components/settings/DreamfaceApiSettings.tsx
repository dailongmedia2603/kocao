import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { useState } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Trash2 } from "lucide-react";
import { AddDreamfaceApiKeyDialog } from "./AddDreamfaceApiKeyDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const DreamfaceApiSettings = () => {
  const { user } = useSession();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["dreamface_api_status", user?.id],
    queryFn: () => api.settings.getDreamface(),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: api.settings.deleteDreamface,
    onSuccess: () => {
      showSuccess("Đã xóa Credentials thành công!");
      refetch();
    },
    onError: () => showError("Xóa Credentials thất bại"),
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>Cấu hình API Tạo Video</CardTitle><CardDescription>Thêm và quản lý Credentials để tạo video.</CardDescription></div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-20 w-full" /> : (
            <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50">
              <div className="flex items-center gap-3">
                {status?.has_credentials ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <XCircle className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{status?.has_credentials ? "Đã cấu hình Credentials" : "Chưa cấu hình Credentials"}</p>
                  <p className="text-sm text-muted-foreground">{status?.has_credentials ? "Hệ thống đã sẵn sàng tạo video." : "Vui lòng thêm Credentials để sử dụng tính năng tạo video."}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant={status?.has_credentials ? "outline" : "default"} onClick={() => setAddDialogOpen(true)}>
                  {status?.has_credentials ? "Cập nhật" : "Thêm mới"}
                </Button>
                {status?.has_credentials && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xóa Credentials?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Hành động này sẽ xóa Credentials hiện tại. Bạn sẽ cần thêm lại để sử dụng tính năng này.
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
      <AddDreamfaceApiKeyDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
    </>
  );
};

export default DreamfaceApiSettings;