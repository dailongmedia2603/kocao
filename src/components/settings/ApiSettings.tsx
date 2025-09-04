import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useState } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, EyeOff, Trash2, CheckCircle, Loader2, Plus, KeyRound } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AddApiKeyDialog } from "./AddApiKeyDialog";

type ApiKey = {
  id: string;
  name: string;
  api_key: string;
};

const fetchApiKeys = async (userId: string): Promise<ApiKey[]> => {
  const { data, error } = await supabase
    .from("user_api_keys")
    .select("id, name, api_key")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return data;
};

const ApiKeyRow = ({ apiKey }: { apiKey: ApiKey }) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (keyId: string) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase.from("user_api_keys").delete().eq("id", keyId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa API Key thành công!");
      queryClient.invalidateQueries({ queryKey: ["api_keys", user?.id] });
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const checkConnectionMutation = useMutation({
    mutationFn: async (key: string) => {
      const { data, error } = await supabase.functions.invoke("check-gemini-api-key", { body: { apiKey: key } });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: (data) => {
      showSuccess(data.message);
    },
    onError: (error: Error) => {
      showError(`Kiểm tra thất bại: ${error.message}`);
    },
  });

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{apiKey.name}</p>
        <p className="text-sm text-muted-foreground font-mono">{showKey ? apiKey.api_key : maskApiKey(apiKey.api_key)}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          onClick={() => checkConnectionMutation.mutate(apiKey.api_key)}
          disabled={checkConnectionMutation.isPending}
        >
          {checkConnectionMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Kiểm tra
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa API Key "{apiKey.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(apiKey.id)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const ApiSettings = () => {
  const { user } = useSession();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ["api_keys", user?.id],
    queryFn: () => fetchApiKeys(user!.id),
    enabled: !!user,
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cấu hình API Gemini</CardTitle>
            <CardDescription>
              Thêm và quản lý các API Key Gemini của bạn.
              Bạn có thể lấy key từ <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google AI Studio</a>.
            </CardDescription>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Thêm Key
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : apiKeys && apiKeys.length > 0 ? (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <ApiKeyRow key={key.id} apiKey={key} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <KeyRound className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Chưa có API Key nào</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Bấm "Thêm Key" để thêm API Key Gemini đầu tiên của bạn.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <AddApiKeyDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
    </>
  );
};

export default ApiSettings;