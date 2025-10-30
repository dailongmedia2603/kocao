import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useState } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, EyeOff, Trash2, CheckCircle, Loader2, Plus, KeyRound, Link } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AddFacebookTokenDialog } from "./AddFacebookTokenDialog";

type FacebookToken = {
  id: string;
  name: string;
  access_token: string;
  check_url: string | null;
};

const fetchFacebookTokens = async (userId: string): Promise<FacebookToken[]> => {
  const { data, error } = await supabase
    .from("user_facebook_tokens")
    .select("id, name, access_token, check_url")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return data;
};

const FacebookTokenRow = ({ token }: { token: FacebookToken }) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase.from("user_facebook_tokens").delete().match({ id: tokenId, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Xóa Access Token thành công!");
      queryClient.invalidateQueries({ queryKey: ["facebook_tokens", user?.id] });
    },
    onError: (error: Error) => {
      showError(`Lỗi: ${error.message}`);
    },
  });

  const checkConnectionMutation = useMutation({
    mutationFn: async ({ accessToken, checkUrl }: { accessToken: string; checkUrl: string }) => {
      const { data, error } = await supabase.functions.invoke("check-facebook-token", { body: { accessToken, checkUrl } });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: (data) => {
      showSuccess(data.message);
    },
    onError: (error: Error) => {
      showError(`Kiểm tra thất bại: ${error.message}`);
    },
  });

  const maskToken = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-background/50">
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-medium truncate">{token.name}</p>
        <p className="text-sm text-muted-foreground font-mono">{showToken ? token.access_token : maskToken(token.access_token)}</p>
        {token.check_url && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link className="h-3 w-3" />
            <p className="truncate">{token.check_url}</p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)}>
          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (token.check_url) {
              checkConnectionMutation.mutate({ accessToken: token.access_token, checkUrl: token.check_url });
            } else {
              showError("URL kiểm tra không được cấu hình cho token này.");
            }
          }}
          disabled={checkConnectionMutation.isPending || !token.check_url}
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
              <AlertDialogTitle>Xóa Access Token "{token.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(token.id)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const FacebookApiSettings = () => {
  const { user } = useSession();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);

  const { data: facebookTokens, isLoading } = useQuery({
    queryKey: ["facebook_tokens", user?.id],
    queryFn: () => fetchFacebookTokens(user!.id),
    enabled: !!user,
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cấu hình API Facebook</CardTitle>
            <CardDescription>
              Thêm và quản lý các Access Token để kết nối với Facebook.
            </CardDescription>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Thêm Token
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
            </div>
          ) : facebookTokens && facebookTokens.length > 0 ? (
            <div className="space-y-4">
              {facebookTokens.map((token) => (
                <FacebookTokenRow key={token.id} token={token} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <KeyRound className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Chưa có Access Token nào</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Bấm "Thêm Token" để thêm Access Token Facebook đầu tiên của bạn.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <AddFacebookTokenDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
    </>
  );
};

export default FacebookApiSettings;