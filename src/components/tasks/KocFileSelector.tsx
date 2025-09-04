import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  Film,
  FileText,
  Image,
  Music,
} from "lucide-react";

type Koc = {
  id: string;
  name: string;
};

export type KocFile = {
  id: string;
  display_name: string;
  url: string;
  r2_key: string;
};

type KocFileSelectorProps = {
  onFileSelect: (file: KocFile) => void;
  selectedFileUrl?: string | null;
};

const fetchKocs = async (userId: string) => {
  const { data, error } = await supabase
    .from("kocs")
    .select("id, name")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
};

const fetchKocFiles = async (kocId: string): Promise<KocFile[]> => {
  const { data, error } = await supabase.functions.invoke("list-koc-files", {
    body: { kocId },
  });
  if (error) throw new Error(error.message);
  return data.files.map((f: any) => ({
    ...f,
    display_name: f.display_name,
    url: f.url,
    r2_key: f.r2_key,
  }));
};

const getFileTypeIcon = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  if (["mp4", "mov", "webm", "mkv"].includes(extension))
    return <Film className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
  if (["mp3", "wav", "m4a", "ogg"].includes(extension))
    return <Music className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension))
    return <Image className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
  return <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
};

export const KocFileSelector = ({
  onFileSelect,
  selectedFileUrl,
}: KocFileSelectorProps) => {
  const { user } = useSession();
  const [selectedKocId, setSelectedKocId] = useState<string | null>(null);

  const { data: kocs, isLoading: areKocsLoading } = useQuery<Koc[]>({
    queryKey: ["kocs", user?.id],
    queryFn: () => fetchKocs(user!.id),
    enabled: !!user,
  });

  const {
    data: files,
    isLoading: areFilesLoading,
    isError,
    error,
  } = useQuery<KocFile[]>({
    queryKey: ["kocFiles", selectedKocId],
    queryFn: () => fetchKocFiles(selectedKocId!),
    enabled: !!selectedKocId,
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>1. Chọn KOC</Label>
        <Select onValueChange={setSelectedKocId} disabled={areKocsLoading}>
          <SelectTrigger>
            <SelectValue
              placeholder={
                areKocsLoading ? "Đang tải KOCs..." : "Chọn một KOC"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {kocs?.map((koc) => (
              <SelectItem key={koc.id} value={koc.id}>
                {koc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedKocId && (
        <div>
          <Label>2. Chọn tệp</Label>
          {areFilesLoading ? (
            <div className="space-y-2 mt-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Lỗi</AlertTitle>
              <AlertDescription>{error?.message}</AlertDescription>
            </Alert>
          ) : files && files.length > 0 ? (
            <ScrollArea className="h-48 rounded-md border p-2 mt-2">
              <RadioGroup
                value={selectedFileUrl || undefined}
                onValueChange={(value) => {
                  const selectedFile = files.find(
                    (file) => file.url === value
                  );
                  if (selectedFile) onFileSelect(selectedFile);
                }}
              >
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent"
                  >
                    <RadioGroupItem value={file.url} id={file.id} />
                    {getFileTypeIcon(file.display_name)}
                    <Label
                      htmlFor={file.id}
                      className="flex-1 cursor-pointer min-w-0"
                    >
                      <p
                        className="font-medium truncate text-sm"
                        title={file.display_name}
                      >
                        {file.display_name}
                      </p>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </ScrollArea>
          ) : (
            <Alert className="mt-2">
              <FileText className="h-4 w-4" />
              <AlertTitle>Không có tệp</AlertTitle>
              <AlertDescription>
                KOC này chưa có tệp nào. Vui lòng tải lên từ trang quản lý KOC.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};