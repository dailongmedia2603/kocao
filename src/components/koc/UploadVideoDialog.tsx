import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileVideo, X } from "lucide-react";

type UploadVideoDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  folderPath: string;
  kocName: string;
};

export const UploadVideoDialog = ({ isOpen, onOpenChange, folderPath, kocName }: UploadVideoDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folderPath", folderPath);
      formData.append("fileName", file.name);

      const { error } = await supabase.functions.invoke("upload-r2-video", {
        body: formData,
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      showSuccess("Tải lên video thành công!");
      queryClient.invalidateQueries({ queryKey: ["kocVideos", folderPath] });
      handleClose();
    },
    onError: (error: Error) => {
      showError(`Lỗi tải lên: ${error.message}`);
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tải lên video cho {kocName}</DialogTitle>
          <DialogDescription>
            Chọn một file video từ máy tính của bạn để tải lên thư mục <span className="font-mono bg-muted p-1 rounded text-xs">{folderPath}</span> trên Cloudflare R2.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {selectedFile ? (
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted">
              <div className="flex items-center gap-3 min-w-0">
                <FileVideo className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                <div className="flex-grow min-w-0">
                  <p className="font-medium truncate text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <label htmlFor="video-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors">
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Bấm để chọn video</p>
              <Input id="video-upload" type="file" className="hidden" onChange={handleFileChange} accept="video/mp4,video/webm,video/quicktime,video/x-matroska" />
            </label>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>Hủy</Button>
          <Button onClick={handleUpload} disabled={!selectedFile || uploadMutation.isPending}>
            {uploadMutation.isPending ? "Đang tải lên..." : "Tải lên"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};