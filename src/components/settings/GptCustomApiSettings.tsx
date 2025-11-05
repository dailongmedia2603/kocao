import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, Wand2, ImagePlus, X, Bot } from "lucide-react";

const GptCustomApiSettings = () => {
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkConnectionMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("prompt", "Xin chào, đây là một bài kiểm tra kết nối.");
      const { data, error } = await supabase.functions.invoke("gpt-custom-proxy", { body: formData });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      showSuccess("Kết nối thành công!");
    },
    onError: (error: Error) => {
      showError(`Kiểm tra thất bại: ${error.message}`);
    },
  });

  const generateContentMutation = useMutation({
    mutationFn: async () => {
      if (!prompt && images.length === 0) {
        throw new Error("Vui lòng nhập prompt hoặc tải lên hình ảnh.");
      }
      const formData = new FormData();
      formData.append("prompt", prompt);
      images.forEach(image => {
        formData.append("images", image);
      });

      const { data, error } = await supabase.functions.invoke("gpt-custom-proxy", { body: formData });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setResult(data.answer);
      showSuccess("Tạo nội dung thành công!");
    },
    onError: (error: Error) => {
      showError(`Lỗi tạo nội dung: ${error.message}`);
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setImages(prev => [...prev, ...Array.from(event.target.files!)]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cấu hình API GPT Custom</CardTitle>
        <CardDescription>
          Tích hợp với dịch vụ GPT tùy chỉnh qua proxy tại <code className="bg-muted text-foreground font-mono p-1 rounded-sm text-xs">https://chatbot.qcv.vn/</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-lg bg-background/50">
          <h4 className="font-semibold">Kiểm tra kết nối</h4>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Nhấn nút bên dưới để đảm bảo rằng hệ thống có thể kết nối đến dịch vụ GPT tùy chỉnh.
          </p>
          <Button
            onClick={() => checkConnectionMutation.mutate()}
            disabled={checkConnectionMutation.isPending}
          >
            {checkConnectionMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Kiểm tra kết nối
          </Button>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold">Thử nghiệm tạo nội dung</h3>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="prompt-textarea">Prompt</Label>
              <Textarea
                id="prompt-textarea"
                placeholder="Nhập yêu cầu của bạn ở đây..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
            </div>
            <div>
              <Label>Hình ảnh</Label>
              <Input
                type="file"
                multiple
                accept="image/png, image/jpeg, image/gif"
                onChange={handleFileChange}
                className="hidden"
                ref={fileInputRef}
              />
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {images.map((image, index) => (
                  <div key={index} className="relative group aspect-square">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`preview ${index}`}
                      className="w-full h-full object-cover rounded-md"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="aspect-square flex flex-col items-center justify-center h-full w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs mt-1">Thêm ảnh</span>
                </Button>
              </div>
            </div>
            <Button
              onClick={() => generateContentMutation.mutate()}
              disabled={generateContentMutation.isPending}
              className="w-full"
            >
              {generateContentMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Tạo nội dung
            </Button>
          </div>
        </div>

        {result && (
          <div className="border-t pt-6">
            <h3 className="font-semibold flex items-center gap-2 mb-2"><Bot className="h-5 w-5 text-primary" /> Kết quả từ AI</h3>
            <div className="p-4 border rounded-lg bg-muted/50 min-h-[100px]">
              <pre className="whitespace-pre-wrap text-sm font-sans">{result}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GptCustomApiSettings;