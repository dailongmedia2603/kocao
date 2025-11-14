import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, Wand2, Bot, ExternalLink } from "lucide-react";

const GeminiCustomApiSettings = () => {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const callApiMutation = useMutation({
    mutationFn: async (testPrompt: string) => {
      const formData = new FormData();
      formData.append("prompt", testPrompt);
      
      const { data, error } = await supabase.functions.invoke("gemini-custom-proxy", {
        body: formData,
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
  });

  const handleTestConnection = () => {
    const toastId = showLoading("Đang kiểm tra kết nối...");
    callApiMutation.mutate("Xin chào, đây là một bài kiểm tra kết nối.", {
      onSuccess: () => {
        dismissToast(toastId);
        showSuccess("Kết nối thành công!");
      },
      onError: (error: Error) => {
        dismissToast(toastId);
        showError(`Kiểm tra thất bại: ${error.message}`);
      },
    });
  };

  const handleGenerateContent = () => {
    if (!prompt) {
      showError("Vui lòng nhập prompt.");
      return;
    }
    setResult(null);
    callApiMutation.mutate(prompt, {
      onSuccess: (data) => {
        setResult(data);
        showSuccess("Tạo nội dung thành công!");
      },
      onError: (error: Error) => {
        showError(`Lỗi tạo nội dung: ${error.message}`);
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cấu hình API Gemini Custom</CardTitle>
        <CardDescription>
          Tích hợp với dịch vụ Gemini tùy chỉnh qua proxy tại <code className="bg-muted text-foreground font-mono p-1 rounded-sm text-xs">https://aquarius.qcv.vn/</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-lg bg-background/50">
          <h4 className="font-semibold">Hướng dẫn cấu hình</h4>
          <ol className="list-decimal list-inside text-sm text-muted-foreground mt-2 space-y-1">
            <li>
              Tạo một secret mới trong Supabase Vault với tên chính xác là{" "}
              <code className="bg-muted text-foreground font-mono p-1 rounded-sm text-xs">GEMINI_CUSTOM_TOKEN</code>.
            </li>
            <li>Dán token API của bạn vào giá trị của secret và lưu lại.</li>
          </ol>
          <Button variant="link" asChild className="p-0 h-auto mt-2 text-sm">
            <a href="https://supabase.com/dashboard/project/ypwupyjwwixgnwpohngd/settings/vault/keys" target="_blank" rel="noopener noreferrer">
              Đi đến Supabase Vault <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </div>
        <Button
          onClick={handleTestConnection}
          disabled={callApiMutation.isPending}
          className="w-full"
        >
          {callApiMutation.isPending && callApiMutation.variables === "Xin chào, đây là một bài kiểm tra kết nối." ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Kiểm tra kết nối
        </Button>

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold">Thử nghiệm tạo nội dung</h3>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="prompt-textarea-gemini">Prompt</Label>
              <Textarea
                id="prompt-textarea-gemini"
                placeholder="Nhập yêu cầu của bạn ở đây..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
            </div>
            <Button
              onClick={handleGenerateContent}
              disabled={callApiMutation.isPending}
              className="w-full"
            >
              {callApiMutation.isPending && callApiMutation.variables !== "Xin chào, đây là một bài kiểm tra kết nối." ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Tạo nội dung
            </Button>
          </div>
        </div>

        {callApiMutation.isSuccess && result && (
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

export default GeminiCustomApiSettings;