import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { FileText, Image } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "../ui/button";

export type UserFile = {
  id: string;
  file_name: string;
  file_url: string;
  created_at: string;
  source: string | null;
};

type FilePickerDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onFileSelect: (file: UserFile) => void;
  projectId: string; // Kept for potential future use, but not used in query
};

export const FilePickerDialog = ({
  isOpen,
  onOpenChange,
  onFileSelect,
}: FilePickerDialogProps) => {
  const { user } = useSession();

  const { data: files, isLoading } = useQuery<UserFile[]>({
    queryKey: ["user_files", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_files")
        .select("id, file_name, file_url, created_at, source")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { uploadedFiles, extractedFiles } = useMemo(() => {
    const uploaded = files?.filter(file => file.source === 'upload' || file.source === null) || [];
    const extracted = files?.filter(file => file.source === 'extract') || [];
    return { uploadedFiles: uploaded, extractedFiles: extracted };
  }, [files]);

  const handleSelect = (file: UserFile) => {
    onFileSelect(file);
    onOpenChange(false);
  };

  const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  };

  const renderFileItem = (file: UserFile) => (
    <Button
      key={file.id}
      variant="outline"
      className="w-full h-auto justify-start p-2 text-left"
      onClick={() => handleSelect(file)}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
          {isImage(file.file_name) ? <Image className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="font-semibold truncate">{file.file_name}</p>
          <p className="text-xs text-muted-foreground">
            Tạo lúc: {new Date(file.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </Button>
  );

  const renderFileList = (title: string, fileList: UserFile[], emptyMessage: string) => (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground px-1">{title}</h3>
      {fileList.length > 0 ? (
        <div className="space-y-2">
          {fileList.map(renderFileItem)}
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground py-6 px-4 border-2 border-dashed rounded-lg">
          {emptyMessage}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Chọn tệp từ thư viện</DialogTitle>
          <DialogDescription>
            Chọn một tệp đã được tải lên hoặc trích xuất trước đó.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[450px] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : files && files.length > 0 ? (
            <div className="space-y-6">
              {renderFileList("Tệp đã tải lên", uploadedFiles, "Bạn chưa tải lên tệp nào.")}
              {renderFileList("Tệp đã trích xuất", extractedFiles, "Chưa có tệp nào được trích xuất từ các kịch bản.")}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-10">
              Thư viện của bạn chưa có tệp nào.
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};