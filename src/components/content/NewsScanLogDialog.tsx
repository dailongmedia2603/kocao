import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2, ServerCrash, Inbox, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { showSuccess, showError } from "@/utils/toast";

type ScanLog = {
  id: string;
  created_at: string;
  source_name: string;
  request_url: string;
  response_body: any;
  status_code: number;
  error_message: string | null;
};

type NewsScanLogDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const CodeBlock = ({ data }: { data: any }) => (
  <pre className="bg-gray-100 p-3 rounded-md text-xs font-mono overflow-x-auto">
    <code>{JSON.stringify(data, null, 2)}</code>
  </pre>
);

export const NewsScanLogDialog = ({ isOpen, onOpenChange }: NewsScanLogDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const { data: logs, isLoading, isError } = useQuery<ScanLog[]>({
    queryKey: ['news_scan_logs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('news_scan_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!user && isOpen,
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from('news_scan_logs')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Đã xóa toàn bộ nhật ký.");
      queryClient.invalidateQueries({ queryKey: ['news_scan_logs', user?.id] });
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="flex-row justify-between items-center">
          <div>
            <DialogTitle>Nhật ký quét tin tức</DialogTitle>
            <DialogDescription>Lịch sử các lần hệ thống tự động quét tin từ các nguồn đã cấu hình.</DialogDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={!logs || logs.length === 0 || clearLogsMutation.isPending}>
                <Trash2 className="mr-2 h-4 w-4" />
                Xóa tất cả
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Hành động này không thể hoàn tác. Toàn bộ lịch sử quét tin sẽ bị xóa vĩnh viễn.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={() => clearLogsMutation.mutate()} disabled={clearLogsMutation.isPending}>
                  {clearLogsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xóa"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-full text-destructive"><ServerCrash className="h-12 w-12" /><p className="mt-4">Không thể tải nhật ký.</p></div>
          ) : logs && logs.length > 0 ? (
            <Accordion type="single" collapsible className="w-full space-y-2">
              {logs.map((log) => (
                <AccordionItem key={log.id} value={log.id} className="border rounded-md px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <Badge variant={log.status_code === 200 ? "default" : "destructive"} className={log.status_code === 200 ? "bg-green-100 text-green-800" : ""}>{log.status_code}</Badge>
                        <span className="font-medium text-sm truncate">{log.source_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: vi })}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 space-y-4">
                    <div><h4 className="font-semibold text-sm mb-1">Request URL</h4><p className="text-sm font-mono bg-gray-100 p-2 rounded-md break-all">{log.request_url}</p></div>
                    <div><h4 className="font-semibold text-sm mb-1">Response Body</h4><CodeBlock data={log.response_body} /></div>
                    {log.error_message && <div><h4 className="font-semibold text-sm mb-1 text-destructive">Error Message</h4><p className="text-sm font-mono bg-red-50 text-red-700 p-2 rounded-md">{log.error_message}</p></div>}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><Inbox className="h-12 w-12" /><p className="mt-4">Chưa có nhật ký nào.</p></div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};