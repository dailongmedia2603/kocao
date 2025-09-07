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
import { AddMinimaxCredentialsDialog } from "./AddMinimaxCredentialsDialog";

type MinimaxCreds = { id: string; name: string; group_id: string; api_key: string; };

const fetchCredentials = async (userId: string): Promise<MinimaxCreds[]> => {
  const { data, error } = await supabase.from("user_minimax_credentials").select("*").eq("user_id", userId).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
};

const CredentialRow = ({ creds }: { creds: MinimaxCreds }) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_minimax_credentials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa thành công!");
      queryClient.invalidateQueries({ queryKey: ["minimax_credentials", user?.id] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  const checkConnectionMutation = useMutation({
    mutationFn: async ({ groupId, apiKey }: { groupId: string; apiKey: string }) => {
      const { data, error } = await supabase.functions.invoke("check-minimax-api-key", { body: { groupId, apiKey } });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: (data) => showSuccess(data.message),
    onError: (error: Error) => showError(`Kiểm tra thất bại: ${error.message}`),
  });

  const mask = (key: string) => key.length <= 8 ? "••••••••" : `${key.slice(0, 4)}••••••••${key.slice(-4)}`;

  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{creds.name}</p>
        <p className="text-sm text-muted-foreground font-mono">API Key: {showKey ? creds.api_key : mask(creds.api_key)}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button variant="outline" onClick={() => checkConnectionMutation.mutate({ groupId: creds.group_id, apiKey: creds.api_key })} disabled={checkConnectionMutation.isPending}>
          {checkConnectionMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}Kiểm tra
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Xóa "{creds.name}"?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(creds.id)} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "Đang xóa..." : "Xóa"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const MinimaxApiSettings = () => {
  const { user } = useSession();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);

  const { data: credentials, isLoading } = useQuery({
    queryKey: ["minimax_credentials", user?.id],
    queryFn: () => fetchCredentials(user!.id),
    enabled: !!user,
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cấu hình API Minimax Voice</CardTitle>
            <CardDescription>Thêm và quản lý các thông tin xác thực API Minimax của bạn.</CardDescription>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Thêm</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-20 w-full" /> : credentials && credentials.length > 0 ? (
            <div className="space-y-4">{credentials.map((creds) => <CredentialRow key={creds.id} creds={creds} />)}</div>
          ) : (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <KeyRound className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Chưa có thông tin API</h3>
              <p className="mt-1 text-sm text-muted-foreground">Bấm "Thêm" để bắt đầu.</p>
            </div>
          )}
        </CardContent>
      </Card>
      <AddMinimaxCredentialsDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
    </>
  );
};

export default MinimaxApiSettings;