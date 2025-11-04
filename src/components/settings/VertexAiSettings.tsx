import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, KeyRound, ExternalLink } from "lucide-react";

const VertexAiSettings = () => {
  const checkConnectionMutation = useMutation({
    mutationFn: async () => {
      const toastId = showLoading("Đang kiểm tra kết nối...");
      try {
        const { data, error } = await supabase.functions.invoke("check-vertex-ai-key");
        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error);
        dismissToast(toastId);
        showSuccess(data.message);
      } catch (error) {
        dismissToast(toastId);
        showError(`Kiểm tra thất bại: ${(error as Error).message}`);
        throw error;
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cấu hình Gemini qua Vertex AI</CardTitle>
        <CardDescription>
          Sử dụng secret trong Supabase Vault để kết nối an toàn với Vertex AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border rounded-lg bg-background/50">
          <h4 className="font-semibold">Hướng dẫn cấu hình</h4>
          <ol className="list-decimal list-inside text-sm text-muted-foreground mt-2 space-y-1">
            <li>Sao chép toàn bộ nội dung tệp JSON Service Account của bạn.</li>
            <li>
              Tạo một secret mới trong Supabase Vault với tên chính xác là{" "}
              <code className="bg-muted text-foreground font-mono p-1 rounded-sm text-xs">GOOGLE_CREDENTIALS_JSON</code>.
            </li>
            <li>Dán nội dung đã sao chép vào giá trị của secret và lưu lại.</li>
          </ol>
          <Button variant="link" asChild className="p-0 h-auto mt-2 text-sm">
            <a href="https://supabase.com/dashboard/project/ypwupyjwwixgnwpohngd/settings/vault/keys" target="_blank" rel="noopener noreferrer">
              Đi đến Supabase Vault <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </div>
        <Button
          onClick={() => checkConnectionMutation.mutate()}
          disabled={checkConnectionMutation.isPending}
          className="w-full"
        >
          {checkConnectionMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Kiểm tra kết nối
        </Button>
      </CardContent>
    </Card>
  );
};

export default VertexAiSettings;