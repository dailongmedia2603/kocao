import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, KeyRound, Bot, Wand2, Loader2, CheckCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AddVertexAiDialog } from "./AddVertexAiDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type VertexAiCredential = { 
    id: string; 
    name: string; 
};

const fetchCredentials = async (userId: string): Promise<VertexAiCredential[]> => {
  const { data, error } = await supabase.from("user_vertex_ai_credentials").select("id, name").eq("user_id", userId).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
};

const CredentialRow = ({ credential }: { credential: VertexAiCredential }) => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase.from("user_vertex_ai_credentials").delete().match({ id: id, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa thành công!");
      queryClient.invalidateQueries({ queryKey: ["vertex_ai_credentials", user?.id] });
    },
    onError: (error: Error) => showError(`Lỗi: ${error.message}`),
  });

  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{credential.name}</p>
        <p className="text-sm text-muted-foreground">Thông tin xác thực đã được lưu.</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Xóa "{credential.name}"?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(credential.id)} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "Đang xóa..." : "Xóa"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const VertexAiSettings = () => {
  const { user } = useSession();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const { data: credentials, isLoading } = useQuery({
    queryKey: ["vertex_ai_credentials", user?.id],
    queryFn: () => fetchCredentials(user!.id),
    enabled: !!user,
  });

  const testApiMutation = useMutation({
    mutationFn: async (testPrompt: string) => {
      if (!credentials || credentials.length === 0) {
        throw new Error("Vui lòng thêm thông tin xác thực Vertex AI trước.");
      }
      const { data, error } = await supabase.functions.invoke("vertex-ai-proxy", {
        body: { prompt: testPrompt, credentialId: credentials[0].id }
      });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      return data;
    },
  });

  const handleTestConnection = () => {
    testApiMutation.mutate("Xin chào", {
      onSuccess: () => showSuccess("Kết nối Vertex AI thành công!"),
      onError: (error: Error) => showError(`Kết nối thất bại: ${error.message}`),
    });
  };

  const handleGenerateContent = () => {
    if (!prompt) {
      showError("Vui lòng nhập prompt.");
      return;
    }
    setResult(null);
    testApiMutation.mutate(prompt, {
      onSuccess: (data) => setResult(data.text),
      onError: (error: Error) => showError(`Lỗi tạo nội dung: ${error.message}`),
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>Cấu hình API Vertex AI</CardTitle><CardDescription>Thêm và quản lý thông tin xác thực Google Cloud.</CardDescription></div>
          <Button onClick={() => setAddDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Thêm</Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? <Skeleton className="h-20 w-full" /> : credentials && credentials.length > 0 ? (
            <div className="space-y-4">{credentials.map((cred) => <CredentialRow key={cred.id} credential={cred} />)}</div>
          ) : (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <KeyRound className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">Chưa có thông tin xác thực</h3><p className="mt-1 text-sm text-muted-foreground">Bấm "Thêm" để bắt đầu.</p>
            </div>
          )}

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold">Thử nghiệm</h3>
            <div className="space-y-4 mt-4">
              <Button onClick={handleTestConnection} disabled={testApiMutation.isPending || !credentials || credentials.length === 0} className="w-full">
                {testApiMutation.isPending && testApiMutation.variables === "Xin chào" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Kiểm tra kết nối
              </Button>
              <div>
                <Label htmlFor="prompt-textarea-vertex">Prompt</Label>
                <Textarea id="prompt-textarea-vertex" placeholder="Nhập yêu cầu..." value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
              </div>
              <Button onClick={handleGenerateContent} disabled={testApiMutation.isPending || !credentials || credentials.length === 0} className="w-full">
                {testApiMutation.isPending && testApiMutation.variables !== "Xin chào" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Tạo nội dung
              </Button>
            </div>
          </div>

          {(testApiMutation.isPending && testApiMutation.variables !== "Xin chào") && <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}
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
      <AddVertexAiDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
    </>
  );
};

export default VertexAiSettings;