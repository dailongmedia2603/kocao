import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type ViewScriptContentDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string | null;
  content: string | null;
};

export const ViewScriptContentDialog = ({ isOpen, onOpenChange, title, content }: ViewScriptContentDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{title || "Kịch bản chi tiết"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4 mt-4">
          <p className="whitespace-pre-wrap text-sm">{content}</p>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};