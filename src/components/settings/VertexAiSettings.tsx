import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useState } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, KeyRound } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AddVertexAiKeyDialog } from "./AddVertexAiKeyDialog";

type VertexAiKey = {
  id: string;
  name: string;
  project_id: string;
};

const fetchVertexAiKeys = async (userId: string): Promise<VertexAiKey[]> => {
  const { data, error } = await supabase
    .from("user_vertex_ai_credentials")
    .select("id, name, project_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
};

const ApiKeyRow = ({ apiKey }: { apiKey: VertexAiKey }) => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (keyId: string) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase.from("user_vertex_ai_credentials").delete().match({ id: keyId, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa thông tin xác thực thành công!");
      queryClient.invalidateQueries({ queryKey: ["vertex_ai_keys", user?.id] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{apiKey.name}</p>
        <p className="text-sm text-muted-foreground font-mono">Project ID: {apiKey.project_id}</p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="icon">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa "{apiKey.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription>
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
  );
};

const VertexAiSettings = () => {
  const { user } = useSession();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ["vertex_ai_keys", user?.id],
    queryFn: () => fetchVertexAiKeys(user!.id),
    enabled: !!user,
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cấu hình Gemini qua Vertex AI</CardTitle>
            <CardDescription>
              Thêm và quản lý thông tin xác thực Service Account để sử dụng Gemini trên nền tảng Vertex AI.
            </CardDescription>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Thêm
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
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
              <h3 className="mt-4 text-lg font-medium">Chưa có thông tin xác thực nào</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Bấm "Thêm" để thêm tệp JSON Service Account đầu tiên của bạn.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <AddVertexAiKeyDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
    </>
  );
};

export default VertexAiSettings;