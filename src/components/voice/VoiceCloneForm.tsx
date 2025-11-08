import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud, CheckCircle } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export const VoiceCloneForm = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const [voiceName, setVoiceName] = useState("");
  const [previewText, setPreviewText] = useState(
    "Xin chào, tôi rất vui được hỗ trợ bạn với các dịch vụ giọng nói của chúng tôi. Hãy chọn một giọng nói phù hợp với bạn và cùng bắt đầu hành trình âm thanh sáng tạo của chúng ta"
  );
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const uploadFileMutation = useMutation({
    mutationFn: async (fileToUpload: File) => {
      if (fileToUpload.size > MAX_FILE_SIZE) {
        throw new Error("Kích thước file tối đa là 20MB.");
      }
      if (!fileToUpload.type || !fileToUpload.type.startsWith("audio/")) {
        throw new Error("Vui lòng chọn đúng định dạng âm thanh.");
      }

      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("fileName", fileToUpload.name);
      formData.append("fileType", fileToUpload.type);

      const { data, error } = await supabase.functions.invoke("upload-voice-sample", { body: formData });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data.url;
    },
    onSuccess: (url) => {
      setAudioUrl(url);
      showSuccess("Tải file lên thành công!");
    },
    onError: (error: Error) => {
      showError(`Lỗi tải file: ${error.message}`);
      setFile(null);
      setAudioUrl(null);
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setAudioUrl(null); // Reset previous URL
      uploadFileMutation.mutate(selectedFile);
    }
  };

  const cloneVoiceMutation = useMutation({
    mutationFn: async () => {
      if (!voiceName.trim()) throw new Error("Tên giọng nói không được để trống.");
      if (previewText.trim().length < 10) throw new Error("Văn bản xem trước phải có ít nhất 10 ký tự.");
      if (!audioUrl) throw new Error("Vui lòng tải file âm thanh và chờ tải lên hoàn tất.");

      const { data, error } = await supabase.functions.invoke("voice-clone-proxy", {
        body: {
          voice_name: voiceName,
          preview_text: previewText,
          file_url: audioUrl,
        },
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      if (!data.success) throw new Error(data.message || "Clone voice thất bại.");
      return data;
    },
    onSuccess: () => {
      showSuccess("Gửi yêu cầu clone thành công! Giọng nói sẽ sớm xuất hiện trong danh sách.");
      queryClient.invalidateQueries({ queryKey: ["cloned_voices_db", user?.id] });
      setVoiceName("");
      setPreviewText("Xin chào, tôi rất vui được hỗ trợ bạn với các dịch vụ giọng nói của chúng tôi. Hãy chọn một giọng nói phù hợp với bạn và cùng bắt đầu hành trình âm thanh sáng tạo của chúng ta");
      setFile(null);
      setAudioUrl(null);
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    cloneVoiceMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tạo Giọng Nói Mới</CardTitle>
        <CardDescription>Tải lên một file âm thanh (tối đa 20MB) để tạo ra một giọng nói tùy chỉnh.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tên giọng nói</label>
            <Input
              placeholder="Ví dụ: Giọng đọc của tôi"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Văn bản xem trước</label>
            <Textarea
              className="min-h-[80px]"
              placeholder="Văn bản dùng để tạo file âm thanh mẫu..."
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">File âm thanh</label>
            <Input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              disabled={uploadFileMutation.isPending}
              key={file ? file.name + file.lastModified : 'file-input'}
            />
            {uploadFileMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang tải file lên...</span>
              </div>
            )}
            {audioUrl && file && (
              <div className="flex items-center gap-2 text-sm text-green-600 mt-2 p-2 bg-green-50 rounded-md">
                <CheckCircle className="h-4 w-4" />
                <span>Đã tải lên: {file.name}</span>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={cloneVoiceMutation.isPending || uploadFileMutation.isPending || !audioUrl}>
            {cloneVoiceMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Bắt đầu Clone
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};