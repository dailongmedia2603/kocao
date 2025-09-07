import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { callVoiceApi } from "@/lib/voiceApi";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Mic, Trash2, Loader2, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

const fetchClonedVoices = async () => {
  const data = await callVoiceApi({ path: "v1m/voice/clone", method: "GET" });
  // Sắp xếp theo thời gian tạo, mới nhất lên đầu
  return data.data.sort((a: any, b: any) => b.create_time - a.create_time);
};

const VoiceItem = ({ voice }: { voice: any }) => {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (voiceId: string) => callVoiceApi({ path: `v1m/voice/clone/${voiceId}`, method: "DELETE" }),
    onSuccess: () => {
      showSuccess("Xóa giọng nói thành công!");
      queryClient.invalidateQueries({ queryKey: ["cloned_voices"] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  // API trả về voice_status = 2 khi hoàn tất
  const isProcessing = voice.voice_status !== 2;

  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Avatar className="h-12 w-12"><AvatarImage src={voice.cover_url} /><AvatarFallback>{voice.voice_name.charAt(0)}</AvatarFallback></Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{voice.voice_name}</p>
          {isProcessing ? (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-blue-800 border-blue-200">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Đang xử lý...
              </Badge>
            </div>
          ) : (
            voice.sample_audio && <audio controls src={voice.sample_audio} className="h-8 w-full mt-1" />
          )}
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Xóa giọng nói "{voice.voice_name}"?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(voice.voice_id)} disabled={deleteMutation.isPending} className="bg-destructive hover:bg-destructive/90">
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const ClonedVoiceList = () => {
  const queryClient = useQueryClient();
  const { data: voices, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["cloned_voices"],
    queryFn: fetchClonedVoices,
    refetchInterval: (query) => {
      const data = query.state.data as any[];
      // Nếu có bất kỳ giọng nói nào đang xử lý, tự động làm mới sau 10 giây
      return data?.some(voice => voice.voice_status !== 2) ? 10000 : false;
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Danh sách Giọng nói đã Clone</CardTitle>
          <CardDescription>Các giọng nói tùy chỉnh của bạn.</CardDescription>
        </div>
        <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["cloned_voices"] })} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="space-y-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        : isError ? <div className="text-center py-10 text-destructive"><AlertCircle className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-medium">Không thể tải danh sách</h3><p className="mt-1 text-sm">{(error as Error).message}</p></div>
        : voices && voices.length > 0 ? <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">{voices.map((voice: any) => <VoiceItem key={voice.voice_id} voice={voice} />)}</div>
        : <div className="text-center py-10 border-2 border-dashed rounded-lg"><Mic className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">Chưa có giọng nói nào</h3><p className="mt-1 text-sm text-muted-foreground">Hãy bắt đầu clone giọng nói đầu tiên của bạn!</p></div>}
      </CardContent>
    </Card>
  );
};