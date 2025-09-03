import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
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
import { FileText, AlertCircle, Edit, Trash2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

export type UserFile = {
  id: string;
  file_name: string;
  file_url: string;
  created_at: string;
  storage_path: string;
};

type FileLibraryProps = {
  onFileSelect: (file: UserFile) => void;
  selectedFileUrl?: string | null;
};

const fetchUserFiles = async (userId: string) => {
  const { data, error } = await supabase
    .from("user_files")
    .select("id, file_name, file_url, created_at, storage_path")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return data;
};

export const FileLibrary = ({ onFileSelect, selectedFileUrl }: FileLibraryProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const [fileToRename, setFileToRename] = useState<UserFile | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [fileToDelete, setFileToDelete] = useState<UserFile | null>(null);

  const { data: files, isLoading, isError, error } = useQuery<UserFile[]>({
    queryKey: ["user_files", user?.id],
    queryFn: () => fetchUserFiles(user!.id),
    enabled: !!user,
  });

  const renameMutation = useMutation({
    mutationFn: async ({ file, newName }: { file: UserFile; newName: string }) => {
      const pathParts = file.storage_path.split('/');
      const oldFileNameInStorage = pathParts.pop();
      if (!oldFileNameInStorage) throw new Error("Đường dẫn lưu trữ không hợp lệ");

      const directory = pathParts.join('/');
      const firstHyphenIndex = oldFileNameInStorage.indexOf('-');
      
      let newFileNameInStorage;
      if (firstHyphenIndex !== -1) {
        const prefix = oldFileNameInStorage.substring(0, firstHyphenIndex + 1);
        newFileNameInStorage = prefix + newName;
      } else {
        newFileNameInStorage = newName;
      }
      
      const newStoragePath = directory ? `${directory}/${newFileNameInStorage}` : newFileNameInStorage;

      const { error: moveError } = await supabase.storage
        .from("user_files")
        .move(file.storage_path, newStoragePath);

      if (moveError) {
        if (moveError.message.includes("already exists")) {
          throw new Error(`Tệp có tên "${newName}" đã tồn tại. Vui lòng chọn tên khác.`);
        }
        throw new Error(`Lỗi đổi tên tệp trong bộ nhớ: ${moveError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from("user_files")
        .getPublicUrl(newStoragePath);

      const { error: dbError } = await supabase
        .from("user_files")
        .update({
          file_name: newName,
          file_url: publicUrlData.publicUrl,
          storage_path: newStoragePath,
        })
        .eq("id", file.id);

      if (dbError) {
        await supabase.storage.from("user_files").move(newStoragePath, file.storage_path);
        throw new Error(`Lỗi cập nhật cơ sở dữ liệu: ${dbError.message}`);
      }
    },
    onSuccess: () => {
      showSuccess("Đổi tên tệp thành công!");
      queryClient.invalidateQueries({ queryKey: ["user_files", user?.id] });
      setFileToRename(null);
      setNewFileName("");
    },
    onError: (err: Error) => {
      showError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (file: UserFile) => {
      const { error: storageError } = await supabase.storage
        .from("user_files")
        .remove([file.storage_path]);
      if (storageError) throw new Error(`Lỗi xóa tệp khỏi bộ nhớ: ${storageError.message}`);

      const { error: dbError } = await supabase
        .from("user_files")
        .delete()
        .eq("id", file.id);
      if (dbError) throw new Error(`Lỗi xóa tệp khỏi cơ sở dữ liệu: ${dbError.message}`);
    },
    onSuccess: () => {
      showSuccess("Xóa tệp thành công!");
      queryClient.invalidateQueries({ queryKey: ["user_files", user?.id] });
      setFileToDelete(null);
    },
    onError: (err: Error) => {
      showError(err.message);
    },
  });

  const handleRenameSubmit = () => {
    if (fileToRename && newFileName.trim() && newFileName.trim() !== fileToRename.file_name) {
      renameMutation.mutate({ file: fileToRename, newName: newFileName.trim() });
    } else {
      setFileToRename(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (fileToDelete) {
      deleteMutation.mutate(fileToDelete);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Lỗi</AlertTitle>
        <AlertDescription>Không thể tải thư viện tệp: {error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!files || files.length === 0) {
    return (
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertTitle>Thư viện trống</AlertTitle>
        <AlertDescription>Bạn chưa tải lên tệp nào. Hãy thử tải lên một tệp mới.</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <ScrollArea className="h-48 rounded-md border p-2">
        <RadioGroup
          value={selectedFileUrl || undefined}
          onValueChange={(value) => {
            const selectedFile = files.find((file) => file.file_url === value);
            if (selectedFile) {
              onFileSelect(selectedFile);
            }
          }}
        >
          {files.map((file) => (
            <div key={file.id} className="flex items-center space-x-2 mb-1 p-2 rounded-md hover:bg-accent group">
              <RadioGroupItem value={file.file_url} id={file.id} />
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Label htmlFor={file.id} className="flex-grow cursor-pointer min-w-0">
                <p className="font-medium truncate text-sm">{file.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(file.created_at).toLocaleString()}
                </p>
              </Label>
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.preventDefault();
                    setFileToRename(file);
                    setNewFileName(file.file_name);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    setFileToDelete(file);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </RadioGroup>
      </ScrollArea>

      <Dialog open={!!fileToRename} onOpenChange={(isOpen) => !isOpen && setFileToRename(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên tệp</DialogTitle>
            <DialogDescription>
              Nhập tên mới cho tệp "{fileToRename?.file_name}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Tên tệp mới"
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Hủy</Button>
            </DialogClose>
            <Button onClick={handleRenameSubmit} disabled={renameMutation.isPending}>
              {renameMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!fileToDelete} onOpenChange={(isOpen) => !isOpen && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Thao tác này sẽ xóa vĩnh viễn tệp "{fileToDelete?.file_name}" khỏi bộ nhớ và cơ sở dữ liệu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};