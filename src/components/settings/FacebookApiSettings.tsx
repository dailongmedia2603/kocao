import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useSession } from "@/contexts/SessionContext";
import { useState } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Trash2 } from "lucide-react";
import { AddFacebookTokenDialog } from "./AddFacebookTokenDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const FacebookApiSettings = () => {
  const { user } = useSession();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["facebook_status", user?.id],
    queryFn: () => api.settings.getFacebook(),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: api.settings.deleteFacebook,
    onSuccess: () => {
      showSuccess("Đã xóa Access Token thành công!");
      refetch();
    },
    onError: () => showError("Xóa Access Token thất bại"),
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cấu hình API Facebook</CardTitle>
            <CardDescription>
              Thêm và quản lý Access Token để kết nối với Facebook.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50">
              <div className="flex items-center gap-3">
                {status?.has_token ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <XCircle className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{status?.has_token ? "Đã cấu hình Access Token" : "Chưa cấu hình Access Token"}</p>
                  <p className="text-sm text-muted-foreground">{status?.has_token ? "Hệ thống đã kết nối với Facebook." : "Vui lòng thêm Access Token để kết nối."}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant={status?.has_token ? "outline" : "default"} onClick={() => setAddDialogOpen(true)}>
                  {status?.has_token ? "Cập nhật Token" : "Thêm Token"}
                </Button>
                {status?.has_token && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xóa Access Token?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Hành động này sẽ xóa Access Token hiện tại. Bạn sẽ cần thêm lại để sử dụng tính năng này.
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
      <AddFacebookTokenDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
    </>
  );
};

export default FacebookApiSettings;