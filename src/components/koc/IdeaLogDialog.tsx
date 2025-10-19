import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ServerCrash, Inbox } from "lucide-react";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

type IdeaLog = {
  id: string;
  created_at: string;
  idea_content: string;
  ai_prompt_log: string | null;
};

type IdeaLogDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  kocId: string;
};

export const IdeaLogDialog = ({ isOpen, onOpenChange, kocId }: IdeaLogDialogProps) => {
  const { data: logs, isLoading, isError } = useQuery<IdeaLog[]>({
    queryKey: ['idea_logs', kocId],
    queryFn: async () => {
      if (!kocId) return [];
      const { data, error } = await supabase
        .from('koc_content_ideas')
        .select('id, created_at, idea_content, ai_prompt_log')
        .eq('koc_id', kocId)
        .not('ai_prompt_log', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!kocId,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nhật ký Prompt AI</DialogTitle>
          <DialogDescription>Lịch sử các prompt đã được gửi đến AI để tạo content từ idea.</DialogDescription>
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
                      <span className="font-medium text-sm text-left truncate">{log.idea_content}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-4">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: vi })}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <pre className="whitespace-pre-wrap text-xs bg-muted p-4 rounded-md font-mono">
                      <code>{log.ai_prompt_log || "Không có log prompt."}</code>
                    </pre>
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