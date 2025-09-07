"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Film, PlayCircle, UploadCloud, Trash2, FileText, Music, Image } from "lucide-react";
import { format } from "date-fns";
import { VideoPlayerDialog } from "@/components/koc/VideoPlayerDialog";
import { UploadVideoDialog } from "@/components/koc/UploadVideoDialog";
import { EditableFileName } from "@/components/koc/EditableFileName";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { showSuccess, showError } from "@/utils/toast";

type KocFile = {
  id: string;
  display_name: string;
  url: string;
  created_at: string | null;
};

type Koc = {
  id: string;
  name: string;
  folder_path: string | null;
  user_id: string;
};

const fetchKocDetails = async (kocId: string) => {
  const { data, error } = await supabase.from("kocs").select("id, name, folder_path, user_id").eq("id", kocId).single();
  if (error) throw error;
  return data;
};

const fetchKocFiles = async (kocId: string): Promise<KocFile[]> => {
  const { data, error } = await supabase.functions.invoke("list-koc-files", {
    body: { kocId },
  });
  if (error) throw new Error(`Không thể lấy danh sách tệp: ${error.message}`);
  if (!data.files) throw new Error("Phản hồi từ server không hợp lệ.");
  return data.files;
};

const getFileTypeDetails = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'mov', 'webm', 'mkv'].includes(extension)) return { Icon: Film, bgColor: 'bg-black', type: 'video' };
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(extension)) return { Icon: Music, bgColor: 'bg-purple-600', type: 'audio' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return { Icon: Image, bgColor: 'bg-blue-600', type: 'image' };
  return { Icon: FileText, bgColor: 'bg-slate-700', type: 'other' };
};

interface KocContentTabProps {
  kocId: string;
}

export const KocContentTab = ({ kocId }: KocContentTabProps) => {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<KocFile | null>(null);
  const [fileToDelete, setFileToDelete] = useState<KocFile | null>(null);
  const [isPlayerOpen, setPlayerOpen] = useState(false);
  const [isUploadOpen, setUploadOpen] = useState(false);

  const { data: koc } = useQuery<Koc>({
    queryKey: ["koc", kocId],
    queryFn: () => fetchKocDetails(kocId!),
    enabled: !!kocId,
  });

  const queryKey = ["kocFiles", kocId];
  const { data: files, isLoading: areFilesLoading, isError, error } = useQuery<KocFile[]>({
    queryKey,
    queryFn: () => fetchKocFiles(kocId!),
    enabled: !!kocId,
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase.functions.invoke("delete-koc-file", { body: { fileId } });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      showSuccess("Xóa tệp thành công!");
      queryClient.invalidateQueries({ queryKey });
      setFileToDelete(null);
    },
    onError: (error: Error) => showError(`Lỗi xóa tệp: ${error.message}`),
  });

  const handleFileClick = (file: KocFile) => {
    if (getFileTypeDetails(file.display_name).type === 'video') {
      setSelectedFile(file);
      setPlayerOpen(true);
    } else {
      window.open(file.url, '_blank');
    }
  };

  const handleDeleteFile = (e: React.MouseEvent, file: KocFile) => {
    e.stopPropagation();
    setFileToDelete(file);
  };

  const confirmDelete = () => {
    if (fileToDelete) deleteFileMutation.mutate(fileToDelete.id);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">Danh sách video đã tạo</h3>
        <Button variant="outline" onClick={() => setUploadOpen(true)} disabled={!koc?.folder_path}>
          <UploadCloud className="mr-2 h-4 w-4" /> Tải lên tệp
        </Button>
      </div>

      {areFilesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full" />)}
        </div>
      ) : isError ? (
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Lỗi</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>
      ) : files && files.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {files.map((file) => {
            const { Icon, bgColor, type } = getFileTypeDetails(file.display_name);
            return (
              <Card key={file.id} className="overflow-hidden group">
                <CardContent className="p-0">
                  <div className="aspect-video flex items-center justify-center relative cursor-pointer" onClick={() => handleFileClick(file)}>
                    <div className={`w-full h-full flex items-center justify-center ${bgColor}`}><Icon className="h-12 w-12 text-gray-300" /></div>
                    {type === 'video' && <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><PlayCircle className="h-16 w-16 text-white" /></div>}
                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDeleteFile(e, file)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="p-3 space-y-1">
                    <EditableFileName fileId={file.id} initialName={file.display_name} queryKey={queryKey} />
                    {file.created_at && <p className="text-xs text-muted-foreground">{format(new Date(file.created_at), "dd/MM/yyyy")}</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-16"><CardContent><div className="text-center text-muted-foreground"><Film className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">Chưa có tệp nào</h3><p className="mt-1 text-sm">Bấm "Tải lên tệp" để thêm tệp đầu tiên của bạn.</p></div></CardContent></Card>
      )}
      <VideoPlayerDialog isOpen={isPlayerOpen} onOpenChange={setPlayerOpen} videoUrl={selectedFile?.url} videoName={selectedFile?.display_name} />
      {koc && (
        <UploadVideoDialog isOpen={isUploadOpen} onOpenChange={setUploadOpen} folderPath={koc.folder_path!} kocId={koc.id} userId={koc.user_id} kocName={koc.name} />
      )}
      <AlertDialog open={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa tệp?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này không thể hoàn tác. Tệp "{fileToDelete?.display_name}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteFileMutation.isPending}>{deleteFileMutation.isPending ? "Đang xóa..." : "Xóa"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};