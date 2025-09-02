import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileText, AlertCircle } from "lucide-react";

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

  const { data: files, isLoading, isError, error } = useQuery<UserFile[]>({
    queryKey: ["user_files", user?.id],
    queryFn: () => fetchUserFiles(user!.id),
    enabled: !!user,
  });

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
    <ScrollArea className="h-64 rounded-md border p-4">
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
          <div key={file.id} className="flex items-center space-x-2 mb-2 p-2 rounded-md hover:bg-accent">
            <RadioGroupItem value={file.file_url} id={file.id} />
            <Label htmlFor={file.id} className="flex-grow cursor-pointer">
              <p className="font-medium truncate">{file.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(file.created_at).toLocaleString()}
              </p>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </ScrollArea>
  );
};