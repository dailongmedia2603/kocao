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
import { AddDreamfaceApiKeyDialog } from "./AddDreamfaceApiKeyDialog";

type DreamfaceApiKey = { 
    id: string; 
    name: string; 
    account_id: string;
    user_id_dreamface: string;
    token_id: string;
    client_id: string;
};

const fetchApiKeys = async (userId: string): Promise<DreamfaceApiKey[]> => {
  const { data, error } = await supabase.from("user_dreamface_api_keys").select("*").eq("user_id", userId).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
};

const ApiKeyRow = ({ apiKey }: { apiKey: DreamfaceApiKey }) => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_dreamface_api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa thành công!");
      queryClient.invalidateQueries({ queryKey: ["dreamface_api_keys", user?.id] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50">
      <div className="flex-1 min-w-0"><p className="font-medium truncate">{apiKey.name}</p><p className="text-sm text-muted-foreground">Account ID: {apiKey.account_id}</p></div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Xóa "{apiKey.name}"?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(apiKey.id)} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "Đang xóa..." : "Xóa"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const DreamfaceApiSettings = () => {
  const { user } = useSession();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ["dreamface_api_keys", user?.id],
    queryFn: () => fetchApiKeys(user!.id),
    enabled: !!user,
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>Cấu hình API Dreamface</CardTitle><CardDescription>Thêm và quản lý API Key của bạn từ Dreamface.</CardDescription></div>
          <Button onClick={() => setAddDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Thêm Key</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-20 w-full" /> : apiKeys && apiKeys.length > 0 ? (
            <div className="space-y-4">{apiKeys.map((key) => <ApiKeyRow key={key.id} apiKey={key} />)}</div>
          ) : (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <KeyRound className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">Chưa có API Key</h3><p className="mt-1 text-sm text-muted-foreground">Bấm "Thêm Key" để bắt đầu.</p>
            </div>
          )}
        </CardContent>
      </Card>
      <AddDreamfaceApiKeyDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
    </>
  );
};

export default DreamfaceApiSettings;