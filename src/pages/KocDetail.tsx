import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Film, PlayCircle, ArrowLeft, UploadCloud, Trash2, FileText, Music, Image } from "lucide-react";
import { format } from "date-fns";
import { VideoPlayerDialog } from "@/components/koc/VideoPlayerDialog";
import { UploadVideoDialog } from "@/components/koc/UploadVideoDialog";
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
  name: string;
  url: string;
  lastModified: string;
  key: string;
};

type Koc = {
  id: string;
  name: string;
  folder_path: string | null;
};

const fetchKocDetails = async (kocId: string) => {
  const { data, error } = await supabase.from("kocs").select("id, name, folder_path").eq("id", kocId).single();
  if (error) throw error;
  return data;
};

const fetchKocFiles = async (folderPath: string): Promise<KocFile[]> => {
  const { data, error } = await supabase.functions.invoke("list-r2-videos", {
    body: { folderPath },
  });
  if (error) throw new Error(`Không thể lấy danh sách tệp: ${error.message}`);
  if (!data.files) throw new Error("Phản hồi từ server không hợp lệ.");
  return data.files;
};

const getFileTypeDetails = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'mov', 'webm', 'mkv'].includes(extension)) {
    return { Icon: Film, bgColor: 'bg-black', type: 'video' };
  }
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(extension)) {
    return { Icon: Music, bgColor: 'bg-purple-600', type: 'audio' };
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
    return { Icon: Image, bgColor: 'bg-blue-600', type: 'image' };
  }
  return { Icon: FileText, bgColor: 'bg-slate-700', type: 'other' };
};

const KocDetail = () => {
  const { kocId } = useParams<{ kocId: string }>();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<KocFile | null>(null);
  const [fileToDelete, setFileToDelete] = useState<KocFile | null>(null);
  const [isPlayerOpen, setPlayerOpen] = useState(false);
  const [isUploadOpen, setUploadOpen] = useState(false);

  const { data: koc, isLoading: isKocLoading } = useQuery<Koc>({
    queryKey: ["koc", kocId],
    queryFn: () => fetchKocDetails(kocId!),
    enabled: !!kocId,
  });

  const { data: files, isLoading: areFilesLoading, isError, error } = useQuery<KocFile[]>({
    queryKey: ["kocFiles", koc?.folder_path],
    queryFn: () => fetchKocFiles(koc!.folder_path!),
    enabled: !!koc && !!koc.folder_path,
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileKey: string) => {
      const { error } = await supabase.functions.invoke("delete-r2-video", {
        body: { videoKey: fileKey },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      showSuccess("Xóa tệp thành công!");
      queryClient.invalidateQueries({ queryKey: ["kocFiles", koc?.folder_path] });
      setFileToDelete(null);
    },
    onError: (error: Error) => {
      showError(`Lỗi xóa tệp: ${error.message}`);
    },
  });

  const handleFileClick = (file: KocFile) => {
    const { type } = getFileTypeDetails(file.name);
    if (type === 'video') {
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
    if (fileToDelete) {
      deleteFileMutation.mutate(fileToDelete.key);
    }
  };

  return (
    <>
      <div className="p-6 lg:p-8">
        <header className="flex justify-between items-center mb-6">
          <div>
            <Link to="/list-koc" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại danh sách KOC
            </Link>
            {isKocLoading ? <Skeleton className="h-8 w-64" /> : <h1 className="text-3xl font-bold">{koc?.name}</h1>}
            <p className="text-muted-foreground mt-1">Danh sách các tệp của KOC.</p>
          </div>
          <Button variant="outline" onClick={() => setUploadOpen(true)} disabled={!koc?.folder_path}>
            <UploadCloud className="mr-2 h-4 w-4" /> Tải lên tệp
          </Button>
        </header>

        {areFilesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-video w-full" />)}
          </div>
        ) : isError ? (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Lỗi</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>
        ) : files && files.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {files.map((file) => {
              const { Icon, bgColor, type } = getFileTypeDetails(file.name);
              return (
                <Card key={file.key} className="overflow-hidden group">
                  <CardContent className="p-0">
                    <div className="aspect-video flex items-center justify-center relative cursor-pointer" onClick={() => handleFileClick(file)}>
                      <div className={`w-full h-full flex items-center justify-center ${bgColor}`}>
                        <Icon className="h-12 w-12 text-gray-300" />
                      </div>
                      {type === 'video' && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlayCircle className="h-16 w-16 text-white" />
                        </div>
                      )}
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteFile(e, file)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm truncate" title={file.name}>{file.name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(file.lastModified), "dd/MM/yyyy")}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-16"><CardContent><div className="text-center text-muted-foreground"><Film className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">Chưa có tệp nào</h3><p className="mt-1 text-sm">Bấm "Tải lên tệp" để thêm tệp đầu tiên của bạn.</p></div></CardContent></Card>
        )}
      </div>
      <VideoPlayerDialog isOpen={isPlayerOpen} onOpenChange={setPlayerOpen} videoUrl={selectedFile?.url} videoName={selectedFile?.name} />
      {koc && koc.folder_path && (
        <UploadVideoDialog
          isOpen={isUploadOpen}
          onOpenChange={setUploadOpen}
          folderPath={koc.folder_path}
          kocName={koc.name}
        />
      )}
      <AlertDialog open={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa tệp?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Tệp "{fileToDelete?.name}" sẽ bị xóa vĩnh viễn khỏi Cloudflare R2.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteFileMutation.isPending}>
              {deleteFileMutation.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default KocDetail;