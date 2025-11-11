import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UploadCloud, File as FileIcon, X } from "lucide-react";

type UploadVideoDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  folderPath: string;
  kocId: string;
  userId: string;
  kocName: string;
  accept?: string;
};

export const UploadVideoDialog = ({ isOpen, onOpenChange, folderPath, kocId, userId, kocName, accept }: UploadVideoDialogProps) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folderPath", folderPath);
        formData.append("fileName", file.name);
        formData.append("kocId", kocId);
        formData.append("userId", userId);

        return supabase.functions.invoke("upload-koc-file", { body: formData })
          .then(({ error }) => {
            if (error) throw new Error(`Lỗi tải lên ${file.name}: ${error.message}`);
          });
      });
      await Promise.all(uploadPromises);
      return files.length;
    },
    onSuccess: (fileCount) => {
      showSuccess(`Đã tải lên thành công ${fileCount} tệp!`);
      queryClient.invalidateQueries({ queryKey: ["kocFiles", kocId] });
      queryClient.invalidateQueries({ queryKey: ["onboarding_source_videos", kocId] });
      handleClose();
    },
    onError: (error: Error) => showError(`Lỗi tải lên: ${error.message}`),
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(event.target.files!)]);
    }
  };
  
  const removeFile = (fileToRemove: File) => setSelectedFiles(prev => prev.filter(f => f !== fileToRemove));
  const handleUpload = () => uploadMutation.mutate(selectedFiles);
  const handleClose = () => {
    setSelectedFiles([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tải lên tệp cho {kocName}</DialogTitle>
          <DialogDescription>Chọn tệp để tải lên thư mục <span className="font-mono bg-muted p-1 rounded text-xs">{folderPath}</span>.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors">
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Bấm để chọn tệp</p>
            <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} multiple accept={accept} />
          </label>
          {selectedFiles.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Đã chọn {selectedFiles.length} tệp:</p>
              <ScrollArea className="h-40 border rounded-lg p-2">
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-grow min-w-0">
                          <p className="font-medium truncate text-sm" title={file.name}>{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => removeFile(file)}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>Hủy</Button>
          <Button onClick={handleUpload} disabled={selectedFiles.length === 0 || uploadMutation.isPending}>
            {uploadMutation.isPending ? `Đang tải lên...` : `Tải lên ${selectedFiles.length} tệp`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};