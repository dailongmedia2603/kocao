import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Image, Loader2 } from "lucide-react";

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
};

type FilePickerDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onFileSelect: (file: UserFile) => void;
  projectId: string;
};

export const FilePickerDialog = ({
  isOpen,
  onOpenChange,
  onFileSelect,
  projectId,
}: FilePickerDialogProps) => {
  const { data: files, isLoading } = useQuery<UserFile[]>({
    queryKey: ["user_files", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_files")
        .select("id, file_name, file_url, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const handleSelect = (file: UserFile) => {
    onFileSelect(file);
    onOpenChange(false);
  };

  const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Chọn tệp từ thư viện</DialogTitle>
          <DialogDescription>
            Chọn một tệp đã được tải lên hoặc trích xuất trước đó trong dự án này.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : files && files.length > 0 ? (
              files.map((file) => (
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
                    <div className="flex-1">
                      <p className="font-semibold truncate">{file.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Tải lên lúc: {new Date(file.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Button>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-10">
                Không có tệp nào trong thư viện của dự án này.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};