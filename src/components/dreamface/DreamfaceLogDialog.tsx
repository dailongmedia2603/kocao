import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2, ServerCrash, Inbox } from "lucide-react";

type Log = {
  id: string;
  created_at: string;
  action: string;
  request_payload: any;
  response_body: any;
  status_code: number;
  error_message: string | null;
};

type DreamfaceLogDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const CodeBlock = ({ data }: { data: any }) => (
  <pre className="bg-gray-100 p-3 rounded-md text-xs font-mono overflow-x-auto">
    <code>{JSON.stringify(data, null, 2)}</code>
  </pre>
);

export const DreamfaceLogDialog = ({ isOpen, onOpenChange }: DreamfaceLogDialogProps) => {
  const { user } = useSession();

  const { data: logs, isLoading, isError } = useQuery<Log[]>({
    queryKey: ['dreamface_logs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('dreamface_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user && isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nhật ký API Dreamface</DialogTitle>
          <DialogDescription>Lịch sử các lần hệ thống tương tác với Dreamface API.</DialogDescription>
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
                        <Badge variant={log.status_code && log.status_code >= 200 && log.status_code < 300 ? "default" : "destructive"} className={log.status_code && log.status_code >= 200 && log.status_code < 300 ? "bg-green-100 text-green-800" : ""}>{log.status_code || 'N/A'}</Badge>
                        <span className="font-medium text-sm truncate">{log.action}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: vi })}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 space-y-4">
                    {log.request_payload && <div><h4 className="font-semibold text-sm mb-1">Request Payload</h4><CodeBlock data={log.request_payload} /></div>}
                    {log.response_body && <div><h4 className="font-semibold text-sm mb-1">Response Body</h4><CodeBlock data={log.response_body} /></div>}
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