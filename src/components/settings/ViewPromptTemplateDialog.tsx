import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type Template = {
  id: string;
  name: string;
  is_default: boolean;
  ai_role?: string | null;
  business_field?: string | null;
  writing_style?: string | null;
  tone_of_voice?: string | null;
  goal?: string | null;
  word_count?: number | null;
  mandatory_requirements?: string | null;
  model?: string | null;
};

type ViewPromptTemplateDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  template: Template | null;
};

const DetailItem = ({ label, value }: { label: string; value: string | number | null | undefined }) => {
  if (!value) return null;
  return (
    <div>
      <h4 className="font-semibold text-sm text-muted-foreground">{label}</h4>
      <p className="whitespace-pre-wrap text-sm mt-1 p-3 bg-muted rounded-md">{value}</p>
    </div>
  );
};

export const ViewPromptTemplateDialog = ({ isOpen, onOpenChange, template }: ViewPromptTemplateDialogProps) => {
  if (!template) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {template.name}
            {template.is_default && <Badge>Mặc định</Badge>}
          </DialogTitle>
          <DialogDescription>
            Chi tiết cấu hình cho mẫu prompt này.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4 mt-4">
          <div className="space-y-4">
            <DetailItem label="Model AI" value={template.model} />
            <DetailItem label="Vai trò của AI" value={template.ai_role} />
            <DetailItem label="Lĩnh vực kinh doanh" value={template.business_field} />
            <DetailItem label="Phong cách" value={template.writing_style} />
            <DetailItem label="Tông giọng" value={template.tone_of_voice} />
            <DetailItem label="Mục tiêu cần đạt" value={template.goal} />
            <DetailItem label="Độ dài bài viết (số từ)" value={template.word_count} />
            <DetailItem label="Điều kiện bắt buộc" value={template.mandatory_requirements} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};