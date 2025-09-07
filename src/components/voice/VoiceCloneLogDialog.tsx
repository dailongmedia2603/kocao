import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

type Log = {
  id: string;
  created_at: string;
  request_url: string;
  request_payload: any;
  response_body: any;
  status_code: number;
};

type VoiceCloneLogDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  logs: Log[] | undefined;
};

const CodeBlock = ({ data }: { data: any }) => (
  <pre className="bg-gray-100 p-3 rounded-md text-xs font-mono overflow-x-auto">
    <code>{JSON.stringify(data, null, 2)}</code>
  </pre>
);

export const VoiceCloneLogDialog = ({ isOpen, onOpenChange, logs }: VoiceCloneLogDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nhật ký Clone Voice</DialogTitle>
          <DialogDescription>
            Lịch sử các yêu cầu clone voice đã được gửi đi.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          {logs && logs.length > 0 ? (
            <Accordion type="single" collapsible className="w-full space-y-2">
              {logs.map((log) => (
                <AccordionItem key={log.id} value={log.id} className="border rounded-md px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <Badge variant={log.status_code >= 200 && log.status_code < 300 ? "default" : "destructive"} className={log.status_code >= 200 && log.status_code < 300 ? "bg-green-100 text-green-800" : ""}>
                          {log.status_code}
                        </Badge>
                        <span className="font-medium text-sm truncate">
                          {log.request_payload?.voice_name || 'Không có tên'}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: vi })}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Request URL</h4>
                      <p className="text-sm font-mono bg-gray-100 p-2 rounded-md">{log.request_url}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Request Payload</h4>
                      <CodeBlock data={log.request_payload} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Response Body</h4>
                      <CodeBlock data={log.response_body} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <p>Chưa có nhật ký nào.</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};