import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type ViewScriptLogDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string | null;
  prompt: string | null;
};

export const ViewScriptLogDialog = ({ isOpen, onOpenChange, title, prompt }: ViewScriptLogDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>AI Prompt Log</DialogTitle>
          <DialogDescription>
            Đây là prompt đầy đủ đã được gửi đến AI để tạo kịch bản "{title}".
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4 mt-4">
          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md font-mono">
            <code>{prompt || "Không có log prompt cho kịch bản này."}</code>
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};