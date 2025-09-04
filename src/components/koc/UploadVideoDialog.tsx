import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UploadCloud, FileVideo, X } from "lucide-react";

type UploadVideoDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  folderPath: string;
  kocName: string;
};

export const UploadVideoDialog = ({ isOpen, onOpenChange, folderPath, kocName }: UploadVideoDialogProps) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folderPath", folderPath);
        formData.append("fileName", file.name);

        return supabase.functions.invoke("upload-r2-video", {
          body: formData,
        }).then(({ error }) => {
          if (error) {
            throw new Error(`Lỗi tải lên tệp ${file.name}: ${error.message}`);
          }
        });
      });

      await Promise.all(uploadPromises);
      return files.length;
    },
    onSuccess: (fileCount) => {
      showSuccess(`Đã tải lên thành công ${fileCount} video!`);
      queryClient.invalidateQueries({ queryKey: ["kocVideos", folderPath] });
      handleClose();
    },
    onError: (error: Error) => {
      showError(`Lỗi tải lên: ${error.message}`);
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setSelectedFiles(prevFiles => {
        const newFiles = Array.from(files);
        const uniqueNewFiles = newFiles.filter(nf => !prevFiles.some(pf => pf.name === nf.name && pf.size === nf.size));
        return [...prevFiles, ...uniqueNewFiles];
      });
    }
  };
  
  const removeFile = (fileToRemove: File) => {
    setSelectedFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      uploadMutation.mutate(selectedFiles);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tải lên video cho {kocName}</DialogTitle>
          <DialogDescription>
            Chọn một hoặc nhiều file video để tải lên thư mục <span className="font-mono bg-muted p-1 rounded text-xs">{folderPath}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <label htmlFor="video-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors">
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Bấm để chọn video</p>
            <Input id="video-upload" type="file" className="hidden" onChange={handleFileChange} accept="video/mp4,video/webm,video/quicktime,video/x-matroska" multiple />
          </label>

          {selectedFiles.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Đã chọn {selectedFiles.length} video:</p>
              <ScrollArea className="h-40 border rounded-lg p-2">
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileVideo className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-grow min-w-0">
                          <p className="font-medium truncate text-sm" title={file.name}>{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => removeFile(file)}>
                        <X className="h-4 w-4" />
                      </Button>
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
            {uploadMutation.isPending ? `Đang tải lên (${selectedFiles.length})...` : `Tải lên ${selectedFiles.length} video`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};