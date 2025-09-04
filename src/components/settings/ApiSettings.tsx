import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, EyeOff, Trash2, CheckCircle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const formSchema = z.object({
  gemini_api_key: z.string().min(10, "API Key không hợp lệ"),
});

type ApiKeyData = {
  gemini_api_key: string | null;
};

const fetchApiKey = async (userId: string): Promise<ApiKeyData | null> => {
  const { data, error } = await supabase
    .from("user_api_keys")
    .select("gemini_api_key")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
    throw new Error(error.message);
  }
  return data;
};

const ApiSettings = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);

  const { data: apiKeyData, isLoading } = useQuery({
    queryKey: ["api_key", user?.id],
    queryFn: () => fetchApiKey(user!.id),
    enabled: !!user,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gemini_api_key: "",
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from("user_api_keys")
        .upsert({ user_id: user.id, gemini_api_key: values.gemini_api_key }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Lưu API Key thành công!");
      queryClient.invalidateQueries({ queryKey: ["api_key", user?.id] });
      form.reset({ gemini_api_key: "" });
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from("user_api_keys")
        .update({ gemini_api_key: null })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa API Key thành công!");
      queryClient.invalidateQueries({ queryKey: ["api_key", user?.id] });
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const checkConnectionMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const { data, error } = await supabase.functions.invoke("check-gemini-api-key", {
        body: { apiKey },
      });

      if (error) {
        throw new Error(error.message);
      }
      
      if (!data.success) {
        throw new Error(data.message);
      }

      return data;
    },
    onSuccess: (data) => {
      showSuccess(data.message);
    },
    onError: (error: Error) => {
      showError(`Kiểm tra thất bại: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    upsertMutation.mutate(values);
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cấu hình API Gemini</CardTitle>
        <CardDescription>
          Thêm API Key Gemini của bạn để sử dụng các tính năng AI trong ứng dụng.
          Bạn có thể lấy key từ <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google AI Studio</a>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-24" />
          </div>
        ) : apiKeyData?.gemini_api_key ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={showKey ? apiKeyData.gemini_api_key : maskApiKey(apiKeyData.gemini_api_key)}
                className="font-mono"
              />
              <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                onClick={() => checkConnectionMutation.mutate(apiKeyData.gemini_api_key!)}
                disabled={checkConnectionMutation.isPending}
              >
                {checkConnectionMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Kiểm tra
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bạn có chắc chắn muốn xóa API Key?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Hành động này không thể hoàn tác. Các tính năng AI sẽ không hoạt động cho đến khi bạn thêm key mới.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                      {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <p className="text-sm text-muted-foreground">API Key của bạn đã được lưu. Xóa key hiện tại để thêm key mới.</p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="gemini_api_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gemini API Key</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập API Key của bạn ở đây" {...field} />
                    </FormControl>
                    <FormDescription>
                      API Key của bạn được lưu trữ an toàn và không bao giờ chia sẻ.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Đang lưu..." : "Lưu API Key"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
};

export default ApiSettings;