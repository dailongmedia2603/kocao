import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Loader2, AlertCircle, History } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const fetchHistory = async () => {
  const { data, error } = await supabase.from("voice_generation_history").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

const HistoryItem = ({ item }: { item: any }) => {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (historyId: string) => supabase.functions.invoke("delete-generated-voice", { body: { historyId } }),
    onSuccess: () => {
      showSuccess("Xóa thành công!");
      queryClient.invalidateQueries({ queryKey: ["voice_history"] });
    },
    onError: (error: any) => showError(`Lỗi khi xóa: ${error.context?.error_message || error.message}`),
  });

  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm" title={item.text}>{item.text}</p>
        <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: vi })}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <audio controls src={item.file_url} className="h-8" />
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Bạn có chắc muốn xóa?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending} className="bg-destructive hover:bg-destructive/90">{deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export const VoiceHistoryList = () => {
  const { data: history, isLoading, isError, error } = useQuery({ queryKey: ["voice_history"], queryFn: fetchHistory });

  return (
    <Card>
      <CardHeader><CardTitle>Lịch sử tạo Voice</CardTitle><CardDescription>Danh sách các giọng nói đã được tạo gần đây.</CardDescription></CardHeader>
      <CardContent>
        {isLoading ? <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        : isError ? <div className="text-center py-10 text-destructive"><AlertCircle className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-medium">Không thể tải lịch sử</h3><p className="mt-1 text-sm">{error.message}</p></div>
        : history && history.length > 0 ? <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">{history.map((item: any) => <HistoryItem key={item.id} item={item} />)}</div>
        : <div className="text-center py-10 border-2 border-dashed rounded-lg"><History className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">Chưa có voice nào</h3><p className="mt-1 text-sm text-muted-foreground">Hãy bắt đầu tạo voice đầu tiên của bạn!</p></div>}
      </CardContent>
    </Card>
  );
};