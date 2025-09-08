import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type ViewPostContentDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  content: string | null;
};

export const ViewPostContentDialog = ({ isOpen, onOpenChange, content }: ViewPostContentDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nội dung đầy đủ</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4 mt-4">
          <p className="whitespace-pre-wrap text-sm">{content}</p>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};