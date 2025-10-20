import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ServerCrash } from "lucide-react";

type LogDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  task: { id: string; video_name: string } | null;
};

const CodeBlock = ({ data }: { data: any }) => (
  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md font-mono">
    <code>{JSON.stringify(data, null, 2)}</code>
  </pre>
);

export const TranscriptionLogDialog = ({ isOpen, onOpenChange, task }: LogDialogProps) => {
  const { data: logData, isLoading, isError } = useQuery({
    queryKey: ['transcription_log', task?.id],
    queryFn: async () => {
      if (!task) return null;
      const { data, error } = await supabase
        .from('transcription_tasks')
        .select('api_response_log')
        .eq('id', task.id)
        .single();
      if (error) throw error;
      return data?.api_response_log;
    },
    enabled: isOpen && !!task,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Log API cho tác vụ</DialogTitle>
          <DialogDescription>{task?.video_name}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] mt-4 pr-4">
          {isLoading && <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
          {isError && <div className="flex flex-col items-center justify-center h-48 text-destructive"><ServerCrash className="h-12 w-12" /><p className="mt-4">Không thể tải log.</p></div>}
          {logData ? (
            <CodeBlock data={logData} />
          ) : (!isLoading && !isError && <p className="text-center text-muted-foreground py-8">Không có dữ liệu log cho tác vụ này.</p>)}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};